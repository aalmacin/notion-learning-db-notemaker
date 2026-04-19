ALTER TABLE terms
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN notion_last_edited TEXT,
  ADD COLUMN last_synced_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't bump updated_at when only sync-tracking columns change
  IF (NEW.notion_last_edited IS DISTINCT FROM OLD.notion_last_edited
      OR NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at
      OR NEW.daily_learning_done IS DISTINCT FROM OLD.daily_learning_done
      OR NEW.notion_date IS DISTINCT FROM OLD.notion_date)
     AND NEW.name = OLD.name
     AND NEW.content = OLD.content
     AND NEW.priority = OLD.priority
     AND NEW.notion_page_id IS NOT DISTINCT FROM OLD.notion_page_id
  THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER terms_updated_at
  BEFORE UPDATE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION set_terms_updated_at();
