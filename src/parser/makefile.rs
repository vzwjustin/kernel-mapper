use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;
use rayon::prelude::*;
use regex::Regex;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct MakefileEntry {
    pub subsystem: String,
    pub makefile_path: String,
    pub objects: Vec<ObjectEntry>,
}

#[derive(Debug, Clone)]
pub struct ObjectEntry {
    pub object_file: String,
    pub build_type: String,   // "built-in", "module", "conditional"
    pub config_guard: Option<String>, // e.g. "CONFIG_TCP"
}

/// Find and parse all Makefiles and Kbuild files under the kernel source tree.
pub fn parse_all(kernel_path: &Path, subsystems: &Option<Vec<String>>) -> Result<Vec<MakefileEntry>> {
    let makefile_files: Vec<PathBuf> = WalkDir::new(kernel_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            name == "Makefile" || name == "Kbuild"
        })
        .filter(|e| {
            // Skip top-level Makefile (it's the build system itself, not object defs)
            let rel = e.path().strip_prefix(kernel_path).unwrap_or(e.path());
            rel.components().count() > 1
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

    log::info!("Found {} Makefile/Kbuild files", makefile_files.len());

    let results: Vec<MakefileEntry> = makefile_files
        .par_iter()
        .filter_map(|path| {
            let rel = path
                .strip_prefix(kernel_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            match parse_file(path, &rel) {
                Ok(entry) if !entry.objects.is_empty() => Some(entry),
                Ok(_) => None,
                Err(e) => {
                    log::warn!("Failed to parse {}: {}", path.display(), e);
                    None
                }
            }
        })
        .collect();

    Ok(results)
}

/// Parse a single Makefile/Kbuild file.
fn parse_file(path: &Path, rel_path: &str) -> Result<MakefileEntry> {
    let content = fs::read_to_string(path)?;

    // Derive subsystem name from directory path
    let subsystem = Path::new(rel_path)
        .parent()
        .and_then(|p| p.components().next())
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .unwrap_or_else(|| "root".to_string());

    let mut objects = Vec::new();

    // Patterns:
    //   obj-y += foo.o
    //   obj-m += bar.o
    //   obj-$(CONFIG_FOO) += foo.o bar.o
    let obj_re = Regex::new(
        r"(?m)^[\t ]*obj-([ym]|\$\(([A-Z_0-9]+)\))\s*[\+:]?=\s*(.+)"
    )?;

    // Handle line continuations: join backslash-newline
    let content = content.replace("\\\n", " ");

    for cap in obj_re.captures_iter(&content) {
        let (build_type, config_guard) = match cap.get(2) {
            Some(cfg) => ("conditional".to_string(), Some(cfg.as_str().to_string())),
            None => {
                let marker = cap.get(1).unwrap().as_str();
                let bt = if marker == "y" {
                    "built-in"
                } else {
                    "module"
                };
                (bt.to_string(), None)
            }
        };

        let obj_list = cap.get(3).unwrap().as_str();
        for obj in obj_list.split_whitespace() {
            let obj = obj.trim();
            if obj.is_empty() || obj.starts_with('#') {
                break; // rest is a comment
            }
            objects.push(ObjectEntry {
                object_file: obj.to_string(),
                build_type: build_type.clone(),
                config_guard: config_guard.clone(),
            });
        }
    }

    Ok(MakefileEntry {
        subsystem,
        makefile_path: rel_path.to_string(),
        objects,
    })
}
