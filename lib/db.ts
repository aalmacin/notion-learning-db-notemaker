import Database from 'better-sqlite3';
import path from 'path';

export type Priority = 'High' | 'Medium' | 'Low';

export type Term = {
  id: number;
  name: string;
  content: string;
  categories: string[];
  created_at: string;
  notion_page_id: string | null;
  priority: Priority;
  explained: boolean;
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
      notion_page_id TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium'
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

    CREATE TABLE IF NOT EXISTS concept_refinements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      pre_refinement TEXT NOT NULL,
      pre_refinement_accuracy INTEGER,
      pre_refinement_review TEXT,
      refinement TEXT,
      refinement_accuracy INTEGER,
      refinement_review TEXT,
      refinement_formatted_note TEXT,
      refinement_additional_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate: drop old categories column if it exists
  try {
    _db.exec('ALTER TABLE terms DROP COLUMN categories');
  } catch {
    // Already dropped or never existed
  }

  // Migrate: add priority column if it doesn't exist
  try {
    _db.exec("ALTER TABLE terms ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium'");
  } catch {
    // Already exists
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
  const explained = !!(db
    .prepare('SELECT 1 FROM concept_refinements WHERE term_id = ? AND refinement_formatted_note IS NOT NULL LIMIT 1')
    .get(row.id));
  return { ...row, categories: getCategoriesForTerm(db, row.id), explained };
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

  const explainedIds = new Set(
    (db
      .prepare('SELECT DISTINCT term_id FROM concept_refinements WHERE refinement_formatted_note IS NOT NULL')
      .all() as { term_id: number }[]).map((r) => r.term_id)
  );

  return rows.map((row) => ({
    ...row,
    categories: catMap.get(row.id) ?? [],
    explained: explainedIds.has(row.id),
  }));
}

export function insertTerm(term: Omit<Term, 'id' | 'created_at' | 'explained'>): Term {
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare('INSERT INTO terms (name, content, notion_page_id, priority) VALUES (?, ?, ?, ?) RETURNING *')
      .get(term.name, term.content, term.notion_page_id ?? null, term.priority ?? 'Medium') as TermRow;
    const categoryIds = upsertCategories(db, term.categories);
    setTermCategories(db, row.id, categoryIds);
    return { ...row, categories: term.categories, explained: false };
  })();
}

export function updateTerm(
  id: number,
  updates: Partial<Omit<Term, 'id' | 'created_at' | 'explained'>>,
): Term | null {
  const db = getDb();
  return db.transaction(() => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.notion_page_id !== undefined) { fields.push('notion_page_id = ?'); values.push(updates.notion_page_id); }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }

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

    const explained = !!(db
      .prepare('SELECT 1 FROM concept_refinements WHERE term_id = ? AND refinement_formatted_note IS NOT NULL LIMIT 1')
      .get(row.id));
    return { ...row, categories: getCategoriesForTerm(db, row.id), explained };
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

export type ConceptRefinement = {
  id: number;
  term_id: number;
  pre_refinement: string;
  pre_refinement_accuracy: number | null;
  pre_refinement_review: string | null;
  refinement: string | null;
  refinement_accuracy: number | null;
  refinement_review: string | null;
  refinement_formatted_note: string | null;
  refinement_additional_note: string | null;
  created_at: string;
};

export function getTermById(id: number): Term | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM terms WHERE id = ?').get(id) as TermRow | undefined;
  if (!row) return null;
  const explained = !!(db
    .prepare('SELECT 1 FROM concept_refinements WHERE term_id = ? AND refinement_formatted_note IS NOT NULL LIMIT 1')
    .get(row.id));
  return { ...row, categories: getCategoriesForTerm(db, row.id), explained };
}

export function getRefinementsByTermId(termId: number): ConceptRefinement[] {
  return getDb()
    .prepare('SELECT * FROM concept_refinements WHERE term_id = ? ORDER BY created_at DESC')
    .all(termId) as ConceptRefinement[];
}

export function getRefinementById(id: number): ConceptRefinement | null {
  return (
    (getDb()
      .prepare('SELECT * FROM concept_refinements WHERE id = ?')
      .get(id) as ConceptRefinement | undefined) ?? null
  );
}

export function createRefinement(termId: number, preRefinement: string): ConceptRefinement {
  return getDb()
    .prepare('INSERT INTO concept_refinements (term_id, pre_refinement) VALUES (?, ?) RETURNING *')
    .get(termId, preRefinement) as ConceptRefinement;
}

export function updatePreRefinementResult(
  id: number,
  accuracy: number,
  review: string,
): ConceptRefinement {
  return getDb()
    .prepare(
      'UPDATE concept_refinements SET pre_refinement_accuracy = ?, pre_refinement_review = ? WHERE id = ? RETURNING *',
    )
    .get(accuracy, review, id) as ConceptRefinement;
}

export function updateRefinementData(
  id: number,
  data: {
    refinement: string;
    refinement_accuracy: number;
    refinement_review: string;
    refinement_formatted_note: string;
    refinement_additional_note: string;
  },
): ConceptRefinement {
  return getDb()
    .prepare(
      `UPDATE concept_refinements
       SET refinement = ?, refinement_accuracy = ?, refinement_review = ?,
           refinement_formatted_note = ?, refinement_additional_note = ?
       WHERE id = ? RETURNING *`,
    )
    .get(
      data.refinement,
      data.refinement_accuracy,
      data.refinement_review,
      data.refinement_formatted_note,
      data.refinement_additional_note,
      id,
    ) as ConceptRefinement;
}

export function deleteConceptRefinement(id: number): void {
  getDb().prepare('DELETE FROM concept_refinements WHERE id = ?').run(id);
}
