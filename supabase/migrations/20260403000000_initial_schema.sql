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
