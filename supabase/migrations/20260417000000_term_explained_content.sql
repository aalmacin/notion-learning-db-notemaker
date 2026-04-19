CREATE TABLE term_explained_content (
  id SERIAL PRIMARY KEY,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  notion_content TEXT NOT NULL,
  explained_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE term_explained_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "term_explained_content_owner" ON term_explained_content
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM terms WHERE terms.id = term_explained_content.term_id AND terms.user_id = auth.uid()
    )
  );
