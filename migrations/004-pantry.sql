-- 004: pantry table for scanned/custom products.
-- Running this by hand is OPTIONAL: the worker creates the table itself on
-- first pantry use, because deploys are hands-off now. Kept for completeness.
CREATE TABLE IF NOT EXISTS pantry (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry (user_id);
