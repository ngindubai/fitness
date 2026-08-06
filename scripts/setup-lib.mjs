/**
 * Pure helpers for the Cloudflare setup script.
 *
 * These live apart from setup.mjs so that setup.mjs can run its main routine
 * unconditionally. An `import.meta.url === argv[1]` guard is the usual way to
 * make a script importable, but it silently evaluates false on Windows — the
 * script then exits 0 having done nothing, which is the worst way for setup to
 * fail. No guard, no failure mode.
 */

/**
 * Pull a database id out of `wrangler d1 list --json` output.
 * @returns {string|null} null when the output is unusable — never a guess.
 */
export function findDatabaseId(jsonText, name) {
  // Wrangler prints banner lines above the JSON payload.
  const start = jsonText.indexOf('[')
  const end = jsonText.lastIndexOf(']')
  if (start === -1 || end === -1) return null

  let databases
  try {
    databases = JSON.parse(jsonText.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(databases)) return null

  const match = databases.find((db) => db?.name === name)
  return match?.uuid || match?.database_id || null
}

/** Replace the placeholder (or a previous id) on the database_id line. */
export function applyDatabaseId(toml, id) {
  if (!/^\s*database_id\s*=/m.test(toml)) {
    throw new Error('wrangler.toml has no database_id line to update')
  }
  return toml.replace(/^(\s*database_id\s*=\s*).*$/m, `$1"${id}"`)
}

/** A database name safe to pass as a process argument. */
export function isValidDatabaseName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(name)
}
