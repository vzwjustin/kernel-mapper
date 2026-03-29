# kmap — Linux Kernel Source Mapper

A fast CLI tool that parses Linux kernel source trees into a queryable SQLite database. Extract functions, call graphs, Kconfig dependencies, exported symbols, struct definitions, and Makefile build rules.

## Features

- **Kconfig parsing** — extracts all config options, types, prompts, defaults, and dependency expressions (`depends on`, `select`, `imply`)
- **Makefile parsing** — maps `obj-y`/`obj-m`/`obj-$(CONFIG_*)` rules to identify what gets built, under which config guards, per subsystem
- **C source parsing** — uses tree-sitter to extract function definitions, call edges, struct definitions, and `EXPORT_SYMBOL`/`EXPORT_SYMBOL_GPL` annotations
- **Call graph queries** — find callers, callees, or shortest call paths between any two functions
- **Config dependency queries** — show what a config option depends on, selects, or implies (plus reverse deps)
- **Full-text search** — FTS5 index over all symbols for fast lookups
- **Raw SQL** — run arbitrary queries against the database

## Install

```sh
cargo install --path .
```

## Usage

```sh
# 1. Initialize a database from a kernel source tree
kmap init /path/to/linux --output kernel.db

# 2. Parse the source (Kconfig + Makefiles + C source)
kmap parse --db kernel.db

# Parse only specific subsystems
kmap parse --db kernel.db --subsystems net,drivers/net

# 3. Query the database
kmap query callers tcp_sendmsg --db kernel.db
kmap query callees tcp_v4_connect --db kernel.db
kmap query path tcp_sendmsg ip_queue_xmit --db kernel.db
kmap query depends TCP --db kernel.db
kmap query struct sk_buff --db kernel.db
kmap query exports --gpl-only --db kernel.db
kmap query syscall sendto --db kernel.db

# 4. Raw SQL
kmap sql "SELECT name, file_path FROM config_options WHERE type = 'tristate' LIMIT 10" --db kernel.db
kmap sql "SELECT count(*) FROM functions" --db kernel.db
```

## Database Schema

| Table | Contents |
|-------|----------|
| `config_options` | Kconfig symbols with type, prompt, defaults |
| `config_deps` | Dependency expressions (depends_on, select, imply) |
| `subsystems` | Directory-level subsystem mapping |
| `modules` | Build objects from Makefiles with config guards |
| `files` | Source files in the tree |
| `functions` | Function definitions with signatures |
| `calls` | Call edges between functions |
| `exports` | EXPORT_SYMBOL / EXPORT_SYMBOL_GPL |
| `structs` | Struct definitions |
| `symbol_fts` | FTS5 full-text search index |

## Architecture

```
src/
  main.rs          — entry point
  cli/mod.rs       — CLI commands and dispatch
  parser/
    kconfig.rs     — Kconfig file parser
    makefile.rs    — Makefile/Kbuild parser
    c_source.rs    — tree-sitter C parser (functions, calls, structs, exports)
  storage/mod.rs   — SQLite database layer + query engine
```

## Requirements

- Rust 1.70+
- A Linux kernel source tree to analyze

## License

MIT
