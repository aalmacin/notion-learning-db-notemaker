CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notion_api_key TEXT,
  notion_database_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
