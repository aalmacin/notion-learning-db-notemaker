# Supabase Migration Plan

## Overview

Migrate from `better-sqlite3` (sync, file-based) to Supabase (Postgres, async) while keeping the same data model and public API of `lib/db.ts`.

---

## 1. Setup

- Create a Supabase project at supabase.com
- Add env vars to `.env.local` and Vercel:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- Install dependencies:
  ```bash
  npm remove better-sqlite3 @types/better-sqlite3
  npm install @supabase/supabase-js
  ```

---

## 2. Schema Migration

Run the following SQL in the Supabase SQL editor to create the schema:

```sql
CREATE TABLE terms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notion_page_id TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium'
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE term_categories (
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, category_id)
);

CREATE TABLE concept_refinements (
  id SERIAL PRIMARY KEY,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  pre_refinement TEXT NOT NULL,
  pre_refinement_accuracy INTEGER,
  pre_refinement_review TEXT,
  refinement TEXT,
  refinement_accuracy INTEGER,
  refinement_review TEXT,
  refinement_formatted_note TEXT,
  refinement_additional_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Key differences from SQLite:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT DEFAULT (datetime('now'))` → `TIMESTAMPTZ DEFAULT now()`

---

## 3. Data Migration

Export existing SQLite data and import into Supabase:

```bash
# Export each table to CSV
sqlite3 notemaker.db -csv "SELECT * FROM terms;" > terms.csv
sqlite3 notemaker.db -csv "SELECT * FROM categories;" > categories.csv
sqlite3 notemaker.db -csv "SELECT * FROM term_categories;" > term_categories.csv
sqlite3 notemaker.db -csv "SELECT * FROM concept_refinements;" > concept_refinements.csv
```

Import via the Supabase dashboard (Table Editor → Import CSV) or via `psql`.

After import, reset sequences to avoid ID conflicts:
```sql
SELECT setval('terms_id_seq', (SELECT MAX(id) FROM terms));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('concept_refinements_id_seq', (SELECT MAX(id) FROM concept_refinements));
```

---

## 4. Rewrite `lib/db.ts`

Replace the entire file with a Supabase client. All functions become `async`.

**Key changes:**
- `getDb()` singleton → `createClient()` (Supabase handles connection pooling)
- `db.prepare(...).get/all/run()` (sync) → `supabase.from(...).select/insert/update/delete()` (async)
- `db.transaction()` → Supabase RPC with a Postgres function, or sequential awaited calls for simple cases
- `INSERT OR IGNORE` → `.upsert(..., { onConflict: 'name', ignoreDuplicates: true })`
- `RETURNING *` → `.select()` chained on insert/update

**Transaction cases to handle:**
- `insertTerm` — insert term + upsert categories + link term_categories (3 steps, use RPC or sequential)
- `updateTerm` — update term + optionally replace term_categories (2 steps)

---

## 5. Update All Call Sites

All functions in `lib/db.ts` become async, so every caller must `await` them.

| File | Functions to await |
|---|---|
| `actions/explain.ts` | `getTerm`, `insertTerm` |
| `actions/terms.ts` | `deleteTerm`, `updateTerm` |
| `actions/categories.ts` | `insertCategory`, `deleteCategory`, `updateTermCategories` |
| `actions/refinements.ts` | `getTermById`, `createRefinement`, `updatePreRefinementResult`, `updateRefinementData`, `getRefinementById`, `deleteConceptRefinement`, `updateTerm` |

Since all callers are already `async` server actions, adding `await` is straightforward.

---

## 6. Remove SQLite Artifacts

- Delete `notemaker.db` from the repo
- Remove `notemaker.db` from `.gitignore` (or add it if not already ignored)
- Delete inline migration blocks (the `ALTER TABLE` try/catch blocks)
- Remove `DB_PATH` and all `better-sqlite3` imports

---

## 7. Verification Checklist

- [ ] All tables created in Supabase
- [ ] Data imported and sequences reset
- [ ] `lib/db.ts` rewritten with Supabase client
- [ ] All server actions updated with `await`
- [ ] Local dev works against Supabase
- [ ] Vercel env vars set
- [ ] Deployed app reads and writes correctly
- [ ] `better-sqlite3` removed from `package.json`
