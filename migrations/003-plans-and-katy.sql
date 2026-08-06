-- 003: seed the two plan users and attach the six-month plans.
--
-- Idempotent by design: INSERT OR IGNORE never clobbers an existing row, and
-- the owner UPDATE only sets name/plan fields (via json_set) so any profile
-- values Gareth has already saved survive a re-run.
--
-- Katy's passcode is hashed exactly as src/auth.js does it:
-- PBKDF2-SHA256, 1000 iterations, hex salt + hash.

INSERT OR IGNORE INTO users (id, name, passcode_hash, salt, created_at)
VALUES (
  'katy',
  'Katy',
  '4fac01e926aaac44b6a812dad575e6eb2188c1ae82adf1d0e5b1b6fad8330522',
  '653b699059fe5cceb1de99454658f791',
  '2026-08-06T00:00:00.000Z'
);

-- Katy's profile, from her plan document: 27, 5ft 8 (173 cm), 10.5 st (66.7 kg),
-- gentle deficit (~0.3 kg/week), following "Six Months Stronger".
INSERT OR IGNORE INTO profiles (user_id, data, updated_at)
VALUES (
  'katy',
  '{"name":"Katy","sex":"female","age":27,"heightCm":173,"weightKg":66.7,"baseline":"light","goal":"lose","rateKgPerWeek":0.3,"timezone":"Asia/Dubai","climate":"hot","proteinPerKg":null,"planId":"sixmonthsstronger","planStart":"2026-08-03"}',
  '2026-08-06T00:00:00.000Z'
);

-- Make sure the founder has a profile row at all (no-op when one exists) …
INSERT OR IGNORE INTO profiles (user_id, data, updated_at)
VALUES (
  'owner',
  '{"name":"Gareth","sex":"male","age":37,"heightCm":178,"weightKg":115,"baseline":"light","goal":"lose","rateKgPerWeek":0.5,"timezone":"Asia/Dubai","climate":"hot","proteinPerKg":null,"planId":"sixmonthsback","planStart":"2026-08-03"}',
  '2026-08-06T00:00:00.000Z'
);

-- … then set the name and attach "Six Months Back" without touching anything
-- else he may have changed.
UPDATE profiles
SET data = json_set(data,
  '$.name', 'Gareth',
  '$.planId', 'sixmonthsback',
  '$.planStart', '2026-08-03')
WHERE user_id = 'owner';
