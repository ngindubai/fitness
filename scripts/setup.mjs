#!/usr/bin/env node
/**
 * One-shot Cloudflare setup.
 *
 * Creates the D1 database, writes its id into wrangler.toml and applies the
 * schema. The manual version of this is "copy the uuid wrangler printed and
 * paste it into the right line of a TOML file", which fails at deploy time
 * rather than at setup time if you get it wrong.
 *
 * Safe to re-run: an existing database is reused rather than duplicated, and
 * the schema uses CREATE TABLE IF NOT EXISTS.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

import { findDatabaseId, applyDatabaseId, isValidDatabaseName } from './setup-lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = join(ROOT, 'wrangler.toml')
const DB_NAME = process.env.D1_NAME || 'fitness'

// Wrangler's JS entry point, run with the current node binary. Spawning "npx"
// instead would need a shell on Windows, where npx is a .cmd — this avoids
// both the shell and the platform difference.
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const bold = (s) => `[1m${s}[0m`
const red = (s) => `[31m${s}[0m`
const green = (s) => `[32m${s}[0m`

function fail(message, hint) {
  console.error(`\n${red('✗')} ${message}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

function wrangler(args, { allowFailure = false } = {}) {
  try {
    return execFileSync(process.execPath, [WRANGLER, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`
    if (allowFailure) return output
    process.stderr.write(output)
    fail(`wrangler ${args.join(' ')} failed.`)
  }
}

console.log(bold('\nSetting up Cloudflare for the fitness tracker\n'))

if (!isValidDatabaseName(DB_NAME)) {
  fail(`"${DB_NAME}" is not a valid database name.`, 'Letters, numbers, dashes and underscores only.')
}

if (!existsSync(WRANGLER)) {
  fail('Could not find wrangler in node_modules.', 'Run: npm install')
}

// 1. Auth -------------------------------------------------------------------
const who = wrangler(['whoami'], { allowFailure: true })
if (/not authenticated|wrangler login/i.test(who)) {
  fail('You are not signed in to Cloudflare.', 'Run: npx wrangler login')
}
const account = who.match(/([\w .'-]+?)\s*\|\s*([0-9a-f]{32})/)
console.log(`${green('✓')} Signed in${account ? ` as ${account[1].trim()}` : ''}`)

// 2. Database ---------------------------------------------------------------
const created = wrangler(['d1', 'create', DB_NAME], { allowFailure: true })
if (/already exists/i.test(created)) {
  console.log(`${green('✓')} Database "${DB_NAME}" already exists — reusing it`)
} else if (/database_id|uuid|created your new/i.test(created)) {
  console.log(`${green('✓')} Created database "${DB_NAME}"`)
} else {
  process.stderr.write(created)
  fail(`Could not create the "${DB_NAME}" database.`)
}

// 3. Resolve its id ---------------------------------------------------------
const listed = wrangler(['d1', 'list', '--json'], { allowFailure: true })
const id = findDatabaseId(listed, DB_NAME)
if (!id) {
  process.stderr.write(listed)
  fail(
    'The database exists but its id could not be read automatically.',
    `Run "npx wrangler d1 list", copy the id for "${DB_NAME}" into the database_id line of wrangler.toml, then run: npm run db:init`
  )
}

// 4. Write it into the config ----------------------------------------------
const toml = readFileSync(CONFIG, 'utf8')
const updated = applyDatabaseId(toml, id)
if (updated === toml) {
  console.log(`${green('✓')} wrangler.toml already points at this database`)
} else {
  writeFileSync(CONFIG, updated)
  console.log(`${green('✓')} Wrote database_id ${id} into wrangler.toml`)
}

// 5. Schema -----------------------------------------------------------------
console.log('  Applying schema…')
wrangler(['d1', 'execute', DB_NAME, '--remote', '--file=./schema.sql', '-y'])
console.log(`${green('✓')} Tables created`)

console.log(bold('\nTwo steps left:\n'))
console.log('  npx wrangler secret put APP_PASSCODE   # the code that unlocks the app')
console.log('  npm run deploy\n')
