CREATE TABLE IF NOT EXISTS research_chats (
  id SERIAL PRIMARY KEY,
  refinement_id INTEGER NOT NULL REFERENCES concept_refinements(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE research_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_chats_owner" ON research_chats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM concept_refinements cr
      JOIN terms t ON t.id = cr.term_id
      WHERE cr.id = research_chats.refinement_id
      AND t.user_id = auth.uid()
    )
  );
