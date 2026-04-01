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

            -- Struct fields
            CREATE TABLE IF NOT EXISTS struct_fields (
                id         INTEGER PRIMARY KEY,
                struct_id  INTEGER NOT NULL REFERENCES structs(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                field_type TEXT,
                line_number INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_struct_fields_struct ON struct_fields(struct_id);

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
        // Clear existing data to prevent duplicates on repeated parse
        tx.execute_batch("DELETE FROM config_deps; DELETE FROM config_options;")?;
        {
            let mut insert_opt = tx.prepare(
                "INSERT OR IGNORE INTO config_options (name, type, prompt, default_val, help, file_path, line_number)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )?;
            let mut get_opt = tx.prepare(
                "SELECT id FROM config_options WHERE name = ?1",
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

                let config_id: i64 = get_opt.query_row(params![opt.name], |r| r.get(0))?;

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
        // Clear existing data to prevent duplicates on repeated parse
        tx.execute_batch("DELETE FROM modules; DELETE FROM subsystems;")?;
        {
            let mut insert_sub = tx.prepare(
                "INSERT OR IGNORE INTO subsystems (name, path) VALUES (?1, ?2)",
            )?;
            let mut get_sub = tx.prepare(
                "SELECT id FROM subsystems WHERE name = ?1",
            )?;
            let mut insert_mod = tx.prepare(
                "INSERT INTO modules (name, object_file, build_type, config_guard, subsystem_id, file_path)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )?;

            for entry in entries {
                insert_sub.execute(params![entry.subsystem, entry.makefile_path])?;
                let sub_id: i64 = get_sub.query_row(params![entry.subsystem], |r| r.get(0))?;

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

    /// Clear all C source data (for full re-parse to prevent duplicates)
    pub fn clear_all_c_source_data(&self) -> Result<()> {
        self.conn.execute_batch(
            "DELETE FROM calls;
             DELETE FROM exports;
             DELETE FROM struct_fields;
             DELETE FROM structs;
             DELETE FROM functions;
             DELETE FROM symbol_fts;
             DELETE FROM files;",
        )?;
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
            let mut insert_field = tx.prepare(
                "INSERT INTO struct_fields (struct_id, name, field_type, line_number) VALUES (?1, ?2, ?3, ?4)",
            )?;
            let mut insert_fts = tx.prepare(
                "INSERT INTO symbol_fts (name, kind, file_path) VALUES (?1, 'struct', ?2)",
            )?;

            for s in structs {
                insert_file.execute(params![s.file_path])?;
                let file_id: i64 = get_file.query_row(params![s.file_path], |r| r.get(0))?;
                insert_struct.execute(params![s.name, file_id, s.line_number])?;
                let struct_id = tx.last_insert_rowid();
                for field in &s.fields {
                    insert_field.execute(params![
                        struct_id,
                        field.name,
                        field.field_type,
                        field.line_number,
                    ])?;
                }
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
        // First get the struct location
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, fi.path, s.line_number
             FROM structs s
             LEFT JOIN files fi ON fi.id = s.file_id
             WHERE s.name = ?1",
        )?;
        let structs: Vec<(i64, String, String, String)> = stmt
            .query_map(params![name], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2).unwrap_or_default(),
                    row.get::<_, i64>(3).map(|n| n.to_string()).unwrap_or_default(),
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        if structs.is_empty() {
            return Ok(Vec::new());
        }

        let mut rows: Vec<Vec<String>> = Vec::new();
        for (struct_id, sname, path, line) in &structs {
            rows.push(vec!["def".to_string(), sname.clone(), path.clone(), line.clone()]);

            // Fetch fields
            let mut field_stmt = self.conn.prepare(
                "SELECT name, field_type, line_number FROM struct_fields WHERE struct_id = ?1 ORDER BY line_number",
            )?;
            let fields: Vec<Vec<String>> = field_stmt
                .query_map(params![struct_id], |row| {
                    Ok(vec![
                        "field".to_string(),
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1).unwrap_or_default(),
                        row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                    ])
                })?
                .filter_map(|r| r.ok())
                .collect();
            rows.extend(fields);
        }
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

    /// Collect a call graph neighborhood: edges reachable from `root` up to `depth` hops.
    /// Returns (nodes, edges) where nodes are function names and edges are (caller, callee) pairs.
    pub fn collect_call_graph(
        &self,
        root: &str,
        depth: usize,
        callers: bool,
        callees: bool,
    ) -> Result<(Vec<(String, String, bool)>, Vec<(String, String)>)> {
        use std::collections::{HashSet, VecDeque};

        // nodes: (name, file_path, is_static)
        let mut nodes: Vec<(String, String, bool)> = Vec::new();
        let mut node_set: HashSet<String> = HashSet::new();
        let mut edges: Vec<(String, String)> = Vec::new();
        let mut edge_set: HashSet<(String, String)> = HashSet::new();

        let mut callers_stmt = self.conn.prepare(
            "SELECT f.name, fi.path, f.is_static
             FROM calls c
             JOIN functions f ON f.id = c.caller_id
             JOIN functions callee ON callee.id = c.callee_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE callee.name = ?1",
        )?;
        let mut callees_stmt = self.conn.prepare(
            "SELECT f.name, fi.path, f.is_static
             FROM calls c
             JOIN functions f ON f.id = c.callee_id
             JOIN functions caller ON caller.id = c.caller_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE caller.name = ?1",
        )?;

        // Seed with root
        node_set.insert(root.to_string());
        // Get root info
        let root_info: Option<(String, bool)> = self.conn.prepare(
            "SELECT fi.path, f.is_static FROM functions f LEFT JOIN files fi ON fi.id = f.file_id WHERE f.name = ?1 LIMIT 1",
        )?.query_row(params![root], |row| {
            Ok((row.get::<_, String>(0).unwrap_or_default(), row.get::<_, i64>(1).unwrap_or(0) == 1))
        }).ok();
        let (root_path, root_static) = root_info.unwrap_or_default();
        nodes.push((root.to_string(), root_path, root_static));

        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        queue.push_back((root.to_string(), 0));

        while let Some((current, d)) = queue.pop_front() {
            if d >= depth {
                continue;
            }

            if callers {
                let found: Vec<(String, String, bool)> = callers_stmt
                    .query_map(params![current], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1).unwrap_or_default(),
                            row.get::<_, i64>(2).unwrap_or(0) == 1,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                for (name, path, is_static) in found {
                    let edge = (name.clone(), current.clone());
                    if edge_set.insert(edge.clone()) {
                        edges.push(edge);
                    }
                    if node_set.insert(name.clone()) {
                        nodes.push((name.clone(), path, is_static));
                        queue.push_back((name, d + 1));
                    }
                }
            }

            if callees {
                let found: Vec<(String, String, bool)> = callees_stmt
                    .query_map(params![current], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1).unwrap_or_default(),
                            row.get::<_, i64>(2).unwrap_or(0) == 1,
                        ))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();
                for (name, path, is_static) in found {
                    let edge = (current.clone(), name.clone());
                    if edge_set.insert(edge.clone()) {
                        edges.push(edge);
                    }
                    if node_set.insert(name.clone()) {
                        nodes.push((name.clone(), path, is_static));
                        queue.push_back((name, d + 1));
                    }
                }
            }
        }

        Ok((nodes, edges))
    }

    pub fn query_netflow(&self, protocol: &str) -> Result<Vec<Vec<String>>> {
        // Find all functions matching the protocol prefix (e.g., tcp_*, udp_*, icmp_*)
        let prefix = protocol.to_lowercase();

        // Well-known entry points per protocol for receive/transmit paths
        let entry_points: Vec<&str> = match prefix.as_str() {
            "tcp" => vec![
                "tcp_v4_rcv", "tcp_v6_rcv", "tcp_rcv_established",
                "tcp_sendmsg", "tcp_v4_connect", "tcp_v4_do_rcv",
                "tcp_data_queue", "tcp_transmit_skb", "__tcp_transmit_skb",
            ],
            "udp" => vec![
                "udp_rcv", "udp_v6_rcv", "udp_sendmsg", "udp_queue_rcv_skb",
                "udp_unicast_rcv_skb", "__udp4_lib_rcv",
            ],
            "icmp" => vec![
                "icmp_rcv", "icmp_send", "icmp_reply", "icmp_echo",
            ],
            "ip" => vec![
                "ip_rcv", "ip_rcv_finish", "ip_local_deliver", "ip_forward",
                "ip_output", "ip_queue_xmit", "ip_local_out",
            ],
            "sctp" => vec![
                "sctp_rcv", "sctp_sendmsg", "sctp_v4_rcv",
            ],
            _ => vec![],
        };

        let mut results = Vec::new();

        // Section 1: Functions matching the protocol prefix
        let mut stmt = self.conn.prepare(
            "SELECT f.name, fi.path, f.line_number, f.is_static, f.signature
             FROM functions f
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE f.name LIKE ?1
             ORDER BY f.name",
        )?;
        let pattern = format!("{}_%", prefix);
        let funcs: Vec<Vec<String>> = stmt
            .query_map(params![pattern], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                    if row.get::<_, i64>(3).unwrap_or(0) == 1 { "static".into() } else { "global".into() },
                    row.get::<_, String>(4).unwrap_or_default(),
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();

        results.push(vec!["---".into(), format!("{} functions ({} total)", prefix, funcs.len()), "---".into(), "---".into(), "---".into()]);
        results.extend(funcs);

        // Section 2: Exported symbols for this protocol
        let mut stmt2 = self.conn.prepare(
            "SELECT f.name, fi.path, CASE WHEN e.is_gpl = 1 THEN 'GPL' ELSE '' END
             FROM exports e
             JOIN functions f ON f.id = e.function_id
             LEFT JOIN files fi ON fi.id = f.file_id
             WHERE f.name LIKE ?1
             ORDER BY f.name",
        )?;
        let exports: Vec<Vec<String>> = stmt2
            .query_map(params![pattern], |row| {
                Ok(vec![
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, String>(2)?,
                ])
            })?
            .filter_map(|r| r.ok())
            .collect();

        if !exports.is_empty() {
            results.push(vec!["---".into(), format!("exported symbols ({} total)", exports.len()), "---".into(), "---".into(), "---".into()]);
            for e in &exports {
                results.push(vec![e[0].clone(), e[1].clone(), e[2].clone(), String::new(), String::new()]);
            }
        }

        // Section 3: Call paths between known entry points
        if !entry_points.is_empty() {
            results.push(vec!["---".into(), "key call chains".into(), "---".into(), "---".into(), "---".into()]);
            for i in 0..entry_points.len().saturating_sub(1) {
                if let Some(path) = self.query_call_path(entry_points[i], entry_points[i + 1], 10)? {
                    results.push(vec![
                        entry_points[i].to_string(),
                        "→".into(),
                        entry_points[i + 1].to_string(),
                        format!("{} hops", path.len() - 1),
                        path.join(" → "),
                    ]);
                }
            }
        }

        Ok(results)
    }

    /// Get stored file hashes for incremental parsing
    pub fn get_file_hashes(&self) -> Result<std::collections::HashMap<String, String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT path, hash FROM files WHERE hash IS NOT NULL")?;
        let map: std::collections::HashMap<String, String> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(map)
    }

    /// Update a file's hash
    pub fn update_file_hash(&self, path: &str, hash: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE files SET hash = ?2 WHERE path = ?1",
            params![path, hash],
        )?;
        Ok(())
    }

    /// Delete data for a set of files (for re-parsing)
    pub fn clear_file_data(&self, paths: &[String]) -> Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        for path in paths {
            // Get file_id
            let file_id: Option<i64> = tx
                .prepare("SELECT id FROM files WHERE path = ?1")?
                .query_row(params![path], |r| r.get(0))
                .ok();
            if let Some(fid) = file_id {
                // Delete calls where the caller is in this file.
                // We intentionally do NOT delete calls where only the callee is in this file,
                // because unchanged files are not re-parsed and those edges would be permanently lost.
                tx.execute(
                    "DELETE FROM calls WHERE caller_id IN (SELECT id FROM functions WHERE file_id = ?1)",
                    params![fid],
                )?;
                // Delete exports for functions in this file
                tx.execute(
                    "DELETE FROM exports WHERE function_id IN (SELECT id FROM functions WHERE file_id = ?1)",
                    params![fid],
                )?;
                // Delete FTS entries for functions and structs in this file
                tx.execute(
                    "DELETE FROM symbol_fts WHERE rowid IN (
                        SELECT rowid FROM symbol_fts WHERE file_path = ?1
                    )",
                    params![path],
                )?;
                // Delete functions
                tx.execute("DELETE FROM functions WHERE file_id = ?1", params![fid])?;
                // Delete structs (struct_fields cascade via ON DELETE CASCADE)
                tx.execute("DELETE FROM structs WHERE file_id = ?1", params![fid])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Get all function names as a set (for diff comparisons)
    pub fn all_function_names(&self) -> Result<std::collections::HashSet<String>> {
        let mut stmt = self.conn.prepare("SELECT DISTINCT name FROM functions")?;
        let names: std::collections::HashSet<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(names)
    }

    /// Get all config option names as a set
    pub fn all_config_names(&self) -> Result<std::collections::HashSet<String>> {
        let mut stmt = self.conn.prepare("SELECT DISTINCT name FROM config_options")?;
        let names: std::collections::HashSet<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(names)
    }

    /// Get all struct names as a set
    pub fn all_struct_names(&self) -> Result<std::collections::HashSet<String>> {
        let mut stmt = self.conn.prepare("SELECT DISTINCT name FROM structs")?;
        let names: std::collections::HashSet<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(names)
    }

    /// Get all exported symbol names as a set (with GPL status)
    pub fn all_export_names(&self) -> Result<std::collections::HashMap<String, bool>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.name, e.is_gpl FROM exports e JOIN functions f ON f.id = e.function_id",
        )?;
        let exports: std::collections::HashMap<String, bool> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? == 1))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(exports)
    }

    pub fn get_stats(&self) -> Result<Vec<(String, i64)>> {
        let queries = [
            ("functions", "SELECT count(*) FROM functions"),
            ("static functions", "SELECT count(*) FROM functions WHERE is_static = 1"),
            ("call edges", "SELECT count(*) FROM calls"),
            ("structs", "SELECT count(*) FROM structs"),
            ("struct fields", "SELECT count(*) FROM struct_fields"),
            ("exported symbols", "SELECT count(*) FROM exports"),
            ("GPL exports", "SELECT count(*) FROM exports WHERE is_gpl = 1"),
            ("config options", "SELECT count(*) FROM config_options"),
            ("config deps", "SELECT count(*) FROM config_deps"),
            ("modules", "SELECT count(*) FROM modules"),
            ("subsystems", "SELECT count(*) FROM subsystems"),
            ("files", "SELECT count(*) FROM files"),
        ];
        let mut stats = Vec::new();
        for (label, sql) in &queries {
            let count: i64 = self.conn.query_row(sql, [], |r| r.get(0)).unwrap_or(0);
            stats.push((label.to_string(), count));
        }
        Ok(stats)
    }

    pub fn search_symbols(&self, pattern: &str, limit: usize) -> Result<Vec<Vec<String>>> {
        // Try FTS5 first for speed, fall back to LIKE on error or zero results
        let fts_results: Vec<Vec<String>> = (|| -> Result<Vec<Vec<String>>> {
            let mut fts_stmt = self.conn.prepare(
                "SELECT name, kind, file_path FROM symbol_fts WHERE symbol_fts MATCH ?1 LIMIT ?2",
            )?;
            let rows: Vec<Vec<String>> = fts_stmt
                .query_map(params![pattern, limit as i64], |row| {
                    Ok(vec![
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ])
                })?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        })()
        .unwrap_or_default();

        if !fts_results.is_empty() {
            return Ok(fts_results);
        }

        // Fallback: LIKE search on functions and structs
        let like_pat = format!("%{}%", pattern);
        let mut results = Vec::new();
        {
            let mut stmt = self.conn.prepare(
                "SELECT f.name, fi.path, f.line_number, CASE f.is_static WHEN 1 THEN 'static' ELSE '' END
                 FROM functions f LEFT JOIN files fi ON fi.id = f.file_id
                 WHERE f.name LIKE ?1 LIMIT ?2",
            )?;
            let rows: Vec<Vec<String>> = stmt
                .query_map(params![like_pat, limit as i64], |row| {
                    Ok(vec![
                        row.get::<_, String>(0)?,
                        "function".to_string(),
                        row.get::<_, String>(1).unwrap_or_default(),
                        row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                        row.get::<_, String>(3).unwrap_or_default(),
                    ])
                })?
                .filter_map(|r| r.ok())
                .collect();
            results.extend(rows);
        }
        {
            let mut stmt = self.conn.prepare(
                "SELECT s.name, fi.path, s.line_number
                 FROM structs s LEFT JOIN files fi ON fi.id = s.file_id
                 WHERE s.name LIKE ?1 LIMIT ?2",
            )?;
            let rows: Vec<Vec<String>> = stmt
                .query_map(params![like_pat, limit as i64], |row| {
                    Ok(vec![
                        row.get::<_, String>(0)?,
                        "struct".to_string(),
                        row.get::<_, String>(1).unwrap_or_default(),
                        row.get::<_, i64>(2).map(|n| n.to_string()).unwrap_or_default(),
                        String::new(),
                    ])
                })?
                .filter_map(|r| r.ok())
                .collect();
            results.extend(rows);
        }
        Ok(results)
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
