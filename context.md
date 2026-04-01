# context.md — Project Truth and Architecture

This file contains current project memory. It is not behavior policy (see `CLAUDE.md`).
It is not verification status (see `WIRING_STATUS.md`).
It is not lessons learned (see `learnings.md`).

**Last updated:** 2026-04-01
**Last verified against code:** 2026-04-01
**Updated by:** human + agent (shared ownership)
**Update timing:** immediate when architecture, boundaries, or invariants change
**Conflict rule:** code and evidence win over stale docs

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

## 4. Boundary Catalog

Specific boundary instances in this project. Future agents should check these when touching adjacent code.

| Boundary | Source Side | Dest Side | What Crosses | Format | Escaping Required? | Idempotent? | Source of Truth | Last Verified |
|----------|-----------|-----------|-------------|--------|-------------------|-------------|----------------|---------------|
| Parser → Storage insert | `parser::*.rs` structs | `storage::insert_*()` | `Vec<ConfigOption>`, `Vec<MakefileEntry>`, `CSourceData` | Rust structs → SQL params | N/A (parameterized) | Yes (after fix: clears before full re-insert) | Parser struct definitions | 2026-04-01 |
| Storage → CLI query | `storage::query_*()` | `cli::cmd_query()` | `Vec<Vec<String>>` | Positional string vectors | N/A (internal) | Yes (read-only) | SQL query column order | 2026-04-01 |
| DB data → DOT output | `storage::collect_call_graph()` | `cli::render_dot()` | Function names, file paths | String interpolation into DOT | Yes (`dot_escape()`) | N/A | `render_dot()` | 2026-04-01 |
| DB data → HTML output | `storage::collect_call_graph()` | `cli::render_html()` | Function names, file paths | String interpolation into HTML | Yes (`html_escape()`) | N/A | `render_html()` | 2026-04-01 |
| DB data → JSON output | `storage::collect_call_graph()` | `cli::render_json()` | Function names, file paths | serde_json serialization | Yes (automatic via serde) | N/A | `render_json()` | 2026-04-01 |
| User input → FTS5 | CLI `pattern` arg | `storage::search_symbols()` | User search string | FTS5 MATCH syntax | Wrapped in error fallback to LIKE | Yes | `search_symbols()` | 2026-04-01 |
| User input → raw SQL | CLI `query` arg | `storage::raw_query()` | Arbitrary SQL string | Direct passthrough | None (by design, local CLI tool) | Depends on query | `raw_query()` | 2026-04-01 |
| Kernel C files → tree-sitter | File system `.c`/`.h` files | `parser::c_source::parse_file()` | File contents | UTF-8 text → AST | N/A | Yes | tree-sitter-c grammar | 2026-04-01 |
| Incremental clear → re-insert | `storage::clear_file_data()` | `storage::insert_c_source_data()` | File IDs, function/struct/call data | SQL DELETE then INSERT | N/A | Must match scope: delete only caller-owned calls | `clear_file_data()` | 2026-04-01 |

---

## 5. Source of Truth

| Area | Source of truth |
|------|----------------|
| CLI arguments and subcommands | `src/cli/mod.rs` (clap derive structs) |
| Database schema | `Database::init_schema()` in `src/storage/mod.rs:33–152` |
| Parser data types | Struct definitions in each parser module |
| Query logic | `Database` impl methods in `src/storage/mod.rs` |
| Build configuration | `Cargo.toml` |

---

## 6. Current Known Invariants

1. **DB must be initialized before parsing.** `kmap parse` reads `kernel_path` from metadata table; fails if not present.
2. **Parsers are stateless.** They take a path, return data. No side effects beyond file I/O.
3. **Call edge resolution is by name only.** `insert_calls` matches caller/callee by function name (`LIMIT 1`). Intentionally imprecise.
4. **FTS5 stores content (not contentless).** The `symbol_fts` table stores column values and supports both MATCH and regular WHERE queries. Deletes/updates do NOT automatically propagate — FTS must be managed explicitly.
5. **Incremental parsing uses `DefaultHasher`.** Hash values are NOT stable across Rust versions/platforms.
6. **Export insertion silently drops unresolved symbols.** If function name not found, the export row is silently not inserted.
7. **Raw SQL has no guardrails.** `kmap sql` passes arbitrary user SQL to `raw_query`. By design for a local CLI tool.

---

## 7. Behavioral Invariants

Operations that have specific sequencing, idempotency, or safety requirements:

1. **`kmap init` is destructive and idempotent.** `Database::create()` deletes any existing DB file and creates fresh. Safe to run repeatedly, but destroys all existing data.
2. **`kmap parse` is now idempotent on full re-parse.** After the duplicate-data fix, full parse clears existing data before insertion. Running `parse` twice produces the same result as running it once.
3. **`kmap parse` requires `kmap init` first.** Parse reads `kernel_path` from the `metadata` table. If the DB doesn't exist or wasn't initialized, it fails with an error.
4. **`kmap parse --incremental` is additive-with-selective-clear.** Only changed files are cleared and re-inserted. Unchanged files' data is preserved. This means calls FROM unchanged files TO changed files survive (callee-side calls are NOT deleted), but calls FROM changed files are rebuilt.
5. **Incremental mode only applies to C source.** Kconfig and Makefile phases always run unconditionally, clearing and re-inserting their data regardless of the `--incremental` flag.
6. **FTS insertions and deletions must be managed manually.** The `symbol_fts` table uses `content=''` (contentless). No triggers propagate changes. Both `insert_functions`/`insert_structs` (insert path) and `clear_file_data`/`clear_all_c_source_data` (delete path) must explicitly manage FTS.
7. **Query operations are read-only and always safe.** All `query_*` methods, `viz`, `diff`, `stats`, and `sql` (for SELECT) are read-only. `sql` can execute arbitrary SQL including writes — by design.
8. **Hash storage happens after insertion.** File hashes for incremental mode are written to the `files` table after C source data insertion completes. If insertion fails partway, hashes may be stale.

---

## 8. Known Risks / Watch Areas

### High risk:

- **No tests exist.** Zero test functions. Any change is unverified by automated tests.
- **storage/mod.rs is large (~1091 lines).** Must chunk-read. Easy to miss query bugs or schema mismatches.
- **cli/mod.rs is large (~808 lines).** All command handlers in one file.

### Medium risk:

- **FTS index management is manual.** `symbol_fts` uses `content=''`. Both insert and delete paths now handle FTS explicitly (fixed 2026-04-01), but any new data path must also manage FTS manually.
- **DefaultHasher instability.** Hashes in `files.hash` are platform/version-dependent. Could cause false "unchanged" results.
- **Name-only call resolution.** Two functions with the same name in different files → wrong call edges.
- **ExportedSymbol.line_number field is never read** (compiler warning exists).

### Lower risk:

- **Makefile parser skips top-level Makefile.** By design, but top-level build rules are invisible.
- **Kconfig parser is line-based.** May miss complex multi-line constructs or nested conditional blocks.
- **tree-sitter query capture indices are hardcoded.** If query grammar changes, index assumptions break silently.

---

## 9. Current Known State

### What appears wired and working:

- Full parse pipeline: kconfig → makefile → c_source → SQLite insertion
- All query commands: callers, callees, path, depends, struct, exports, syscall, netflow, search
- Visualization: DOT, JSON, HTML output
- Diff between two databases
- Raw SQL passthrough
- Stats command
- Incremental parse (with caveats above)

### What is partial or has caveats:

- FTS index (insert and delete paths now managed; FTS is no longer contentless, but still requires manual handling for any new path)
- Incremental mode (hash instability via `DefaultHasher`, only applies to C source)
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

## 10. Root-Cause Watchpoints

Areas where symptom-only fixes would be especially dangerous:

| Area | Why root-cause matters |
|------|----------------------|
| FTS management on new data paths | FTS desync was fixed (2026-04-01) but any new insert/delete path must explicitly manage `symbol_fts`. The contentless FTS table has no auto-sync. |
| Call edge misresolution | Adding dedup won't fix name-only resolution with `LIMIT 1`. Must decide: accept imprecision or add file-scoped resolution. |
| Silent export drops | Logging is symptom-level. Root cause: macro-defined kernel functions aren't parsed as `function_definition` nodes, so exports for them vanish. |
| DefaultHasher instability | Switching hash algorithm requires migration or forced full re-parse — existing stored hashes would mismatch. |
| tree-sitter capture indices | Hardcoded `c.index == 0`, `1`, `2`, `3`. No named capture validation. |

### Recurring failure shape:

Silent data loss or silent wrong results. The codebase does not panic or error on these — it continues with incomplete/incorrect data. Bugs surface late at query time, not at parse time.

---

## 11. Do Not Confuse With Status

- `context.md` (this file) = **project truth and assumptions**
- `WIRING_STATUS.md` = **evidence-backed verification status**
- `learnings.md` = **reusable lessons and failure patterns**

If they conflict, investigate. Code is the final arbiter.
