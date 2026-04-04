ALTER TABLE terms ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id);

UPDATE terms SET user_id = '51840fe9-9a4d-4576-98a5-a3f993d842f8';
UPDATE categories SET user_id = '51840fe9-9a4d-4576-98a5-a3f993d842f8';

ALTER TABLE terms ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
