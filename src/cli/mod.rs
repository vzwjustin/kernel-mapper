use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

use crate::parser;
use crate::storage::Database;


#[derive(Parser)]
#[command(name = "kmap", version, about = "Parse and query Linux kernel internals")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Initialize a kernel-mapper database from a kernel source tree
    Init {
        /// Path to the Linux kernel source tree
        kernel_path: PathBuf,
        /// Output database path (default: kmap.db)
        #[arg(short, long, default_value = "kmap.db")]
        output: PathBuf,
    },
    /// Parse kernel source into the database
    Parse {
        /// Path to the database
        #[arg(short, long, default_value = "kmap.db")]
        db: PathBuf,
        /// Only re-parse changed files
        #[arg(long)]
        incremental: bool,
        /// Limit to specific subsystems (comma-separated)
        #[arg(long, value_delimiter = ',')]
        subsystems: Option<Vec<String>>,
        /// Target architecture
        #[arg(long, default_value = "x86")]
        arch: String,
    },
    /// Query the kernel database
    Query {
        #[command(subcommand)]
        kind: QueryKind,
        /// Path to the database
        #[arg(short, long, default_value = "kmap.db", global = true)]
        db: PathBuf,
    },
    /// Visualize call graph around a function
    Viz {
        /// Function to visualize
        function: String,
        /// Output format
        #[arg(long, default_value = "dot")]
        format: VizFormat,
        /// Depth of call graph traversal
        #[arg(long, default_value = "3")]
        depth: usize,
        /// Direction: callers, callees, or both
        #[arg(long, default_value = "both")]
        direction: VizDirection,
        /// Path to the database
        #[arg(short, long, default_value = "kmap.db")]
        db: PathBuf,
        /// Output file (default: stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Compare two kernel databases
    Diff {
        db1: PathBuf,
        db2: PathBuf,
    },
    /// Run a raw SQL query against the database
    Sql {
        /// The SQL query to execute
        query: String,
        /// Path to the database
        #[arg(short, long, default_value = "kmap.db")]
        db: PathBuf,
    },
    /// Show database statistics
    Stats {
        /// Path to the database
        #[arg(short, long, default_value = "kmap.db")]
        db: PathBuf,
    },
}

#[derive(Subcommand)]
pub enum QueryKind {
    /// Find callers of a function
    Callers { function: String },
    /// Find callees of a function
    Callees { function: String },
    /// Find call path between two functions
    Path { from: String, to: String },
    /// Show config dependencies
    Depends { config: String },
    /// Show struct details
    Struct { name: String },
    /// Show exported symbols
    Exports {
        #[arg(long)]
        gpl_only: bool,
    },
    /// Show syscall information
    Syscall { name: Option<String> },
    /// Trace network packet flow for a protocol
    NetFlow { protocol: String },
    /// Search for symbols by name pattern
    Search {
        /// Pattern to search (FTS5 query or substring)
        pattern: String,
        /// Max results
        #[arg(long, default_value = "50")]
        limit: usize,
    },
}

#[derive(Clone, clap::ValueEnum)]
pub enum VizFormat {
    Dot,
    Html,
    Json,
}

#[derive(Clone, clap::ValueEnum)]
pub enum VizDirection {
    Callers,
    Callees,
    Both,
}

pub fn dispatch(cli: Cli) -> Result<()> {
    match cli.command {
        Command::Init {
            kernel_path,
            output,
        } => cmd_init(kernel_path, output),
        Command::Parse {
            db,
            incremental,
            subsystems,
            arch,
        } => cmd_parse(db, incremental, subsystems, arch),
        Command::Query { kind, db } => cmd_query(db, kind),
        Command::Viz {
            function,
            format,
            depth,
            direction,
            db,
            output,
        } => cmd_viz(db, function, format, depth, direction, output),
        Command::Diff { db1, db2 } => cmd_diff(db1, db2),
        Command::Sql { query, db } => cmd_sql(db, query),
        Command::Stats { db } => cmd_stats(db),
    }
}

fn cmd_init(kernel_path: PathBuf, output: PathBuf) -> Result<()> {
    let kernel_path = kernel_path
        .canonicalize()
        .with_context(|| format!("Kernel source not found: {}", kernel_path.display()))?;

    // Sanity check: look for top-level Kconfig
    if !kernel_path.join("Kconfig").exists() {
        anyhow::bail!(
            "{} does not look like a kernel source tree (no Kconfig found)",
            kernel_path.display()
        );
    }

    println!("Initializing kmap database: {}", output.display());
    println!("Kernel source: {}", kernel_path.display());

    let db = Database::create(&output)?;
    db.set_metadata("kernel_path", &kernel_path.to_string_lossy())?;
    db.set_metadata("version", env!("CARGO_PKG_VERSION"))?;

    println!("Database created. Run `kmap parse` to populate it.");
    Ok(())
}

fn cmd_parse(
    db_path: PathBuf,
    incremental: bool,
    subsystems: Option<Vec<String>>,
    arch: String,
) -> Result<()> {
    let db = Database::open(&db_path)?;
    let kernel_path = db
        .get_metadata("kernel_path")?
        .context("Database not initialized — run `kmap init` first")?;
    let kernel_path = PathBuf::from(kernel_path);

    println!("Parsing kernel source: {}", kernel_path.display());
    println!("Architecture: {}", arch);
    if incremental {
        println!("Mode: incremental (only changed files)");
    }
    if let Some(ref subs) = subsystems {
        println!("Subsystems: {}", subs.join(", "));
    }

    // Phase 1: Kconfig parsing
    println!("\n[1/4] Parsing Kconfig files...");
    let kconfig_entries = parser::kconfig::parse_all(&kernel_path)?;
    println!("  Found {} config options", kconfig_entries.len());
    db.insert_config_options(&kconfig_entries)?;

    // Phase 1: Makefile parsing
    println!("[2/4] Parsing Makefiles...");
    let makefile_entries = parser::makefile::parse_all(&kernel_path, &subsystems)?;
    println!(
        "  Found {} object entries across {} subsystems",
        makefile_entries.iter().map(|e| e.objects.len()).sum::<usize>(),
        makefile_entries.len()
    );
    db.insert_makefile_entries(&makefile_entries)?;

    // Phase 2: C source parsing
    println!("[3/4] Parsing C source files (functions, structs, exports)...");

    // For incremental: compute file hashes and skip unchanged
    let existing_hashes = if incremental {
        db.get_file_hashes()?
    } else {
        std::collections::HashMap::new()
    };

    let pb = indicatif::ProgressBar::new(0);
    pb.set_style(
        indicatif::ProgressStyle::default_bar()
            .template("  [{bar:40.cyan/blue}] {pos}/{len} files ({eta})")
            .unwrap()
            .progress_chars("##-"),
    );
    let c_data = parser::c_source::parse_all(&kernel_path, &subsystems, Some(&pb))?;
    pb.finish_and_clear();

    if incremental && !existing_hashes.is_empty() {
        // Filter to only changed files by comparing content hashes
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut changed_files = std::collections::HashSet::new();
        let mut new_hashes = std::collections::HashMap::new();

        // Collect unique file paths from parsed data
        let mut file_paths: std::collections::HashSet<String> = std::collections::HashSet::new();
        for f in &c_data.functions {
            file_paths.insert(f.file_path.clone());
        }

        for path in &file_paths {
            let full_path = kernel_path.join(path);
            if let Ok(content) = std::fs::read(&full_path) {
                let mut hasher = DefaultHasher::new();
                content.hash(&mut hasher);
                let hash = format!("{:016x}", hasher.finish());
                new_hashes.insert(path.clone(), hash.clone());

                match existing_hashes.get(path) {
                    Some(old_hash) if *old_hash == hash => {} // unchanged
                    _ => {
                        changed_files.insert(path.clone());
                    }
                }
            } else {
                changed_files.insert(path.clone());
            }
        }

        let skipped = file_paths.len() - changed_files.len();
        println!(
            "  Incremental: {} changed, {} unchanged (skipped)",
            changed_files.len(),
            skipped
        );

        if changed_files.is_empty() {
            println!("  No files changed — skipping insertion.");
            println!("\nParsing complete (incremental, no changes).");
            return Ok(());
        }

        // Clear old data for changed files
        let changed_list: Vec<String> = changed_files.iter().cloned().collect();
        db.clear_file_data(&changed_list)?;

        // Filter c_data to only changed files
        let filtered = parser::c_source::CSourceData {
            functions: c_data
                .functions
                .into_iter()
                .filter(|f| changed_files.contains(&f.file_path))
                .collect(),
            calls: c_data
                .calls
                .into_iter()
                .filter(|c| changed_files.contains(&c.file_path))
                .collect(),
            exports: c_data
                .exports
                .into_iter()
                .filter(|e| changed_files.contains(&e.file_path))
                .collect(),
            structs: c_data
                .structs
                .into_iter()
                .filter(|s| changed_files.contains(&s.file_path))
                .collect(),
        };

        println!(
            "  Reparsing: {} functions, {} structs, {} exports",
            filtered.functions.len(),
            filtered.structs.len(),
            filtered.exports.len(),
        );

        println!("[4/4] Inserting changed data and resolving call edges...");
        let call_count = filtered.calls.len();
        db.insert_c_source_data(&filtered)?;
        println!("  Processed {} call edges", call_count);

        // Update hashes
        for (path, hash) in &new_hashes {
            if changed_files.contains(path) {
                db.update_file_hash(path, hash)?;
            }
        }
    } else {
        println!(
            "  Found {} functions, {} structs, {} exports",
            c_data.functions.len(),
            c_data.structs.len(),
            c_data.exports.len(),
        );

        // Collect file paths before c_data is consumed
        let file_paths: std::collections::HashSet<String> = c_data
            .functions
            .iter()
            .map(|f| f.file_path.clone())
            .collect();

        // Clear existing C source data to prevent duplicates on repeated parse
        db.clear_all_c_source_data()?;

        println!("[4/4] Inserting C source data and resolving call edges...");
        let call_count = c_data.calls.len();
        db.insert_c_source_data(&c_data)?;
        println!("  Processed {} call edges", call_count);

        // Store hashes for future incremental runs
        {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};

            for path in &file_paths {
                let full_path = kernel_path.join(path);
                if let Ok(content) = std::fs::read(&full_path) {
                    let mut hasher = DefaultHasher::new();
                    content.hash(&mut hasher);
                    let hash = format!("{:016x}", hasher.finish());
                    db.update_file_hash(path, &hash)?;
                }
            }
        }
    }

    println!("\nParsing complete.");
    println!("Run `kmap sql 'SELECT count(*) FROM functions'` to verify.");
    Ok(())
}

fn cmd_query(db_path: PathBuf, kind: QueryKind) -> Result<()> {
    let db = Database::open(&db_path)?;
    match kind {
        QueryKind::Callers { function } => {
            let rows = db.query_callers(&function)?;
            if rows.is_empty() {
                println!("No callers found for '{}'", function);
            } else {
                println!("Callers of '{}':", function);
                for row in &rows {
                    println!("  {} ({}:{})", row[0], row[1], row[2]);
                }
                println!("\n{} caller(s) total", rows.len());
            }
        }
        QueryKind::Callees { function } => {
            let rows = db.query_callees(&function)?;
            if rows.is_empty() {
                println!("No callees found for '{}'", function);
            } else {
                println!("Callees of '{}':", function);
                for row in &rows {
                    println!("  {} ({}:{})", row[0], row[1], row[2]);
                }
                println!("\n{} callee(s) total", rows.len());
            }
        }
        QueryKind::Path { from, to } => {
            match db.query_call_path(&from, &to, 20)? {
                Some(path) => {
                    println!("Call path from '{}' to '{}':", from, to);
                    println!("  {}", path.join(" → "));
                    println!("  ({} hops)", path.len() - 1);
                }
                None => {
                    println!("No call path found from '{}' to '{}' (max depth: 20)", from, to);
                }
            }
        }
        QueryKind::Depends { config } => {
            let rows = db.query_config_depends(&config)?;
            if rows.is_empty() {
                println!("No dependencies found for '{}'", config);
            } else {
                println!("Dependencies for '{}':", config);
                for row in &rows {
                    println!("  {} {} {}", row[0], row[1], row[2]);
                }
            }
        }
        QueryKind::Struct { name } => {
            let rows = db.query_struct(&name)?;
            if rows.is_empty() {
                println!("Struct '{}' not found", name);
            } else {
                let mut in_struct = false;
                for row in &rows {
                    if row[0] == "def" {
                        if in_struct { println!(); }
                        println!("struct {} {{", row[1]);
                        println!("  // Defined in {}:{}", row[2], row[3]);
                        in_struct = true;
                    } else if row[0] == "field" {
                        println!("  {} {};", row[2], row[1]);
                    }
                }
                if in_struct { println!("}}"); }
            }
        }
        QueryKind::Exports { gpl_only } => {
            let rows = db.query_exports(gpl_only)?;
            if rows.is_empty() {
                println!("No exported symbols found");
            } else {
                for row in &rows {
                    let gpl_tag = if row[2] == "GPL" { " [GPL]" } else { "" };
                    println!("  {}{} ({})", row[0], gpl_tag, row[1]);
                }
                println!("\n{} export(s) total", rows.len());
            }
        }
        QueryKind::Syscall { name } => {
            let rows = db.query_syscalls(name.as_deref())?;
            if rows.is_empty() {
                println!("No syscalls found");
            } else {
                for row in &rows {
                    println!("  {} ({}) — {}", row[0], row[1], row[2]);
                }
                println!("\n{} syscall(s) found", rows.len());
            }
        }
        QueryKind::NetFlow { protocol } => {
            let rows = db.query_netflow(&protocol)?;
            if rows.is_empty() {
                println!("No network functions found for protocol '{}'", protocol);
            } else {
                for row in &rows {
                    if row[0] == "---" {
                        println!("\n{}", row[1]);
                    } else if row.len() >= 5 && row[1] == "→" {
                        println!("  {} → {} ({}): {}", row[0], row[2], row[3], row[4]);
                    } else if row.len() >= 4 {
                        let vis = if row[3].is_empty() { String::new() } else { format!(" [{}]", row[3]) };
                        println!("  {}{} ({}:{})", row[0], vis, row[1], row[2]);
                    } else {
                        println!("  {} ({})", row[0], row[1]);
                    }
                }
            }
        }
        QueryKind::Search { pattern, limit } => {
            let rows = db.search_symbols(&pattern, limit)?;
            if rows.is_empty() {
                println!("No symbols found matching '{}'", pattern);
            } else {
                for row in &rows {
                    // row: [name, kind, file, line, vis] or [name, kind, file] from FTS
                    match row.len() {
                        5 => {
                            let vis = if row[4].is_empty() { String::new() } else { format!(" [{}]", row[4]) };
                            println!("  {} {} ({}:{}){}", row[1], row[0], row[2], row[3], vis);
                        }
                        3 => println!("  {} {} ({})", row[1], row[0], row[2]),
                        _ => println!("  {}", row.join(" | ")),
                    }
                }
                println!("\n{} result(s)", rows.len());
            }
        }
    }
    Ok(())
}

fn cmd_viz(
    db_path: PathBuf,
    function: String,
    format: VizFormat,
    depth: usize,
    direction: VizDirection,
    output: Option<PathBuf>,
) -> Result<()> {
    let db = Database::open(&db_path)?;

    let (callers, callees) = match direction {
        VizDirection::Callers => (true, false),
        VizDirection::Callees => (false, true),
        VizDirection::Both => (true, true),
    };

    let (nodes, edges) = db.collect_call_graph(&function, depth, callers, callees)?;

    if nodes.is_empty() {
        println!("Function '{}' not found in database", function);
        return Ok(());
    }

    let content = match format {
        VizFormat::Dot => render_dot(&function, &nodes, &edges),
        VizFormat::Json => render_json(&function, &nodes, &edges),
        VizFormat::Html => render_html(&function, &nodes, &edges),
    };

    match output {
        Some(path) => {
            std::fs::write(&path, &content)?;
            println!("Written to {}", path.display());
        }
        None => print!("{}", content),
    }
    Ok(())
}

/// Escape a string for use in DOT quoted contexts (labels and identifiers).
fn dot_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Escape a string for safe inclusion in HTML content.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

fn render_dot(
    root: &str,
    nodes: &[(String, String, bool)],
    edges: &[(String, String)],
) -> String {
    let mut out = String::new();
    out.push_str("digraph call_graph {\n");
    out.push_str("  rankdir=LR;\n");
    out.push_str("  node [shape=box, fontname=\"monospace\", fontsize=10];\n");
    out.push_str("  edge [color=\"#666666\"];\n\n");

    for (name, path, is_static) in nodes {
        let color = if name == root {
            "#ff6b6b"
        } else if *is_static {
            "#ffe066"
        } else {
            "#69db7c"
        };
        let esc_name = dot_escape(name);
        let label = if path.is_empty() {
            esc_name.clone()
        } else {
            let short = path.rsplit('/').next().unwrap_or(path);
            format!("{}\\n{}", esc_name, dot_escape(short))
        };
        out.push_str(&format!(
            "  \"{}\" [label=\"{}\", style=filled, fillcolor=\"{}\"];\n",
            esc_name, label, color
        ));
    }
    out.push('\n');

    for (from, to) in edges {
        out.push_str(&format!("  \"{}\" -> \"{}\";\n", dot_escape(from), dot_escape(to)));
    }

    out.push_str("}\n");
    out
}

fn render_json(
    root: &str,
    nodes: &[(String, String, bool)],
    edges: &[(String, String)],
) -> String {
    let nodes_json: Vec<serde_json::Value> = nodes
        .iter()
        .map(|(name, path, is_static)| {
            serde_json::json!({
                "name": name,
                "file": path,
                "is_static": is_static,
                "is_root": name == root,
            })
        })
        .collect();

    let edges_json: Vec<serde_json::Value> = edges
        .iter()
        .map(|(from, to)| {
            serde_json::json!({
                "caller": from,
                "callee": to,
            })
        })
        .collect();

    let graph = serde_json::json!({
        "root": root,
        "nodes": nodes_json,
        "edges": edges_json,
    });

    serde_json::to_string_pretty(&graph).unwrap_or_default()
}

fn render_html(
    root: &str,
    nodes: &[(String, String, bool)],
    edges: &[(String, String)],
) -> String {
    // Embed the JSON data into a self-contained HTML page with a simple SVG layout
    let json_data = render_json(root, nodes, edges);
    format!(
        r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>kmap: {root}</title>
<style>
body {{ font-family: monospace; background: #1a1a2e; color: #eee; margin: 20px; }}
h1 {{ color: #69db7c; }}
.node {{ display: inline-block; padding: 6px 12px; margin: 4px; border-radius: 4px; font-size: 13px; }}
.root {{ background: #ff6b6b; color: #000; font-weight: bold; }}
.static {{ background: #ffe066; color: #000; }}
.global {{ background: #69db7c; color: #000; }}
.edge {{ color: #888; font-size: 12px; margin: 2px 0; }}
pre {{ background: #16213e; padding: 16px; border-radius: 8px; overflow-x: auto; }}
</style></head><body>
<h1>Call graph: {root}</h1>
<p>{node_count} nodes, {edge_count} edges</p>
<h2>Nodes</h2>
{nodes_html}
<h2>Edges</h2>
{edges_html}
<h2>Raw JSON</h2>
<pre>{json}</pre>
</body></html>"#,
        root = html_escape(root),
        node_count = nodes.len(),
        edge_count = edges.len(),
        nodes_html = nodes.iter().map(|(name, path, is_static)| {
            let class = if name == root { "node root" } else if *is_static { "node static" } else { "node global" };
            let short = path.rsplit('/').next().unwrap_or(path);
            format!("<span class=\"{}\">{} <small>({})</small></span>", class, html_escape(name), html_escape(short))
        }).collect::<Vec<_>>().join("\n"),
        edges_html = edges.iter().map(|(from, to)| {
            format!("<div class=\"edge\">{} &rarr; {}</div>", html_escape(from), html_escape(to))
        }).collect::<Vec<_>>().join("\n"),
        json = html_escape(&json_data),
    )
}

fn cmd_stats(db_path: PathBuf) -> Result<()> {
    let db = Database::open(&db_path)?;
    let kernel_path = db.get_metadata("kernel_path")?.unwrap_or_else(|| "(unknown)".into());
    let version = db.get_metadata("version")?.unwrap_or_else(|| "(unknown)".into());
    println!("Database: {}", db_path.display());
    println!("Kernel:   {}", kernel_path);
    println!("Version:  {}", version);
    println!();
    let stats = db.get_stats()?;
    let max_label = stats.iter().map(|(l, _)| l.len()).max().unwrap_or(0);
    for (label, count) in &stats {
        println!("  {:width$}  {:>10}", label, count, width = max_label);
    }
    Ok(())
}

fn cmd_diff(db1_path: PathBuf, db2_path: PathBuf) -> Result<()> {
    let db1 = Database::open(&db1_path)?;
    let db2 = Database::open(&db2_path)?;

    let v1 = db1.get_metadata("kernel_path")?.unwrap_or_default();
    let v2 = db2.get_metadata("kernel_path")?.unwrap_or_default();
    println!("Comparing:");
    println!("  A: {} ({})", db1_path.display(), v1);
    println!("  B: {} ({})", db2_path.display(), v2);

    // Functions diff
    let funcs1 = db1.all_function_names()?;
    let funcs2 = db2.all_function_names()?;
    let added_funcs: Vec<&String> = funcs2.difference(&funcs1).collect();
    let removed_funcs: Vec<&String> = funcs1.difference(&funcs2).collect();

    println!("\n── Functions ──");
    println!("  A: {} total, B: {} total", funcs1.len(), funcs2.len());
    println!("  + {} added, - {} removed", added_funcs.len(), removed_funcs.len());
    if !added_funcs.is_empty() {
        let mut sorted = added_funcs.clone();
        sorted.sort();
        for f in sorted.iter().take(20) {
            println!("    + {}", f);
        }
        if added_funcs.len() > 20 {
            println!("    ... and {} more", added_funcs.len() - 20);
        }
    }
    if !removed_funcs.is_empty() {
        let mut sorted = removed_funcs.clone();
        sorted.sort();
        for f in sorted.iter().take(20) {
            println!("    - {}", f);
        }
        if removed_funcs.len() > 20 {
            println!("    ... and {} more", removed_funcs.len() - 20);
        }
    }

    // Config diff
    let configs1 = db1.all_config_names()?;
    let configs2 = db2.all_config_names()?;
    let added_cfgs: Vec<&String> = configs2.difference(&configs1).collect();
    let removed_cfgs: Vec<&String> = configs1.difference(&configs2).collect();

    println!("\n── Config Options ──");
    println!("  A: {} total, B: {} total", configs1.len(), configs2.len());
    println!("  + {} added, - {} removed", added_cfgs.len(), removed_cfgs.len());
    if !added_cfgs.is_empty() {
        let mut sorted = added_cfgs.clone();
        sorted.sort();
        for c in sorted.iter().take(20) {
            println!("    + {}", c);
        }
        if added_cfgs.len() > 20 {
            println!("    ... and {} more", added_cfgs.len() - 20);
        }
    }
    if !removed_cfgs.is_empty() {
        let mut sorted = removed_cfgs.clone();
        sorted.sort();
        for c in sorted.iter().take(20) {
            println!("    - {}", c);
        }
        if removed_cfgs.len() > 20 {
            println!("    ... and {} more", removed_cfgs.len() - 20);
        }
    }

    // Structs diff
    let structs1 = db1.all_struct_names()?;
    let structs2 = db2.all_struct_names()?;
    let added_structs: Vec<&String> = structs2.difference(&structs1).collect();
    let removed_structs: Vec<&String> = structs1.difference(&structs2).collect();

    println!("\n── Structs ──");
    println!("  A: {} total, B: {} total", structs1.len(), structs2.len());
    println!("  + {} added, - {} removed", added_structs.len(), removed_structs.len());
    if !added_structs.is_empty() {
        let mut sorted = added_structs.clone();
        sorted.sort();
        for s in sorted.iter().take(20) {
            println!("    + {}", s);
        }
        if added_structs.len() > 20 {
            println!("    ... and {} more", added_structs.len() - 20);
        }
    }
    if !removed_structs.is_empty() {
        let mut sorted = removed_structs.clone();
        sorted.sort();
        for s in sorted.iter().take(20) {
            println!("    - {}", s);
        }
        if removed_structs.len() > 20 {
            println!("    ... and {} more", removed_structs.len() - 20);
        }
    }

    // Exports diff
    let exports1 = db1.all_export_names()?;
    let exports2 = db2.all_export_names()?;
    let export_names1: std::collections::HashSet<&String> = exports1.keys().collect();
    let export_names2: std::collections::HashSet<&String> = exports2.keys().collect();
    let added_exports: Vec<&&String> = export_names2.difference(&export_names1).collect();
    let removed_exports: Vec<&&String> = export_names1.difference(&export_names2).collect();

    // GPL status changes
    let mut gpl_changes = Vec::new();
    for name in export_names1.intersection(&export_names2) {
        let gpl1 = exports1.get(*name).copied().unwrap_or(false);
        let gpl2 = exports2.get(*name).copied().unwrap_or(false);
        if gpl1 != gpl2 {
            let change = if gpl2 { "→ GPL" } else { "→ non-GPL" };
            gpl_changes.push(format!("{} {}", name, change));
        }
    }

    println!("\n── Exports ──");
    println!("  A: {} total, B: {} total", exports1.len(), exports2.len());
    println!("  + {} added, - {} removed", added_exports.len(), removed_exports.len());
    if !added_exports.is_empty() {
        let mut sorted = added_exports.clone();
        sorted.sort();
        for e in sorted.iter().take(20) {
            let gpl = if *exports2.get(**e).unwrap_or(&false) { " [GPL]" } else { "" };
            println!("    + {}{}", e, gpl);
        }
        if added_exports.len() > 20 {
            println!("    ... and {} more", added_exports.len() - 20);
        }
    }
    if !removed_exports.is_empty() {
        let mut sorted = removed_exports.clone();
        sorted.sort();
        for e in sorted.iter().take(20) {
            println!("    - {}", e);
        }
        if removed_exports.len() > 20 {
            println!("    ... and {} more", removed_exports.len() - 20);
        }
    }
    if !gpl_changes.is_empty() {
        println!("  GPL status changes:");
        for c in &gpl_changes {
            println!("    ~ {}", c);
        }
    }

    println!("\nDiff complete.");
    Ok(())
}

fn cmd_sql(db_path: PathBuf, query: String) -> Result<()> {
    let db = Database::open(&db_path)?;
    let results = db.raw_query(&query)?;

    for row in &results {
        println!("{}", row.join(" | "));
    }
    Ok(())
}
