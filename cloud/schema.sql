CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  last_modified INTEGER NOT NULL DEFAULT 0,
  pilot TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Document',
  event TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created DESC);
CREATE INDEX IF NOT EXISTS idx_media_pilot ON media(pilot);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_event ON media(event);
