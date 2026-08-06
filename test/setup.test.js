import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findDatabaseId, applyDatabaseId } from '../scripts/setup.mjs'

// The network call cannot be tested without a Cloudflare account; the parsing
// and file rewriting can, and those are where this script would actually break.

test('finds the database id in wrangler output', () => {
  // Wrangler prints a banner above the JSON payload.
  const output = `
 ⛅️ wrangler 4.119.0
────────────────────
[
  { "uuid": "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb", "name": "something-else", "version": "production" },
  { "uuid": "deadbeef-0000-4444-9999-feedfacecafe", "name": "fitness", "version": "production" }
]
`
  assert.equal(findDatabaseId(output, 'fitness'), 'deadbeef-0000-4444-9999-feedfacecafe')
})

test('falls back to database_id when uuid is absent', () => {
  const output = '[{"database_id":"abc-123","name":"fitness"}]'
  assert.equal(findDatabaseId(output, 'fitness'), 'abc-123')
})

test('returns null rather than guessing when output is unusable', () => {
  assert.equal(findDatabaseId('Not authenticated. Please run wrangler login.', 'fitness'), null)
  assert.equal(findDatabaseId('[ this is not json', 'fitness'), null)
  assert.equal(findDatabaseId('[{"uuid":"x","name":"other"}]', 'fitness'), null)
})

test('replaces the placeholder id in wrangler.toml', () => {
  const toml = [
    '[[d1_databases]]',
    'binding = "DB"',
    'database_name = "fitness"',
    'database_id = "PASTE_YOUR_DATABASE_ID_HERE"',
    '',
    '[observability]',
    'enabled = true',
  ].join('\n')

  const updated = applyDatabaseId(toml, 'deadbeef-0000-4444-9999-feedfacecafe')
  assert.match(updated, /database_id = "deadbeef-0000-4444-9999-feedfacecafe"/)
  // Everything else must survive untouched.
  assert.match(updated, /binding = "DB"/)
  assert.match(updated, /database_name = "fitness"/)
  assert.match(updated, /enabled = true/)
})

test('re-running with a new id overwrites the previous one exactly once', () => {
  const toml = 'database_id = "old-id"\nother_id = "leave-me"\n'
  const updated = applyDatabaseId(toml, 'new-id')
  assert.equal(updated, 'database_id = "new-id"\nother_id = "leave-me"\n')
})

test('refuses to silently no-op when the line is missing', () => {
  assert.throws(() => applyDatabaseId('binding = "DB"\n', 'x'), /no database_id line/)
})

test('the real wrangler.toml has a database_id line this can patch', async () => {
  const { readFileSync } = await import('node:fs')
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
  const updated = applyDatabaseId(toml, 'test-id')
  assert.match(updated, /database_id = "test-id"/)
})
