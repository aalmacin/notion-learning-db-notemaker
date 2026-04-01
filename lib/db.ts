import Database from 'better-sqlite3';
import path from 'path';

export type Term = {
  id: number;
  name: string;
  content: string;
  categories: string[]; // stored as JSON string in DB
  created_at: string;
  notion_page_id: string | null;
};

type TermRow = Omit<Term, 'categories'> & { categories: string };

const DB_PATH = path.join(process.cwd(), 'notemaker.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      categories TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notion_page_id TEXT
    )
  `);

  return _db;
}

function deserialize(row: TermRow): Term {
  return { ...row, categories: JSON.parse(row.categories) };
}

export function getTerm(name: string): Term | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM terms WHERE name = ?').get(name) as TermRow | undefined;
  return row ? deserialize(row) : null;
}

export function getAllTerms(): Term[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM terms ORDER BY created_at DESC').all() as TermRow[];
  return rows.map(deserialize);
}

export function insertTerm(term: Omit<Term, 'id' | 'created_at'>): Term {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO terms (name, content, categories, notion_page_id)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);
  const row = stmt.get(
    term.name,
    term.content,
    JSON.stringify(term.categories),
    term.notion_page_id ?? null,
  ) as TermRow;
  return deserialize(row);
}

export function updateTerm(id: number, updates: Partial<Omit<Term, 'id' | 'created_at'>>): Term | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.categories !== undefined) { fields.push('categories = ?'); values.push(JSON.stringify(updates.categories)); }
  if (updates.notion_page_id !== undefined) { fields.push('notion_page_id = ?'); values.push(updates.notion_page_id); }

  if (fields.length === 0) return getTerm(String(id));

  values.push(id);
  const row = db
    .prepare(`UPDATE terms SET ${fields.join(', ')} WHERE id = ? RETURNING *`)
    .get(...values) as TermRow | undefined;

  return row ? deserialize(row) : null;
}

export function deleteTerm(id: number): void {
  getDb().prepare('DELETE FROM terms WHERE id = ?').run(id);
}
