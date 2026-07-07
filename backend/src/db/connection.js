import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data.sqlite");

// Node's built-in SQLite module (available in Node 22+)
// This is used for local development and testing.
export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('normal', 'deaf', 'mute')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log(`[db] SQLite ready at ${dbPath}`);

/*
  NOTE: To transition to MySQL / PlanetScale in production:
  1. Install mysql2 package: `npm install mysql2`
  2. Configure connection using `config.DATABASE_URL`
  
  Example MySQL / PlanetScale configuration:
  
  import mysql from 'mysql2/promise';
  
  export const pool = mysql.createPool(config.DATABASE_URL);
  
  // You would also need to rewrite your SQL helper functions in routes/auth.js
  // from `db.prepare(...).get(...)` to `await pool.query(...)`.
*/
export default db;