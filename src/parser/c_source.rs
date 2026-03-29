use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;
use rayon::prelude::*;
use tree_sitter::{Parser, Query, QueryCursor};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct FunctionDef {
    pub name: String,
    pub file_path: String,
    pub line_number: u32,
    pub is_static: bool,
    pub return_type: String,
    pub signature: String,
}

#[derive(Debug, Clone)]
pub struct CallEdge {
    pub caller: String,
    pub callee: String,
    pub file_path: String,
    pub line_number: u32,
}

#[derive(Debug, Clone)]
pub struct ExportedSymbol {
    pub name: String,
    pub is_gpl: bool,
    pub file_path: String,
    pub line_number: u32,
}

#[derive(Debug, Clone)]
pub struct StructDef {
    pub name: String,
    pub file_path: String,
    pub line_number: u32,
}

#[derive(Debug, Default)]
pub struct CSourceData {
    pub functions: Vec<FunctionDef>,
    pub calls: Vec<CallEdge>,
    pub exports: Vec<ExportedSymbol>,
    pub structs: Vec<StructDef>,
}

/// Find and parse all C source files under the kernel source tree.
pub fn parse_all(
    kernel_path: &Path,
    subsystems: &Option<Vec<String>>,
    progress: Option<&indicatif::ProgressBar>,
) -> Result<CSourceData> {
    let c_files: Vec<PathBuf> = WalkDir::new(kernel_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            name.ends_with(".c") || name.ends_with(".h")
        })
        .filter(|e| {
            // Skip generated/build dirs
            let rel = e
                .path()
                .strip_prefix(kernel_path)
                .unwrap_or(e.path())
                .to_string_lossy();
            !rel.starts_with("tools/")
                && !rel.starts_with("scripts/")
                && !rel.starts_with("Documentation/")
                && !rel.starts_with("samples/")
        })
        .filter(|e| {
            if let Some(ref subs) = subsystems {
                let rel = e
                    .path()
                    .strip_prefix(kernel_path)
                    .unwrap_or(e.path())
                    .to_string_lossy();
                subs.iter().any(|s| rel.starts_with(s))
            } else {
                true
            }
        })
        .map(|e| e.into_path())
        .collect();

    log::info!("Found {} C source files", c_files.len());

    if let Some(pb) = progress {
        pb.set_length(c_files.len() as u64);
    }

    let kernel_path_ref = kernel_path;
    let results: Vec<CSourceData> = c_files
        .par_iter()
        .filter_map(|path| {
            let rel = path
                .strip_prefix(kernel_path_ref)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            let result = parse_file(path, &rel);
            if let Some(pb) = progress {
                pb.inc(1);
            }
            match result {
                Ok(data) => Some(data),
                Err(e) => {
                    log::debug!("Failed to parse {}: {}", path.display(), e);
                    None
                }
            }
        })
        .collect();

    let mut merged = CSourceData::default();
    for data in results {
        merged.functions.extend(data.functions);
        merged.calls.extend(data.calls);
        merged.exports.extend(data.exports);
        merged.structs.extend(data.structs);
    }

    Ok(merged)
}

/// Parse a single C source file using tree-sitter.
fn parse_file(path: &Path, rel_path: &str) -> Result<CSourceData> {
    let source = fs::read_to_string(path)?;
    let mut parser = Parser::new();
    let language = tree_sitter_c::language();
    parser.set_language(&language)?;

    let tree = parser
        .parse(&source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse {}", rel_path))?;

    let root = tree.root_node();
    let source_bytes = source.as_bytes();

    let mut data = CSourceData::default();

    // Extract function definitions
    let func_query = Query::new(
        &language,
        "(function_definition
            type: (_) @return_type
            declarator: (function_declarator
                declarator: (_) @name
                parameters: (_) @params)
            body: (_)) @func",
    )?;

    let mut cursor = QueryCursor::new();
    let matches = cursor.matches(&func_query, root, source_bytes);

    for m in matches {
        let func_node = m.captures.iter().find(|c| c.index == 3).map(|c| c.node);
        let name_node = m.captures.iter().find(|c| c.index == 1).map(|c| c.node);
        let ret_node = m.captures.iter().find(|c| c.index == 0).map(|c| c.node);
        let params_node = m.captures.iter().find(|c| c.index == 2).map(|c| c.node);

        if let (Some(func), Some(name), Some(ret), Some(params)) =
            (func_node, name_node, ret_node, params_node)
        {
            let name_text = name.utf8_text(source_bytes).unwrap_or("").to_string();
            let ret_text = ret.utf8_text(source_bytes).unwrap_or("").to_string();
            let params_text = params.utf8_text(source_bytes).unwrap_or("").to_string();

            // Check if preceded by 'static'
            let func_text = func.utf8_text(source_bytes).unwrap_or("");
            let is_static = func_text.starts_with("static ")
                || func_text.contains("\nstatic ");

            // Also check storage class specifiers
            let is_static = is_static || {
                let start = func.start_byte();
                let prefix = if start > 20 {
                    &source[start - 20..start]
                } else {
                    &source[..start]
                };
                prefix.trim().ends_with("static")
            };

            data.functions.push(FunctionDef {
                name: name_text.clone(),
                file_path: rel_path.to_string(),
                line_number: (name.start_position().row + 1) as u32,
                is_static,
                return_type: ret_text.clone(),
                signature: format!("{} {}{}",  ret_text, name_text, params_text),
            });
        }
    }

    // Extract function calls within each function body
    let call_query = Query::new(
        &language,
        "(call_expression
            function: (identifier) @callee) @call",
    )?;

    // Walk function definitions again and find calls within them
    let func_def_query = Query::new(
        &language,
        "(function_definition
            declarator: (function_declarator
                declarator: (_) @fname)
            body: (compound_statement) @body) @fdef",
    )?;

    let mut cursor2 = QueryCursor::new();
    let func_matches: Vec<_> = cursor2
        .matches(&func_def_query, root, source_bytes)
        .collect();

    for m in &func_matches {
        let fname_node = m.captures.iter().find(|c| c.index == 0).map(|c| c.node);
        let body_node = m.captures.iter().find(|c| c.index == 1).map(|c| c.node);

        if let (Some(fname), Some(body)) = (fname_node, body_node) {
            let caller_name = fname.utf8_text(source_bytes).unwrap_or("");
            let mut call_cursor = QueryCursor::new();
            let call_matches = call_cursor.matches(&call_query, body, source_bytes);

            for cm in call_matches {
                if let Some(callee_cap) = cm.captures.iter().find(|c| c.index == 0) {
                    let callee_name =
                        callee_cap.node.utf8_text(source_bytes).unwrap_or("");
                    if !callee_name.is_empty() {
                        data.calls.push(CallEdge {
                            caller: caller_name.to_string(),
                            callee: callee_name.to_string(),
                            file_path: rel_path.to_string(),
                            line_number: (callee_cap.node.start_position().row + 1)
                                as u32,
                        });
                    }
                }
            }
        }
    }

    // Extract EXPORT_SYMBOL and EXPORT_SYMBOL_GPL
    extract_exports(&source, rel_path, &mut data);

    // Extract struct definitions (only those with a body)
    let mut cursor3 = QueryCursor::new();
    let struct_full_query = Query::new(
        &language,
        "(struct_specifier
            name: (type_identifier) @name
            body: (field_declaration_list)) @struct",
    )?;

    let mut seen_structs = std::collections::HashSet::new();
    let struct_matches: Vec<_> = cursor3
        .matches(&struct_full_query, root, source_bytes)
        .collect();

    for m in &struct_matches {
        if let Some(name_cap) = m.captures.iter().find(|c| c.index == 0) {
            let name = name_cap
                .node
                .utf8_text(source_bytes)
                .unwrap_or("")
                .to_string();
            if !name.is_empty() && seen_structs.insert(name.clone()) {
                data.structs.push(StructDef {
                    name,
                    file_path: rel_path.to_string(),
                    line_number: (name_cap.node.start_position().row + 1) as u32,
                });
            }
        }
    }

    Ok(data)
}

/// Extract EXPORT_SYMBOL / EXPORT_SYMBOL_GPL via regex (more reliable than tree-sitter
/// for macro invocations).
fn extract_exports(source: &str, rel_path: &str, data: &mut CSourceData) {
    let export_re = regex::Regex::new(
        r"(?m)^EXPORT_SYMBOL(?:_GPL)?\s*\(\s*(\w+)\s*\)"
    )
    .unwrap();

    for cap in export_re.captures_iter(source) {
        let full_match = cap.get(0).unwrap().as_str();
        let name = cap.get(1).unwrap().as_str().to_string();
        let is_gpl = full_match.contains("_GPL");
        let line_number = source[..cap.get(0).unwrap().start()]
            .matches('\n')
            .count() as u32
            + 1;

        data.exports.push(ExportedSymbol {
            name,
            is_gpl,
            file_path: rel_path.to_string(),
            line_number,
        });
    }
}
