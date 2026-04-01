# learnings.md — Reusable Lessons and Failure Patterns

This file captures transferable lessons. It is not current project state (see `context.md`),
not verification status (see `WIRING_STATUS.md`), and not behavior rules (see `CLAUDE.md`).

Only add lessons likely to matter again. Write as reusable guidance, not diary entries.

---

## 1. Recurring Failure Patterns

### 1.1 Silent Data Loss Is the Default Failure Mode
- **Pattern:** Operations that silently produce zero results instead of erroring (e.g., `INSERT...SELECT` returning 0 rows, `LIMIT 1` picking the wrong match, contentless FTS losing sync).
- **Lesson:** In this codebase, assume any data pipeline step can silently drop or corrupt data. Always verify row counts, result plausibility, and index consistency — not just "did it run without panic."
- **Applies to:** Any insert, update, or delete operation in `storage/mod.rs`. Any parser output that feeds insertion.

### 1.2 "Flag Accepted" ≠ "Flag Wired"
- **Pattern:** CLI parameter is defined in clap, accepted by the parser, even printed to console — but never actually consumed by the logic it claims to control.
- **Example:** `--arch` parameter. `--incremental` for Kconfig/Makefile.
- **Lesson:** Always trace a CLI flag from definition → destructure → actual consumption in logic. Console printing is not proof of wiring.

### 1.3 Incremental Paths Are Partial By Default
- **Pattern:** A feature claims "incremental" behavior but only applies to one subsystem out of several.
- **Lesson:** When auditing incremental/partial-update features, check every phase independently. Do not assume one working phase means all phases work.

---

## 2. Dangerous Assumptions

### 2.1 "Compiles" ≠ "Correct"
- **Reality:** This repo compiles cleanly (1 warning). But every runtime path is unproven. Zero tests.
- **Lesson:** Never treat compilation as evidence of correctness. It only proves type-level consistency.

### 2.2 "Name Uniqueness" in Kernel Source
- **Reality:** The Linux kernel has many functions with the same name across different files. Name-only resolution with `LIMIT 1` picks arbitrarily.
- **Lesson:** Any feature relying on function name uniqueness will produce wrong results on large codebases with name collisions.

### 2.3 "FTS5 content='' Is Read-Only After Insert"
- **Reality:** Contentless FTS tables can be manually deleted from, but they don't auto-sync with source tables. There are no triggers.
- **Lesson:** If you use contentless FTS, you must manage all inserts AND deletes manually. Do not assume any other table operation will propagate.

---

## 3. Verification Lessons

### 3.1 Compiler Warnings Are Real Signals
- **Example:** `ExportedSymbol.line_number` is never read. This isn't noise — it reveals an incomplete contract between the parser and storage layer. The field is populated but never consumed.
- **Lesson:** Treat compiler warnings as wiring signals, not cosmetic issues. A "never read" warning often means a data flow path is broken or incomplete.

### 3.2 Zero Tests Means Every Claim Is Unproven
- **Lesson:** When a repo has zero tests, every "works" claim in docs or commit messages is structurally plausible at best. Do not upgrade plausible to proven without evidence.

### 3.3 Check Feature Flags Against Actual Code
- **Example:** `rusqlite/backup` feature is enabled in `Cargo.toml` but no backup code exists.
- **Lesson:** Feature flags in build config must be verified against actual usage. Enabled ≠ used.

---

## 4. Refactor Lessons

### 4.1 Large Single-File Modules Are Risky
- **Reality:** `storage/mod.rs` (1091 lines) and `cli/mod.rs` (808 lines) contain all logic for their domains.
- **Lesson:** When editing large modules, always chunk-read to ensure you've seen the relevant sections. Do not edit based on partial reads of a 1000+ line file.

### 4.2 Adding a CLI Command Requires Both Sides
- **Pattern:** Adding a new `Command` variant requires: (1) clap derive definition, (2) `dispatch()` match arm, (3) handler function, (4) any new `Database` methods. Missing any one creates a compile error (good) or a runtime gap (bad, if it compiles but doesn't work).
- **Lesson:** Trace new features through all layers: CLI → parser/storage → output formatting.

---

## 5. Search Lessons

### 5.1 `mod.rs` Re-Exports Hide True Locations
- **Reality:** `src/parser/mod.rs` re-exports `c_source`, `kconfig`, `makefile`. Searching for a type definition may find the re-export, not the actual definition.
- **Lesson:** When searching for definitions, always check the actual source file, not just the `mod.rs` re-export.

### 5.2 SQL Strings Are Invisible to Type Checking
- **Reality:** ~30 SQL strings in `storage/mod.rs` reference table/column names. A schema change that renames a column will not be caught by `cargo check` — only by runtime failure.
- **Lesson:** After any schema change, grep all SQL strings for affected table/column names. The compiler won't help here.

---

## 6. Scope / Relatedness Lessons

### 6.1 Parser Changes Can Break Storage Silently
- **Pattern:** Changing a parser struct field (e.g., renaming `file_path` to `path`) will break the corresponding `insert_*` method — but only if the field is accessed by name, not by position. Since rusqlite uses positional `params![]`, a struct field rename won't cause a compile error if the field order stays the same.
- **Lesson:** Parser struct changes require checking all `insert_*` methods in storage, even if the code compiles.

### 6.2 FTS Changes Require Separate Verification
- **Pattern:** Modifying `insert_functions` or `insert_structs` without updating corresponding `symbol_fts` operations.
- **Lesson:** FTS is a parallel data path. Any change to primary table insertion must be checked against FTS insertion. Any change to primary table deletion must be checked against FTS deletion (currently missing).

---

## 7. Root-Cause Lessons

### 7.1 Symptom: "Query Returns Empty." Root Cause: Usually Silent Drop
- **Heuristic:** When a query returns empty results for something that should exist, the first place to check is the insertion path — was the data silently dropped during parse or insert?
- **Applies to:** Exports (name not found), calls (name not resolved), any data that passes through a `SELECT...WHERE name = ?1 LIMIT 1` filter.

### 7.2 Symptom: "Stale Search Results." Root Cause: FTS Desync
- **Heuristic:** If search returns results that shouldn't exist (deleted/changed symbols), check whether FTS cleanup runs alongside primary table cleanup.

---

## 8. Practical Heuristics

1. **Always check both sides of a boundary.** Parser struct ↔ storage insert. Schema DDL ↔ SQL queries. CLI definition ↔ handler logic.
2. **After any storage/schema change, grep all SQL strings.** The compiler cannot catch SQL column mismatches.
3. **After any parser struct change, check all `insert_*` and `query_*` methods.** Positional `params![]` won't catch field reordering.
4. **Treat `LIMIT 1` as a code smell.** It means ambiguous resolution was accepted. Check whether ambiguity matters for the use case.
5. **Treat "no error" as insufficient.** In this codebase, most failures are silent. Verify data presence, not just absence of errors.
6. **After incremental-mode changes, verify all phases.** Incremental currently only applies to C source. Do not assume other phases are affected.
7. **After FTS-related changes, verify both insert and delete paths.** They are not symmetric — deletes are currently missing.
