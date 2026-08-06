-- One-time migration: single-user -> multi-user.
-- Run exactly once against an existing database:
--   npm run db:migrate
-- (Running it twice fails on the ALTER TABLE line with "duplicate column
--  name" - that error means it has already been applied, and is harmless.)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  passcode_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- Existing entries all belong to the founding APP_PASSCODE account.
ALTER TABLE entries ADD COLUMN user_id TEXT NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, date);

-- profile (single row) -> profiles (keyed by user).
CREATE TABLE IF NOT EXISTS profiles (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO profiles (user_id, data, updated_at)
  SELECT 'owner', data, updated_at FROM profile WHERE id = 1;
DROP TABLE IF EXISTS profile;

-- reviews (date pk) -> reviews (user_id + date pk).
CREATE TABLE IF NOT EXISTS reviews_v2 (
  user_id    TEXT NOT NULL,
  date       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);
INSERT OR IGNORE INTO reviews_v2 (user_id, date, data, created_at)
  SELECT 'owner', date, data, created_at FROM reviews;
DROP TABLE IF EXISTS reviews;
ALTER TABLE reviews_v2 RENAME TO reviews;
