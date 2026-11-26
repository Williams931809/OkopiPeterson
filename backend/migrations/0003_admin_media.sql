CREATE TABLE IF NOT EXISTS admin_settings (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  version INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE products ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
