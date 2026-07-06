import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data.sqlite");

// Node's built-in SQLite module (available in Node 22+, currently marked
// "experimental" but stable enough for this project). No native compilation
// step needed, unlike better-sqlite3 — one less thing that can break.
export const db = new DatabaseSync(dbPath);

// Run once on startup — creates the table if it doesn't exist yet.
// This is fine for SQLite; if you migrate to MySQL/PlanetScale later,
// you'd replace this with a proper migration tool.
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