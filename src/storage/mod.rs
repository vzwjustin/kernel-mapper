use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::{params, Connection};

use crate::parser::c_source::{CSourceData, ExportedSymbol, FunctionDef, StructDef, CallEdge};
use crate::parser::kconfig::ConfigOption;
use crate::parser::makefile::MakefileEntry;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn create(path: &Path) -> Result<Self> {
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        let conn = Connection::open(path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn open(path: &Path) -> Result<Self> {
        if !path.exists() {
            anyhow::bail!("Database not found: {}", path.display());
        }
        let conn = Connection::open(path)?;
        Ok(Database { conn })
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;

            -- Metadata key-value store
            CREATE TABLE IF NOT EXISTS metadata (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- Kconfig options
            CREATE TABLE IF NOT EXISTS config_options (
                id          INTEGER PRIMARY KEY,
                name        TEXT NOT NULL UNIQUE,
                type        TEXT,          -- bool, tristate, string, int, hex
                prompt      TEXT,
                default_val TEXT,
                help        TEXT,
                file_path   TEXT NOT NULL,
                line_number INTEGER
            );

            -- Config dependencies (select, depends on, imply)
            CREATE TABLE IF NOT EXISTS config_deps (
                id        INTEGER PRIMARY KEY,
                config_id INTEGER NOT NULL REFERENCES config_options(id),
                dep_type  TEXT NOT NULL,   -- depends_on, select, imply
                expr      TEXT NOT NULL
            );

            -- Subsystems / directories
            CREATE TABLE IF NOT EXISTS subsystems (
                id   INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                path TEXT NOT NULL
            );

            -- Kernel modules (from Makefile obj-m/obj-y)
            CREATE TABLE IF NOT EXISTS modules (
                id           INTEGER PRIMARY KEY,
                name         TEXT NOT NULL,
                object_file  TEXT NOT NULL,
                build_type   TEXT NOT NULL,  -- built-in, module, conditional
                config_guard TEXT,           -- CONFIG_FOO that gates this
                subsystem_id INTEGER REFERENCES subsystems(id),
                file_path    TEXT NOT NULL
            );

            -- Files in the source tree
            CREATE TABLE IF NOT EXISTS files (
                id        INTEGER PRIMARY KEY,
                path      TEXT NOT NULL UNIQUE,
                subsystem_id INTEGER REFERENCES subsystems(id),
                hash      TEXT
            );

            -- Functions (populated in Phase 2)
            CREATE TABLE IF NOT EXISTS functions (
                id          INTEGER PRIMARY KEY,
                name        TEXT NOT NULL,
                file_id     INTEGER REFERENCES files(id),
                line_number INTEGER,
                is_static   INTEGER DEFAULT 0,
                return_type TEXT,
                signature   TEXT
            );

            -- Call edges (populated in Phase 2)
            CREATE TABLE IF NOT EXISTS calls (
                id        INTEGER PRIMARY KEY,
                caller_id INTEGER NOT NULL REFERENCES functions(id),
                callee_id INTEGER NOT NULL REFERENCES functions(id),
                line_number INTEGER
            );

            -- Exported symbols (populated in Phase 2)
            CREATE TABLE IF NOT EXISTS exports (
                id          INTEGER PRIMARY KEY,
                function_id INTEGER NOT NULL REFERENCES functions(id),
                is_gpl      INTEGER DEFAULT 0
            );

            -- Structs (populated in Phase 2)
            CREATE TABLE IF NOT EXISTS structs (
                id          INTEGER PRIMARY KEY,
                name        TEXT NOT NULL,
                file_id     INTEGER REFERENCES files(id),
                line_number INTEGER
            );

            -- FTS5 for full-text search across symbols
            CREATE VIRTUAL TABLE IF NOT EXISTS symbol_fts USING fts5(
                name, kind, file_path,
                content='',
                tokenize='porter'
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_config_name ON config_options(name);
            CREATE INDEX IF NOT EXISTS idx_modules_config ON modules(config_guard);
            CREATE INDEX IF NOT EXISTS idx_functions_name ON functions(name);
            CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
            CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id);
            CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
            ",
        )?;
        Ok(())
    }

    pub fn set_metadata(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_metadata(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM metadata WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        match rows.next()? {
            Some(row) => Ok(Some(row.get(0)?)),
            None => Ok(None),
        }
    }

    pub fn insert_config_options(&self, options: &[ConfigOption]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut insert_opt = tx.prepare(
                "INSERT OR IGNORE INTO config_options (name, type, prompt, default_val, help, file_path, line_number)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )?;
            let mut insert_dep = tx.prepare(
                "INSERT INTO config_deps (config_id, dep_type, expr)
                 VALUES (?1, ?2, ?3)",
            )?;

            for opt in options {
                insert_opt.execute(params![
                    opt.name,
                    opt.config_type,
                    opt.prompt,
                    opt.default_val,
                    opt.help,
                    opt.file_path,
                    opt.line_number,
                ])?;

                let config_id = tx.last_insert_rowid();
                if config_id == 0 {
                    continue;
                }

                for dep in &opt.depends_on {
                    insert_dep.execute(params![config_id, "depends_on", dep])?;
                }
                for sel in &opt.selects {
                    insert_dep.execute(params![config_id, "select", sel])?;
                }
                for imp in &opt.implies {
                    insert_dep.execute(params![config_id, "imply", imp])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn insert_makefile_entries(&self, entries: &[MakefileEntry]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut insert_sub = tx.prepare(
                "INSERT OR IGNORE INTO subsystems (name, path) VALUES (?1, ?2)",
            )?;
            let mut get_sub = tx.prepare(
                "SELECT id FROM subsystems WHERE path = ?1",
            )?;
            let mut insert_mod = tx.prepare(
                "INSERT INTO modules (name, object_file, build_type, config_guard, subsystem_id, file_path)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )?;

            for entry in entries {
                insert_sub.execute(params![entry.subsystem, entry.makefile_path])?;
                let sub_id: i64 = get_sub.query_row(params![entry.makefile_path], |r| r.get(0))?;

                for obj in &entry.objects {
                    let mod_name = obj
                        .object_file
                        .trim_end_matches(".o")
                        .rsplit('/')
                        .next()
                        .unwrap_or(&obj.object_file);
                    insert_mod.execute(params![
                        mod_name,
                        obj.object_file,
                        obj.build_type,
                        obj.config_guard,
                        sub_id,
                        entry.makefile_path,
                    ])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn insert_c_source_data(&self, data: &CSourceData) -> Result<()> {
        self.insert_functions(&data.functions)?;
        self.insert_structs(&data.structs)?;
        self.insert_exports(&data.exports)?;
        self.insert_calls(&data.calls)?;
        Ok(())
    }

    fn insert_functions(&self, functions: &[FunctionDef]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut insert_file = tx.prepare(
                "INSERT OR IGNORE INTO files (path) VALUES (?1)",
            )?;
            let mut get_file = tx.prepare(
                "SELECT id FROM files WHERE path = ?1",
            )?;
            let mut insert_fn = tx.prepare(
                "INSERT INTO functions (name, file_id, line_number, is_static, return_type, signature)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )?;
            let mut insert_fts = tx.prepare(
                "INSERT INTO symbol_fts (name, kind, file_path) VALUES (?1, 'function', ?2)",
            )?;

            for func in functions {
                insert_file.execute(params![func.file_path])?;
                let file_id: i64 = get_file.query_row(params![func.file_path], |r| r.get(0))?;
                insert_fn.execute(params![
                    func.name,
                    file_id,
                    func.line_number,
                    func.is_static as i32,
                    func.return_type,
                    func.signature,
                ])?;
                insert_fts.execute(params![func.name, func.file_path])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn insert_structs(&self, structs: &[StructDef]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut insert_file = tx.prepare(
                "INSERT OR IGNORE INTO files (path) VALUES (?1)",
            )?;
            let mut get_file = tx.prepare(
                "SELECT id FROM files WHERE path = ?1",
            )?;
            let mut insert_struct = tx.prepare(
                "INSERT INTO structs (name, file_id, line_number) VALUES (?1, ?2, ?3)",
            )?;
            let mut insert_fts = tx.prepare(
                "INSERT INTO symbol_fts (name, kind, file_path) VALUES (?1, 'struct', ?2)",
            )?;

            for s in structs {
                insert_file.execute(params![s.file_path])?;
                let file_id: i64 = get_file.query_row(params![s.file_path], |r| r.get(0))?;
                insert_struct.execute(params![s.name, file_id, s.line_number])?;
                insert_fts.execute(params![s.name, s.file_path])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn insert_exports(&self, exports: &[ExportedSymbol]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut insert = tx.prepare(
                "INSERT INTO exports (function_id, is_gpl)
                 SELECT f.id, ?2 FROM functions f WHERE f.name = ?1 LIMIT 1",
            )?;

            for exp in exports {
                insert.execute(params![exp.name, exp.is_gpl as i32])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn insert_calls(&self, calls: &[CallEdge]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            // We resolve call edges by function name. For cross-file calls, we pick the
            // first match. This is imprecise but useful for exploration.
            let mut resolve = tx.prepare(
                "SELECT id FROM functions WHERE name = ?1 LIMIT 1",
            )?;
            let mut insert = tx.prepare(
                "INSERT INTO calls (caller_id, callee_id, line_number) VALUES (?1, ?2, ?3)",
            )?;

            for call in calls {
                let caller_id: Option<i64> = resolve
                    .query_row(params![call.caller], |r| r.get(0))
                    .ok();
                let callee_id: Option<i64> = resolve
                    .query_row(params![call.callee], |r| r.get(0))
                    .ok();

                if let (Some(cid), Some(eid)) = (caller_id, callee_id) {
                    insert.execute(params![cid, eid, call.line_number])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    // ── Query methods (Phase 3) ──

    pub fn query_callers(&self, function: &str) -> Result<Vec<Vec<String>>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.name, fi.path, c.line_number
             FROM calls c
             JOIN functions f ON f.id = c.caller_id
             JOIN functions callee ON callee.id = c.callee_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE callee.name = ?1
             ORDER BY f.name",
        )?;
        let rows: Vec<Vec<String>> = stmt
            .query_map(params![function], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn query_callees(&self, function: &str) -> Result<Vec<Vec<String>>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.name, fi.path, c.line_number
             FROM calls c
             JOIN functions f ON f.id = c.callee_id
             JOIN functions caller ON caller.id = c.caller_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE caller.name = ?1
             ORDER BY f.name",
        )?;
        let rows: Vec<Vec<String>> = stmt
            .query_map(params![function], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn query_call_path(&self, from: &str, to: &str, max_depth: usize) -> Result<Option<Vec<String>>> {
        // BFS through the call graph
        use std::collections::{HashMap, VecDeque};

        let mut stmt = self.conn.prepare(
            "SELECT f.name
             FROM calls c
             JOIN functions f ON f.id = c.callee_id
             JOIN functions caller ON caller.id = c.caller_id
             WHERE caller.name = ?1",
        )?;

        let mut visited: HashMap<String, String> = HashMap::new();
        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        queue.push_back((from.to_string(), 0));
        visited.insert(from.to_string(), String::new());

        while let Some((current, depth)) = queue.pop_front() {
            if depth >= max_depth {
                continue;
            }

            let callees: Vec<String> = stmt
                .query_map(params![current], |row| row.get::<_, String>(0))?
                .filter_map(|r| r.ok())
                .collect();

            for callee in callees {
                if visited.contains_key(&callee) {
                    continue;
                }
                visited.insert(callee.clone(), current.clone());

                if callee == to {
                    // Reconstruct path
                    let mut path = vec![to.to_string()];
                    let mut cur = to.to_string();
                    while let Some(prev) = visited.get(&cur) {
                        if prev.is_empty() {
                            break;
                        }
                        path.push(prev.clone());
                        cur = prev.clone();
                    }
                    path.reverse();
                    return Ok(Some(path));
                }

                queue.push_back((callee, depth + 1));
            }
        }

        Ok(None)
    }

    pub fn query_config_depends(&self, config: &str) -> Result<Vec<Vec<String>>> {
        let name = if config.starts_with("CONFIG_") {
            config.strip_prefix("CONFIG_").unwrap().to_string()
        } else {
            config.to_string()
        };

        let mut stmt = self.conn.prepare(
            "SELECT co.name, cd.dep_type, cd.expr
             FROM config_deps cd
             JOIN config_options co ON co.id = cd.config_id
             WHERE co.name = ?1
             ORDER BY cd.dep_type",
        )?;
        let rows: Vec<Vec<String>> = stmt
            .query_map(params![name], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Also find reverse deps (things that depend on / select this config)
        let mut stmt2 = self.conn.prepare(
            "SELECT co.name, cd.dep_type, cd.expr
             FROM config_deps cd
             JOIN config_options co ON co.id = cd.config_id
             WHERE cd.expr LIKE ?1
             ORDER BY cd.dep_type",
        )?;
        let pattern = format!("%{}%", name);
        let reverse: Vec<Vec<String>> = stmt2
            .query_map(params![pattern], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut all = rows;
        if !reverse.is_empty() {
            all.push(vec!["---".into(), "reverse dependencies".into(), "---".into()]);
            all.extend(reverse);
        }
        Ok(all)
    }

    pub fn query_struct(&self, name: &str) -> Result<Vec<Vec<String>>> {
        let mut stmt = self.conn.prepare(
            "SELECT s.name, fi.path, s.line_number
             FROM structs s
             LEFT JOIN files fi ON fi.id = s.file_id
             WHERE s.name = ?1",
        )?;
        let rows: Vec<Vec<String>> = stmt
            .query_map(params![name], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn query_exports(&self, gpl_only: bool) -> Result<Vec<Vec<String>>> {
        let sql = if gpl_only {
            "SELECT f.name, fi.path, e.is_gpl
             FROM exports e
             JOIN functions f ON f.id = e.function_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE e.is_gpl = 1
             ORDER BY f.name"
        } else {
            "SELECT f.name, fi.path, e.is_gpl
             FROM exports e
             JOIN functions f ON f.id = e.function_id
             LEFT JOIN files fi ON fi.id = f.file_id
             ORDER BY f.name"
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows: Vec<Vec<String>> = stmt
            .query_map([], |row| {
                let gpl: i64 = row.get(2)?;
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    if gpl == 1 { "GPL".into() } else { "".into() },
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn query_syscalls(&self, name: Option<&str>) -> Result<Vec<Vec<String>>> {
        let (sql, param): (&str, Option<String>) = match name {
            Some(n) => {
                let pattern = format!("%sys_{}", n);
                (
                    "SELECT f.name, fi.path, f.signature
                     FROM functions f
                     LEFT JOIN files fi ON fi.id = f.file_id
                     WHERE f.name LIKE ?1
                     ORDER BY f.name",
                    Some(pattern),
                )
            }
            None => (
                "SELECT f.name, fi.path, f.signature
                 FROM functions f
                 LEFT JOIN files fi ON fi.id = f.file_id
                 WHERE f.name LIKE '%SYSCALL_DEFINE%' OR f.name LIKE 'sys_%' OR f.name LIKE '__do_sys_%'
                 ORDER BY f.name",
                None,
            ),
        };

        let mut stmt = self.conn.prepare(sql)?;
        let rows: Vec<Vec<String>> = if let Some(ref p) = param {
            stmt.query_map(params![p], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, String>(2).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect()
        } else {
            stmt.query_map([], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, String>(2).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect()
        };
        Ok(rows)
    }

    pub fn raw_query(&self, sql: &str) -> Result<Vec<Vec<String>>> {
        let mut stmt = self
            .conn
            .prepare(sql)
            .context("Failed to prepare SQL query")?;
        let col_count = stmt.column_count();
        let mut rows_out = Vec::new();

        // Header row
        let headers: Vec<String> = (0..col_count)
            .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
            .collect();
        rows_out.push(headers);

        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let mut vals = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let val: String = row
                    .get::<_, rusqlite::types::Value>(i)
                    .map(|v| match v {
                        rusqlite::types::Value::Null => "NULL".to_string(),
                        rusqlite::types::Value::Integer(i) => i.to_string(),
                        rusqlite::types::Value::Real(f) => f.to_string(),
                        rusqlite::types::Value::Text(s) => s,
                        rusqlite::types::Value::Blob(b) => format!("<blob:{} bytes>", b.len()),
                    })
                    .unwrap_or_else(|_| "?".to_string());
                vals.push(val);
            }
            rows_out.push(vals);
        }
        Ok(rows_out)
    }
}
