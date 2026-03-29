use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;
use rayon::prelude::*;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct ConfigOption {
    pub name: String,
    pub config_type: Option<String>,
    pub prompt: Option<String>,
    pub default_val: Option<String>,
    pub help: Option<String>,
    pub depends_on: Vec<String>,
    pub selects: Vec<String>,
    pub implies: Vec<String>,
    pub file_path: String,
    pub line_number: u32,
}

/// Find and parse all Kconfig files under the kernel source tree.
pub fn parse_all(kernel_path: &Path) -> Result<Vec<ConfigOption>> {
    let kconfig_files: Vec<PathBuf> = WalkDir::new(kernel_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            name == "Kconfig"
                || name.starts_with("Kconfig.")
                || name == "Kconfig.debug"
        })
        .map(|e| e.into_path())
        .collect();

    log::info!("Found {} Kconfig files", kconfig_files.len());

    let results: Vec<Vec<ConfigOption>> = kconfig_files
        .par_iter()
        .filter_map(|path| {
            let rel = path
                .strip_prefix(kernel_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            match parse_file(path, &rel) {
                Ok(opts) => Some(opts),
                Err(e) => {
                    log::warn!("Failed to parse {}: {}", path.display(), e);
                    None
                }
            }
        })
        .collect();

    Ok(results.into_iter().flatten().collect())
}

/// Parse a single Kconfig file.
fn parse_file(path: &Path, rel_path: &str) -> Result<Vec<ConfigOption>> {
    let content = fs::read_to_string(path)?;
    let mut options = Vec::new();
    let mut current: Option<ConfigOption> = None;
    let mut in_help = false;
    let mut help_indent: Option<usize> = None;

    for (line_idx, line) in content.lines().enumerate() {
        let trimmed = line.trim();

        // Detect help block end
        if in_help {
            if trimmed.is_empty() {
                // Blank lines are part of help
                if let Some(ref mut opt) = current {
                    if let Some(ref mut h) = opt.help {
                        h.push('\n');
                    }
                }
                continue;
            }
            let indent = line.len() - line.trim_start().len();
            match help_indent {
                Some(hi) if indent >= hi => {
                    if let Some(ref mut opt) = current {
                        let help = opt.help.get_or_insert_with(String::new);
                        if !help.is_empty() {
                            help.push('\n');
                        }
                        help.push_str(trimmed);
                    }
                    continue;
                }
                None => {
                    // First line of help — set indent
                    help_indent = Some(indent);
                    if let Some(ref mut opt) = current {
                        opt.help = Some(trimmed.to_string());
                    }
                    continue;
                }
                _ => {
                    // Dedented — help block is over
                    in_help = false;
                    help_indent = None;
                }
            }
        }

        if trimmed.starts_with("config ") || trimmed.starts_with("menuconfig ") {
            // Save previous entry
            if let Some(opt) = current.take() {
                options.push(opt);
            }

            let name = trimmed
                .split_whitespace()
                .nth(1)
                .unwrap_or("")
                .to_string();

            current = Some(ConfigOption {
                name,
                config_type: None,
                prompt: None,
                default_val: None,
                help: None,
                depends_on: Vec::new(),
                selects: Vec::new(),
                implies: Vec::new(),
                file_path: rel_path.to_string(),
                line_number: (line_idx + 1) as u32,
            });
        } else if let Some(ref mut opt) = current {
            if trimmed.starts_with("bool") || trimmed.starts_with("tristate")
                || trimmed.starts_with("string") || trimmed.starts_with("int")
                || trimmed.starts_with("hex")
            {
                let type_word = trimmed.split_whitespace().next().unwrap();
                opt.config_type = Some(type_word.to_string());
                // Extract prompt string if present
                if let Some(start) = trimmed.find('"') {
                    if let Some(end) = trimmed[start + 1..].find('"') {
                        opt.prompt = Some(trimmed[start + 1..start + 1 + end].to_string());
                    }
                }
            } else if trimmed.starts_with("default ") {
                opt.default_val = Some(
                    trimmed
                        .strip_prefix("default ")
                        .unwrap()
                        .trim()
                        .to_string(),
                );
            } else if trimmed.starts_with("depends on ") {
                opt.depends_on.push(
                    trimmed
                        .strip_prefix("depends on ")
                        .unwrap()
                        .trim()
                        .to_string(),
                );
            } else if trimmed.starts_with("select ") {
                opt.selects.push(
                    trimmed
                        .strip_prefix("select ")
                        .unwrap()
                        .trim()
                        .to_string(),
                );
            } else if trimmed.starts_with("imply ") {
                opt.implies.push(
                    trimmed
                        .strip_prefix("imply ")
                        .unwrap()
                        .trim()
                        .to_string(),
                );
            } else if trimmed == "help" || trimmed == "---help---" {
                in_help = true;
                help_indent = None;
            } else if trimmed.starts_with("prompt ") {
                if let Some(start) = trimmed.find('"') {
                    if let Some(end) = trimmed[start + 1..].find('"') {
                        opt.prompt = Some(trimmed[start + 1..start + 1 + end].to_string());
                    }
                }
            }
        }
    }

    // Don't forget the last entry
    if let Some(opt) = current.take() {
        options.push(opt);
    }

    Ok(options)
}
