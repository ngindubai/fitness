#!/usr/bin/env node
/**
 * One-shot Cloudflare setup.
 *
 * Creates the D1 database, writes its id into wrangler.toml and applies the
 * schema. The manual version of this is "copy the uuid wrangler printed and
 * paste it into the right line of a TOML file", which is the single most
 * error-prone step in the whole deploy.
 *
 * Safe to re-run: an existing database is reused rather than duplicated, and
 * the schema uses CREATE TABLE IF NOT EXISTS.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = join(ROOT, 'wrangler.toml')
const DB_NAME = process.env.D1_NAME || 'fitness'

const bold = (s) => `[1m${s}[0m`
const red = (s) => `[31m${s}[0m`
const green = (s) => `[32m${s}[0m`

function wrangler(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (allowFailure) return `${error.stdout || ''}${error.stderr || ''}`
    process.stderr.write(`${error.stdout || ''}${error.stderr || ''}`)
    throw error
  }
}

function fail(message, hint) {
  console.error(`\n${red('✗')} ${message}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

/**
 * Pull the database id out of `wrangler d1 list --json`.
 * Exported for testing — the fragile part is the parsing, not the network call.
 */
export function findDatabaseId(jsonText, name) {
  // Wrangler prints banner lines above the JSON, so start at the first bracket.
  const start = jsonText.indexOf('[')
  const end = jsonText.lastIndexOf(']')
  if (start === -1 || end === -1) return null

  let databases
  try {
    databases = JSON.parse(jsonText.slice(start, end + 1))
  } catch {
    return null
  }

  const match = databases.find((db) => db.name === name)
  return match?.uuid || match?.database_id || null
}

/**
 * Replace the placeholder (or a previous id) on the database_id line.
 * Exported for testing.
 */
export function applyDatabaseId(toml, id) {
  if (!/^\s*database_id\s*=/m.test(toml)) {
    throw new Error('wrangler.toml has no database_id line to update')
  }
  return toml.replace(/^(\s*database_id\s*=\s*).*$/m, `$1"${id}"`)
}

// --------------------------------------------------------------------- main

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(bold('\nSetting up Cloudflare for the fitness tracker\n'))

  // 1. Auth ---------------------------------------------------------------
  const who = wrangler(['whoami'], { allowFailure: true })
  if (/not authenticated/i.test(who)) {
    fail('You are not signed in to Cloudflare.', 'Run: npx wrangler login')
  }
  const account = who.match(/([\w .'-]+?)\s*\|\s*([0-9a-f]{32})/)
  console.log(`${green('✓')} Signed in${account ? ` as ${account[1].trim()}` : ''}`)

  // 2. Database -----------------------------------------------------------
  const created = wrangler(['d1', 'create', DB_NAME], { allowFailure: true })
  if (/already exists/i.test(created)) {
    console.log(`${green('✓')} Database "${DB_NAME}" already exists — reusing it`)
  } else if (/error|✘/i.test(created) && !/uuid|database_id/i.test(created)) {
    process.stderr.write(created)
    fail(`Could not create the "${DB_NAME}" database.`)
  } else {
    console.log(`${green('✓')} Created database "${DB_NAME}"`)
  }

  // 3. Resolve its id -----------------------------------------------------
  const listed = wrangler(['d1', 'list', '--json'], { allowFailure: true })
  const id = findDatabaseId(listed, DB_NAME)
  if (!id) {
    fail(
      `Created the database but could not read its id automatically.`,
      `Run "npx wrangler d1 list" and paste the id into the database_id line of wrangler.toml, then run: npm run db:init`
    )
  }

  // 4. Write it into the config ------------------------------------------
  const toml = readFileSync(CONFIG, 'utf8')
  const updated = applyDatabaseId(toml, id)
  if (updated !== toml) {
    writeFileSync(CONFIG, updated)
    console.log(`${green('✓')} Wrote database_id into wrangler.toml`)
  } else {
    console.log(`${green('✓')} wrangler.toml already points at this database`)
  }

  // 5. Schema -------------------------------------------------------------
  console.log('  Applying schema…')
  wrangler(['d1', 'execute', DB_NAME, '--remote', '--file=./schema.sql', '-y'])
  console.log(`${green('✓')} Tables created`)

  console.log(bold('\nTwo steps left:\n'))
  console.log('  npx wrangler secret put APP_PASSCODE   # the code that unlocks the app')
  console.log('  npm run deploy\n')
}
