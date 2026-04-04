-- Fix unique constraints to be per-user
ALTER TABLE terms DROP CONSTRAINT terms_name_key;
ALTER TABLE terms ADD CONSTRAINT terms_name_user_id_key UNIQUE (name, user_id);

ALTER TABLE categories DROP CONSTRAINT categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_name_user_id_key UNIQUE (name, user_id);

-- Default user_id to the authenticated user on insert
ALTER TABLE terms ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE categories ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Enable RLS
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_refinements ENABLE ROW LEVEL SECURITY;

-- Terms: full access for owner only
CREATE POLICY "terms_owner" ON terms
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categories: full access for owner only
CREATE POLICY "categories_owner" ON categories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- term_categories: access when the linked term belongs to the user
CREATE POLICY "term_categories_owner" ON term_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM terms WHERE terms.id = term_categories.term_id AND terms.user_id = auth.uid()
    )
  );

-- concept_refinements: access when the linked term belongs to the user
CREATE POLICY "concept_refinements_owner" ON concept_refinements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM terms WHERE terms.id = concept_refinements.term_id AND terms.user_id = auth.uid()
    )
  );
