# context.md — Project Truth and Architecture

This file contains current project memory. It is not behavior policy (see `CLAUDE.md`).
It is not verification status (see `WIRING_STATUS.md`).
It is not lessons learned (see `learnings.md`).

---

## 1. Project Overview

**kmap** is a Rust CLI tool that parses Linux kernel source trees and builds a queryable SQLite database. It extracts:

- Kconfig options and dependency expressions
- Makefile/Kbuild object rules and config guards
- C source: function definitions, call graphs, struct definitions, exported symbols

It supports queries: callers/callees, call paths (BFS), config dependencies, struct field inspection, exported symbols, syscall lookup, protocol-specific netflow tracing, full-text search (FTS5), raw SQL, call-graph visualization (DOT/JSON/HTML), and database diffing across kernel versions.

**Binary name:** `kmap`
**Crate name:** `kmap`
**License:** MIT

---

## 2. Repo Shape

```
kernel-mapper/
├── Cargo.toml          # single-crate Rust project
├── Cargo.lock
├── README.md
├── .gitignore
└── src/
    ├── main.rs          # entry point: env_logger init, clap parse, dispatch
    ├── cli/mod.rs       # CLI definitions (clap derive) + all command handlers (~808 lines)
    ├── parser/
    │   ├── mod.rs       # re-exports: c_source, kconfig, makefile
    │   ├── kconfig.rs   # Kconfig file parser (line-based, rayon parallel)
    │   ├── makefile.rs  # Makefile/Kbuild parser (regex-based, rayon parallel)
    │   └── c_source.rs  # C source parser (tree-sitter, rayon parallel)
    └── storage/
        └── mod.rs       # SQLite database layer + all query methods (~1091 lines)
```

**Total Rust:** ~2604 lines across 6 source files.
**Not a monorepo.** Single crate, no workspaces.

### Key dependencies (Cargo.toml):

| Crate | Purpose |
|-------|---------|
| clap 4 (derive) | CLI argument parsing |
| rusqlite 0.31 (bundled) | SQLite database |
| tree-sitter 0.22 + tree-sitter-c 0.21 | C source parsing (AST) |
| rayon 1.10 | Parallel file processing |
| walkdir 2 | Recursive directory traversal |
| anyhow 1 | Error handling |
| regex 1 | Makefile + export pattern matching |
| serde + serde_json 1 | JSON output for viz/queries |
| indicatif 0.17 | Progress bars |
| log + env_logger | Logging |

---

## 3. Architectural Boundaries

### Layer structure:

```
CLI (cli/mod.rs)
  ↓ dispatches to
Parsers (parser/*.rs)     ← produce data structs
  ↓ consumed by
Storage (storage/mod.rs)  ← SQLite insert + query layer
```

### Data flow:

1. `kmap init` — creates empty SQLite DB, stores kernel path as metadata.
2. `kmap parse` — walks kernel tree, calls parsers in phases, inserts results into DB.
3. `kmap query *` — reads from DB, formats output.
4. `kmap viz` — reads call graph from DB, renders DOT/JSON/HTML.
5. `kmap diff` — opens two DBs, compares symbol sets.
6. `kmap sql` — passes raw SQL to DB.
7. `kmap stats` — queries row counts from all tables.

### Key boundaries:

- **Parser → Storage:** Parsers produce `Vec<ConfigOption>`, `Vec<MakefileEntry>`, `CSourceData`. Storage consumes via `insert_*` methods.
- **CLI → Storage:** CLI calls `Database::open()` then query methods returning `Vec<Vec<String>>`.
- **No shared mutable state.** Each command opens its own DB connection.
- **No async.** Synchronous with rayon for file-level parallelism.

---

## 4. Source of Truth

| Area | Source of truth |
|------|----------------|
| CLI arguments and subcommands | `src/cli/mod.rs` (clap derive structs) |
| Database schema | `Database::init_schema()` in `src/storage/mod.rs:33–152` |
| Parser data types | Struct definitions in each parser module |
| Query logic | `Database` impl methods in `src/storage/mod.rs` |
| Build configuration | `Cargo.toml` |

---

## 5. Current Known Invariants

1. **DB must be initialized before parsing.** `kmap parse` reads `kernel_path` from metadata table; fails if not present.
2. **Parsers are stateless.** They take a path, return data. No side effects beyond file I/O.
3. **Call edge resolution is by name only.** `insert_calls` matches caller/callee by function name (`LIMIT 1`). Intentionally imprecise.
4. **FTS5 uses content='' (contentless).** Insertions work but the FTS index is disconnected from actual tables. Deletes/updates do NOT automatically update FTS.
5. **Incremental parsing uses `DefaultHasher`.** Hash values are NOT stable across Rust versions/platforms.
6. **Export insertion silently drops unresolved symbols.** If function name not found, the export row is silently not inserted.
7. **Raw SQL has no guardrails.** `kmap sql` passes arbitrary user SQL to `raw_query`. By design for a local CLI tool.

---

## 6. Known Risks / Watch Areas

### High risk:

- **No tests exist.** Zero test functions. Any change is unverified by automated tests.
- **storage/mod.rs is large (~1091 lines).** Must chunk-read. Easy to miss query bugs or schema mismatches.
- **cli/mod.rs is large (~808 lines).** All command handlers in one file.

### Medium risk:

- **FTS index desync.** `clear_file_data` deletes from `functions`, `structs`, `calls`, `exports` — but NOT from `symbol_fts`. Incremental re-parse leaves stale FTS entries.
- **DefaultHasher instability.** Hashes in `files.hash` are platform/version-dependent. Could cause false "unchanged" results.
- **Name-only call resolution.** Two functions with the same name in different files → wrong call edges.
- **ExportedSymbol.line_number field is never read** (compiler warning exists).

### Lower risk:

- **Makefile parser skips top-level Makefile.** By design, but top-level build rules are invisible.
- **Kconfig parser is line-based.** May miss complex multi-line constructs or nested conditional blocks.
- **tree-sitter query capture indices are hardcoded.** If query grammar changes, index assumptions break silently.

---

## 7. Current Known State

### What appears wired and working:

- Full parse pipeline: kconfig → makefile → c_source → SQLite insertion
- All query commands: callers, callees, path, depends, struct, exports, syscall, netflow, search
- Visualization: DOT, JSON, HTML output
- Diff between two databases
- Raw SQL passthrough
- Stats command
- Incremental parse (with caveats above)

### What is partial or has caveats:

- FTS index (insertions work, but no delete/update sync)
- Incremental mode (hash instability, FTS desync)
- Call edge resolution (name-only, imprecise)
- Export insertion (silent drops for unresolved names)
- `arch` CLI parameter (accepted but unused by parsers)
- `incremental` flag (only applies to C source, not Kconfig/Makefile)

### What is absent:

- Tests (zero)
- CI/CD
- Benchmarks
- Documentation beyond README
- Input validation on raw SQL

---

## 8. Root-Cause Watchpoints

Areas where symptom-only fixes would be especially dangerous:

| Area | Why root-cause matters |
|------|----------------------|
| FTS desync during incremental | A "fix" that only re-inserts without clearing stale entries compounds the problem. Root cause: `clear_file_data` doesn't touch `symbol_fts`. |
| Call edge misresolution | Adding dedup won't fix name-only resolution with `LIMIT 1`. Must decide: accept imprecision or add file-scoped resolution. |
| Silent export drops | Logging is symptom-level. Root cause: macro-defined kernel functions aren't parsed as `function_definition` nodes, so exports for them vanish. |
| DefaultHasher instability | Switching hash algorithm requires migration or forced full re-parse — existing stored hashes would mismatch. |
| tree-sitter capture indices | Hardcoded `c.index == 0`, `1`, `2`, `3`. No named capture validation. |

### Recurring failure shape:

Silent data loss or silent wrong results. The codebase does not panic or error on these — it continues with incomplete/incorrect data. Bugs surface late at query time, not at parse time.

---

## 9. Do Not Confuse With Status

- `context.md` (this file) = **project truth and assumptions**
- `WIRING_STATUS.md` = **evidence-backed verification status**
- `learnings.md` = **reusable lessons and failure patterns**

If they conflict, investigate. Code is the final arbiter.
