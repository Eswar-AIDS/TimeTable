import Database from 'better-sqlite3';

const db = new Database('app.db');

// simple table for change requests
db.exec(`
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  role TEXT NOT NULL,
  name TEXT,
  message TEXT NOT NULL
);
`);

export default db;


