-- Cloudflare D1 (SQLite) schema.
-- Apply with:  npx wrangler d1 execute fitness --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS profile (
  id         INTEGER PRIMARY KEY CHECK (id = 1),  -- single-user app
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,            -- YYYY-MM-DD in the profile's timezone
  kind       TEXT NOT NULL,            -- meal | workout | weight
  slot       TEXT,                     -- breakfast | lunch | dinner | snack
  raw        TEXT,                     -- what was typed, kept so entries can be re-parsed
  items      TEXT,                     -- JSON array of parsed items
  value      REAL,                     -- weight entries only
  created_at TEXT NOT NULL
);

-- Every read is a date-range scan, so this is the index that matters.
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries (date);
CREATE INDEX IF NOT EXISTS idx_entries_kind_date ON entries (kind, date);

-- Finished days get their review cached so re-opening history is free.
CREATE TABLE IF NOT EXISTS reviews (
  date       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
