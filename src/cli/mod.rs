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
    /// Visualize query results
    Viz {
        /// Output format
        #[arg(long, default_value = "dot")]
        format: VizFormat,
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
}

#[derive(Clone, clap::ValueEnum)]
pub enum VizFormat {
    Dot,
    Html,
    Tui,
    Json,
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
        Command::Viz { format } => {
            let _ = format;
            eprintln!("Visualization not yet implemented (Phase 4)");
            Ok(())
        }
        Command::Diff { db1, db2 } => {
            let _ = (db1, db2);
            eprintln!("Diff not yet implemented (Phase 5)");
            Ok(())
        }
        Command::Sql { query, db } => cmd_sql(db, query),
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
    _incremental: bool,
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
    let pb = indicatif::ProgressBar::new(0);
    pb.set_style(
        indicatif::ProgressStyle::default_bar()
            .template("  [{bar:40.cyan/blue}] {pos}/{len} files ({eta})")
            .unwrap()
            .progress_chars("##-"),
    );
    let c_data = parser::c_source::parse_all(&kernel_path, &subsystems, Some(&pb))?;
    pb.finish_and_clear();
    println!(
        "  Found {} functions, {} structs, {} exports",
        c_data.functions.len(),
        c_data.structs.len(),
        c_data.exports.len(),
    );

    println!("[4/4] Inserting C source data and resolving call edges...");
    let call_count = c_data.calls.len();
    db.insert_c_source_data(&c_data)?;
    println!("  Processed {} call edges", call_count);

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
                println!("Struct '{}':", name);
                for row in &rows {
                    println!("  Defined in {}:{}", row[1], row[2]);
                }
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
            // NetFlow is a specialized query — requires more domain-specific logic
            println!("NetFlow tracing for '{}' not yet implemented", protocol);
        }
    }
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
