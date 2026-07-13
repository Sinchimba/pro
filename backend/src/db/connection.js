import { config } from "../config/env.js";

let dbInstance;

if (config.DATABASE_URL) {
  // Use PostgreSQL (Production / Render)
  console.log("[db] Using PostgreSQL database...");
  const pg = await import("pg");
  const { Pool } = pg.default || pg;
  const isProduction = process.env.NODE_ENV === "production" || config.DATABASE_URL.includes("render.com");

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });

  dbInstance = {
    type: "postgres",
    async query(sql, params = []) {
      const res = await pool.query(sql, params);
      return {
        rows: res.rows,
        rowCount: res.rowCount,
      };
    },
    async exec(sql) {
      await pool.query(sql);
    }
  };
} else {
  // Use local SQLite (Development)
  console.log("[db] Using local SQLite database...");
  const { DatabaseSync } = await import("node:sqlite");
  const path = await import("path");
  const { fileURLToPath } = await import("url");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = path.join(__dirname, "../../data.sqlite");
  const sqliteDb = new DatabaseSync(dbPath);

  dbInstance = {
    type: "sqlite",
    async query(sql, params = []) {
      // Translate PostgreSQL placeholders ($1, $2) to SQLite placeholders (?)
      const sqliteSql = sql.replace(/\$\d+/g, "?");

      const isSelect = sql.trim().toUpperCase().startsWith("SELECT") || sql.toUpperCase().includes("RETURNING");

      if (isSelect) {
        const stmt = sqliteDb.prepare(sqliteSql);
        const rows = stmt.all(...params);
        return {
          rows: rows,
          rowCount: rows.length,
        };
      } else {
        const stmt = sqliteDb.prepare(sqliteSql);
        const result = stmt.run(...params);
        return {
          rows: [],
          rowCount: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        };
      }
    },
    async exec(sql) {
      sqliteDb.exec(sql);
    }
  };
}

export const db = dbInstance;

// Auto-initialize schema
const initDb = async () => {
  try {
    if (db.type === "postgres") {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK(role IN ('normal', 'deaf', 'mute')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS meetings (
          id VARCHAR(255) PRIMARY KEY,
          host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          first_used_at TIMESTAMP
        );
      `);
      console.log("[db] PostgreSQL connection and schema ready.");
    } else {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('normal', 'deaf', 'mute')),
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS meetings (
          id TEXT PRIMARY KEY,
          host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT NOT NULL,
          is_used INTEGER DEFAULT 0,
          first_used_at TEXT
        );
      `);
      console.log("[db] SQLite connection and schema ready.");
    }
  } catch (err) {
    console.error("[db] Database initialization failed:", err);
  }
};

initDb();

export default db;