import Database from 'better-sqlite3';
import path from 'path';

export type Term = {
  id: number;
  name: string;
  content: string;
  categories: string[];
  created_at: string;
  notion_page_id: string | null;
};

export type Category = {
  id: number;
  name: string;
};

type TermRow = Omit<Term, 'categories'>;

const DB_PATH = path.join(process.cwd(), 'notemaker.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notion_page_id TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS term_categories (
      term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (term_id, category_id)
    );
  `);

  // Migrate: drop old categories column if it exists
  try {
    _db.exec('ALTER TABLE terms DROP COLUMN categories');
  } catch {
    // Already dropped or never existed
  }

  return _db;
}

function getCategoriesForTerm(db: Database.Database, termId: number): string[] {
  const rows = db
    .prepare(
      `SELECT c.name FROM categories c
       JOIN term_categories tc ON tc.category_id = c.id
       WHERE tc.term_id = ?
       ORDER BY c.name`,
    )
    .all(termId) as { name: string }[];
  return rows.map((r) => r.name);
}

function upsertCategories(db: Database.Database, names: string[]): number[] {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  const select = db.prepare('SELECT id FROM categories WHERE name = ?');
  return names.map((name) => {
    insert.run(name);
    return (select.get(name) as { id: number }).id;
  });
}

function setTermCategories(db: Database.Database, termId: number, categoryIds: number[]): void {
  db.prepare('DELETE FROM term_categories WHERE term_id = ?').run(termId);
  const insert = db.prepare('INSERT INTO term_categories (term_id, category_id) VALUES (?, ?)');
  for (const categoryId of categoryIds) {
    insert.run(termId, categoryId);
  }
}

export function getAllCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

export function getTerm(name: string): Term | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM terms WHERE LOWER(name) = LOWER(?)').get(name) as TermRow | undefined;
  if (!row) return null;
  return { ...row, categories: getCategoriesForTerm(db, row.id) };
}

export function getAllTerms(): Term[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM terms ORDER BY created_at DESC').all() as TermRow[];

  const allCats = db
    .prepare(
      `SELECT tc.term_id, c.name FROM term_categories tc
       JOIN categories c ON c.id = tc.category_id
       ORDER BY c.name`,
    )
    .all() as { term_id: number; name: string }[];

  const catMap = new Map<number, string[]>();
  for (const { term_id, name } of allCats) {
    if (!catMap.has(term_id)) catMap.set(term_id, []);
    catMap.get(term_id)!.push(name);
  }

  return rows.map((row) => ({ ...row, categories: catMap.get(row.id) ?? [] }));
}

export function insertTerm(term: Omit<Term, 'id' | 'created_at'>): Term {
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare('INSERT INTO terms (name, content, notion_page_id) VALUES (?, ?, ?) RETURNING *')
      .get(term.name, term.content, term.notion_page_id ?? null) as TermRow;
    const categoryIds = upsertCategories(db, term.categories);
    setTermCategories(db, row.id, categoryIds);
    return { ...row, categories: term.categories };
  })();
}

export function updateTerm(
  id: number,
  updates: Partial<Omit<Term, 'id' | 'created_at'>>,
): Term | null {
  const db = getDb();
  return db.transaction(() => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.notion_page_id !== undefined) { fields.push('notion_page_id = ?'); values.push(updates.notion_page_id); }

    let row: TermRow | undefined;
    if (fields.length > 0) {
      values.push(id);
      row = db
        .prepare(`UPDATE terms SET ${fields.join(', ')} WHERE id = ? RETURNING *`)
        .get(...values) as TermRow | undefined;
    } else {
      row = db.prepare('SELECT * FROM terms WHERE id = ?').get(id) as TermRow | undefined;
    }

    if (!row) return null;

    if (updates.categories !== undefined) {
      const categoryIds = upsertCategories(db, updates.categories);
      setTermCategories(db, row.id, categoryIds);
    }

    return { ...row, categories: getCategoriesForTerm(db, row.id) };
  })();
}

export function deleteTerm(id: number): void {
  getDb().prepare('DELETE FROM terms WHERE id = ?').run(id);
}

export function insertCategory(name: string): Category {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM categories WHERE name = ?').get(name) as Category;
}

export function deleteCategory(id: number): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function updateTermCategories(termId: number, categories: string[]): Term | null {
  return updateTerm(termId, { categories });
}
