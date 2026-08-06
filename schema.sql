-- Cloudflare D1 (SQLite) schema — fresh installs.
-- Apply with:  npx wrangler d1 execute fitness --remote --file=./schema.sql
--
-- Existing pre-multi-user databases DO NOT re-run this; they run
-- migrations/002-multi-tenant.sql once instead (npm run db:migrate).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  passcode_hash TEXT NOT NULL,   -- PBKDF2-SHA256, hex
  salt          TEXT NOT NULL,   -- per-user random salt, hex
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL DEFAULT 'owner',
  date       TEXT NOT NULL,            -- YYYY-MM-DD in the user's timezone
  kind       TEXT NOT NULL,            -- meal | workout | weight | water
  slot       TEXT,                     -- breakfast | lunch | dinner | snack
  raw        TEXT,                     -- what was typed, kept for re-parsing
  items      TEXT,                     -- JSON array of parsed items
  value      REAL,                     -- weight (kg) and water (ml) entries
  created_at TEXT NOT NULL
);

-- Every read is a per-user date-range scan.
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, date);

-- Finished days get their review cached so re-opening history is free.
CREATE TABLE IF NOT EXISTS reviews (
  user_id    TEXT NOT NULL,
  date       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- Scanned and hand-entered products, per user (v3).
CREATE TABLE IF NOT EXISTS pantry (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry (user_id);
