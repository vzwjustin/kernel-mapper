# WIRING_STATUS.md — Evidence-Backed Verification Ledger

Last updated: 2026-04-01
Audit scope: Full repository inspection (all 6 source files, Cargo.toml, README, git history)

---

## 1. Executive Verdict

- **Truly complete:** Core parse-and-query pipeline compiles and is structurally wired end-to-end.
- **Partial:** Incremental parsing (FTS desync, hash instability). Export insertion (silent drops). `arch` parameter (accepted, unused). `incremental` flag (C source only).
- **Fake-complete:** Nothing overtly fake, but zero tests means "complete" is structurally plausible, not proven.
- **Broken:** FTS index cannot be cleaned during incremental re-parse. `arch` parameter misleads users.
- **Unproven:** Every runtime path. No test exists. No CI exists. Tool has never been verified in this environment.
- **Blocked:** Nothing blocked by external dependencies. Everything blocked by lack of runtime validation and tests.

---

## 2. Source Inputs

- CLAUDE.md reviewed: yes (created this session)
- context.md reviewed: yes (created this session)
- previous WIRING_STATUS.md reviewed: N/A (did not exist)
- learnings.md reviewed: N/A (did not exist)
- git history consulted: yes (3 commits: `dad5645`, `34dc3ed`, `bd067f3`)
- README.md reviewed: yes
- Cargo.toml reviewed: yes
- Contradictions found: README claims features that are structurally present but runtime-unverified. `arch` parameter documented as functional but is not wired.

---

## 3. Subsystem Inventory

### 3.1 CLI (`src/cli/mod.rs`)
- **Purpose:** Define CLI args via clap derive, dispatch to command handlers
- **Key files:** `src/cli/mod.rs` (808 lines)
- **Entry points:** `Cli::parse()` → `dispatch(cli)`
- **Boundaries crossed:** Calls into `parser::*` and `storage::Database`
- **Status:** PARTIAL (all commands wired, but `arch` param unused, `incremental` partial)
- **Confidence:** MEDIUM — compiles, all match arms present, but zero runtime proof

### 3.2 Kconfig Parser (`src/parser/kconfig.rs`)
- **Purpose:** Parse Kconfig files into `Vec<ConfigOption>`
- **Key files:** `src/parser/kconfig.rs` (197 lines)
- **Entry points:** `parse_all(kernel_path)`
- **Boundaries crossed:** Output consumed by `Database::insert_config_options()`
- **Status:** COMPLETE (structurally)
- **Confidence:** MEDIUM — line-based parser may miss edge cases

### 3.3 Makefile Parser (`src/parser/makefile.rs`)
- **Purpose:** Parse Makefile/Kbuild files into `Vec<MakefileEntry>`
- **Key files:** `src/parser/makefile.rs` (133 lines)
- **Entry points:** `parse_all(kernel_path, subsystems)`
- **Boundaries crossed:** Output consumed by `Database::insert_makefile_entries()`
- **Status:** COMPLETE (structurally)
- **Confidence:** MEDIUM — regex-based, handles common patterns

### 3.4 C Source Parser (`src/parser/c_source.rs`)
- **Purpose:** Parse C files via tree-sitter into `CSourceData`
- **Key files:** `src/parser/c_source.rs` (373 lines)
- **Entry points:** `parse_all(kernel_path, subsystems, progress)`
- **Boundaries crossed:** Output consumed by `Database::insert_c_source_data()`
- **Status:** PARTIAL
- **Confidence:** LOW — export extraction uses regex outside tree-sitter; call extraction uses hardcoded capture indices; struct field extraction may miss complex declarators

### 3.5 Storage / Database (`src/storage/mod.rs`)
- **Purpose:** SQLite schema creation, data insertion, all query methods
- **Key files:** `src/storage/mod.rs` (1091 lines)
- **Entry points:** `Database::create()`, `Database::open()`, then method calls
- **Boundaries crossed:** Consumes parser output; queried by CLI
- **Status:** PARTIAL (FTS desync, silent export drops, hash instability)
- **Confidence:** MEDIUM for insertion, LOW for incremental mode

### 3.6 Entry Point (`src/main.rs`)
- **Purpose:** Initialize logger, parse CLI, dispatch
- **Key files:** `src/main.rs` (13 lines)
- **Status:** COMPLETE
- **Confidence:** HIGH — trivial, no logic to break

---

## 4. Reachability Chains

### 4.1 Init Chain
```
main() → Cli::parse() → dispatch() → cmd_init()
  → kernel_path.canonicalize()
  → check Kconfig exists
  → Database::create() → init_schema() [DDL]
  → set_metadata("kernel_path", ...)
  → set_metadata("version", ...)
```
**Status:** COMPLETE. Linear and simple.

### 4.2 Parse Chain
```
main() → dispatch() → cmd_parse()
  → Database::open() → get_metadata("kernel_path")
  → parser::kconfig::parse_all() → insert_config_options()
  → parser::makefile::parse_all() → insert_makefile_entries()
  → parser::c_source::parse_all() → insert_c_source_data()
    → insert_functions() [+ FTS insert]
    → insert_structs() [+ FTS insert]
    → insert_exports() [name-only lookup, silent drop]
    → insert_calls() [name-only resolution, LIMIT 1]
  → (if incremental) hash comparison, clear_file_data, filtered re-insert
```
**Status:** PARTIAL.
- Full parse path: structurally complete but runtime-unproven.
- Incremental path: FTS not cleared in `clear_file_data`, `DefaultHasher` unstable.
- `arch` param: accepted, printed, never consumed.

### 4.3 Query Chain (all query types)
```
main() → dispatch() → cmd_query() → QueryKind::*
  → Database::open()
  → db.query_*() → SQL JOIN/BFS → Vec<Vec<String>>
  → formatted print
```
**Status:** COMPLETE structurally. Same pattern for all query kinds.

### 4.4 Viz Chain
```
main() → dispatch() → cmd_viz()
  → Database::open()
  → db.collect_call_graph() [BFS]
  → render_dot/render_json/render_html
  → write to file or stdout
```
**Status:** COMPLETE structurally.

### 4.5 Diff Chain
```
main() → dispatch() → cmd_diff()
  → Database::open(db1), Database::open(db2)
  → all_function_names/config_names/struct_names/export_names
  → set difference → formatted print
```
**Status:** COMPLETE structurally.

---

## 5. Fix Verification Table

No claimed fixes exist. The repo has 3 initial development commits. No bugs have been "fixed" — codebase is in its initial shipped state.

| Commit | Description | Verified? |
|--------|-------------|-----------|
| `dad5645` | Initial release | NOT PROVEN (no tests, no runtime proof) |
| `34dc3ed` | Add viz, diff, incremental, netflow | NOT PROVEN |
| `bd067f3` | Add struct fields, search, stats | NOT PROVEN |

---

## 6. Surfaced Issue Classification

| # | Issue | Classification | Evidence | Blocks verification? | Blocks completion? |
|---|-------|---------------|----------|---------------------|-------------------|
| 1 | `ExportedSymbol.line_number` never read | PRE-EXISTING BUT NOW BLOCKING | `cargo check` emits warning | Yes (warning) | No |
| 2 | FTS index not cleaned in `clear_file_data` | PRE-EXISTING BUT NOW BLOCKING | `storage/mod.rs:894–922` — no `symbol_fts` delete | Yes (data correctness) | No |
| 3 | `DefaultHasher` not stable across Rust versions | PRE-EXISTING | `cli/mod.rs:246–248` | No (only affects incremental) | No |
| 4 | Export insertion silently drops unresolved | PRE-EXISTING BUT NOW BLOCKING | `storage/mod.rs:339–353` | No (silent) | No |
| 5 | Zero tests in entire codebase | PRE-EXISTING BUT NOW BLOCKING | `cargo test` runs 0 tests | Yes | No |
| 6 | `arch` parameter accepted but unused | PRE-EXISTING | `cli/mod.rs:39–40` defined, never passed to parsers | No | No |
| 7 | `incremental` only applies to C source | PRE-EXISTING | `cli/mod.rs:228–336` | No | No |

---

## 7. Root-Cause / What-If Findings

### 7.1 FTS Desync During Incremental Parse
- **5 Whys:** Stale FTS entries → `clear_file_data` omits `symbol_fts` → `symbol_fts` uses `content=''` (contentless) → contentless FTS doesn't auto-sync via triggers → FTS was designed for insert-only full parse, not incremental.
- **Confirmed:** `clear_file_data` omits `symbol_fts`.
- **Suspected:** Author planned FTS as insert-only for full re-parse.
- **What If:** Incremental + search = stale results mixing old and new symbols.
- **Fix level needed:** Root-cause (add FTS cleanup or switch to content-backed FTS).

### 7.2 Silent Export Drops
- **5 Whys:** Exports missing → `insert_exports` does `SELECT ... WHERE f.name = ?1 LIMIT 1` → zero rows → silent skip → function defined via macro → tree-sitter only matches `function_definition` nodes.
- **Confirmed:** No row-count check in `insert_exports`.
- **Suspected:** Macro-defined kernel functions (common in Linux) systematically missed.
- **What If:** Significant fraction of kernel exports silently absent from DB.
- **Fix level needed:** Symptom = log warning. Root-cause = extract macro-defined symbols too.

### 7.3 Name-Only Call Resolution
- **5 Whys:** Wrong call edges → name-only `LIMIT 1` → name collisions across files → no file-scoped resolution.
- **Confirmed:** Code comment at `storage/mod.rs:358–359` says "imprecise but useful for exploration."
- **What If:** `kmap query path` returns paths through wrong files. Viz shows misleading graphs.
- **Fix level needed:** Intentional design tradeoff. Root-cause fix = file-scoped resolution.

---

## 8. Build / Registration / Inclusion Proof

### Build proof:
- `cargo check` passes with 1 warning. **PROVEN.**
- All 6 source files included via `mod` declarations. **PROVEN.**

### Registration proof:
- All `Command` enum variants handled in `dispatch()`. **PROVEN** — exhaustive match.
- All `QueryKind` variants handled in `cmd_query()`. **PROVEN** — exhaustive match.
- All `VizFormat` and `VizDirection` variants used. **PROVEN.**

### Dependency proof:
- All Cargo.toml dependencies used in source code. **PROVEN** via `use` statements.

### Feature-flag proof:
- `rusqlite/backup` feature enabled but no backup code exists. **CONTRADICTED** — feature present but unused.

---

## 9. Contract and Invariant Check

| Contract | Status | Evidence |
|----------|--------|----------|
| Parser structs match DB insertion params | PROVEN | Field-by-field match in `insert_*` methods |
| DB schema column names match SQL queries | PARTIALLY PROVEN | Spot-checked major queries |
| CLI arg names match handler usage | PROVEN | Destructured from clap structs |
| `arch` parameter contract | CONTRADICTED | Accepted by CLI, printed, but never consumed by parsers |
| Query return types match CLI format expectations | PROVEN | CLI indexes into vecs matching query column order |

---

## 10. Missing or Incomplete Wiring

| Gap | Location | Severity |
|-----|----------|----------|
| `symbol_fts` not cleaned during `clear_file_data` | `storage/mod.rs:894–922` | HIGH |
| `ExportedSymbol.line_number` defined but never read | `parser/c_source.rs:32` | LOW |
| No row-count check after export insertion | `storage/mod.rs:339–353` | MEDIUM |
| `rusqlite/backup` feature enabled but unused | `Cargo.toml:10` | LOW |
| `arch` parameter accepted but never passed to parsers | `cli/mod.rs:39–40, 147, 199` | MEDIUM |
| `incremental` only applies to C source, not Kconfig/Makefile | `cli/mod.rs:228–336` | MEDIUM |

---

## 11. Stub / Dead Code Report

| Item | Location | Type |
|------|----------|------|
| `ExportedSymbol.line_number` | `parser/c_source.rs:32` | Dead field (written, never read) |
| `arch` CLI parameter | `cli/mod.rs:39–40` | Accepted but unused |
| `rusqlite/backup` feature | `Cargo.toml:10` | Feature enabled, no code uses it |
| `incremental` for Kconfig/Makefile | `cli/mod.rs:201–202` | Flag printed but not functionally applied |

No TODO-backed critical paths. No no-op handlers. No placeholder returns. No fake success paths.

---

## 12. Verified Working

- `cargo check` compiles (1 warning). **PROVEN.**
- All `Command` variants handled in `dispatch()`. **PROVEN.**
- All `QueryKind` variants handled in `cmd_query()`. **PROVEN.**
- Module structure resolves. **PROVEN.**
- Parser output types match storage insertion methods. **PROVEN.**

---

## 13. Verified Partial

- **Incremental parsing:** Only C source files incrementally filtered. Kconfig/Makefile always fully re-parsed.
- **FTS index:** Insertions work, no delete/cleanup path for incremental.
- **Export insertion:** Works for resolved function names. Silently drops others.
- **`arch` parameter:** Accepted, printed, not consumed.

---

## 14. Verified Broken

- **FTS cleanup during incremental re-parse:** `clear_file_data` does not touch `symbol_fts`. Stale entries accumulate. **BROKEN.**
- **`arch` parameter wiring:** Accepted by CLI, printed, never passed to parsers. **BROKEN** (misleading UX).

---

## 15. Blocked

Nothing blocked by external factors. All issues are internal and fixable.

---

## 16. Not Proven

- Every runtime path (no kernel tree available to test against).
- Correctness of any query output.
- Correctness of tree-sitter extraction on real kernel source.
- Correctness of Kconfig/Makefile parsing on real kernel source.
- Correctness of BFS call-path traversal.
- Correctness of visualization output.
- Correctness of diff comparison.

---

## 17. Needs Runtime Validation

1. `kmap init /path/to/linux` against a real kernel tree.
2. `kmap parse --db test.db` — verify counts are plausible.
3. `kmap query callers <known_function>` — verify results.
4. `kmap query path <fn1> <fn2>` — verify path is correct.
5. `kmap query struct sk_buff` — verify fields.
6. `kmap viz <function>` — verify DOT/JSON/HTML output.
7. `kmap diff db1.db db2.db` across two kernel versions.
8. `kmap parse --incremental` — verify FTS is not stale.

---

## 18. Highest-Value Next Actions

1. **Add basic tests.** Even unit tests for parsers against fixture files would massively increase confidence.
2. **Fix FTS desync.** Add `symbol_fts` cleanup to `clear_file_data`.
3. **Fix `arch` parameter.** Wire it into parsers or remove from CLI.
4. **Fix dead `line_number` field.** Use it or remove it. Eliminates compiler warning.
5. **Add runtime smoke test.** Parse a small C file and verify DB contents.
6. **Audit all SQL strings.** Verify column names match schema across all ~30 SQL statements.
7. **Consider stable hashing.** Replace `DefaultHasher` for incremental mode.
8. **Add export insertion logging.** Warn when export's function name not found.

---

## 19. Evidence Appendix

### E1: Dead field warning
- **File:** `src/parser/c_source.rs:32`
- **Symbol:** `ExportedSymbol.line_number`
- **Evidence:** `cargo check` output: `warning: field 'line_number' is never read`

### E2: FTS cleanup gap
- **File:** `src/storage/mod.rs:894–922`
- **Symbol:** `clear_file_data()`
- **Evidence:** Deletes from `calls`, `exports`, `functions`, `structs` — no `DELETE FROM symbol_fts`.

### E3: Silent export drops
- **File:** `src/storage/mod.rs:339–353`
- **Symbol:** `insert_exports()`
- **Evidence:** `INSERT INTO exports ... SELECT f.id ... WHERE f.name = ?1 LIMIT 1` — zero rows = silent skip.

### E4: Unused `arch` parameter
- **File:** `src/cli/mod.rs:39–40` (definition), `src/cli/mod.rs:147` (destructured), `src/cli/mod.rs:199` (printed)
- **Evidence:** Grep for `arch` in parser files returns zero results.

### E5: Incremental only for C source
- **File:** `src/cli/mod.rs:228–336`
- **Evidence:** Hash comparison only runs inside C source block. Kconfig/Makefile phases always run unconditionally.

### E6: `rusqlite/backup` feature unused
- **File:** `Cargo.toml:10`
- **Evidence:** Grep for `backup` in source returns zero results outside Cargo files.
