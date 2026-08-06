/**
 * Cloudflare D1 storage adapter — multi-user.
 *
 * Every read and write is scoped by user id. The original single-user data
 * carries user id 'owner' (see migrations/002-multi-tenant.sql), and the
 * APP_PASSCODE login maps to that id, so nothing moved for the first user.
 */

import { DEFAULT_PROFILE } from '../engine.js'

export class D1Store {
  /** @param {D1Database} db */
  constructor(db) {
    this.db = db
  }

  // ---------------------------------------------------------------- users

  async listUsers() {
    const { results } = await this.db
      .prepare('SELECT id, name, passcode_hash, salt, created_at FROM users')
      .all()
    return (results || []).map((row) => ({
      id: row.id,
      name: row.name,
      passcodeHash: row.passcode_hash,
      salt: row.salt,
      createdAt: row.created_at,
    }))
  }

  async createUser({ id, name, passcodeHash, salt }) {
    await this.db
      .prepare('INSERT INTO users (id, name, passcode_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name || null, passcodeHash, salt, new Date().toISOString())
      .run()
    return { id, name }
  }

  // -------------------------------------------------------------- profile

  async getProfile(userId) {
    const row = await this.db
      .prepare('SELECT data FROM profiles WHERE user_id = ?')
      .bind(userId)
      .first()
    if (!row) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(row.data) }
  }

  async setProfile(userId, profile) {
    const merged = { ...DEFAULT_PROFILE, ...profile }
    await this.db
      .prepare(
        `INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .bind(userId, JSON.stringify(merged), new Date().toISOString())
      .run()
    return merged
  }

  // -------------------------------------------------------------- entries

  async listEntries(userId, fromDate, toDate) {
    const { results } = await this.db
      .prepare(
        `SELECT id, date, kind, slot, raw, items, value, created_at
         FROM entries WHERE user_id = ? AND date >= ? AND date <= ?
         ORDER BY date ASC, created_at ASC`
      )
      .bind(userId, fromDate, toDate)
      .all()
    return (results || []).map(hydrate)
  }

  async getEntry(userId, id) {
    const row = await this.db
      .prepare(
        'SELECT id, date, kind, slot, raw, items, value, created_at FROM entries WHERE id = ? AND user_id = ?'
      )
      .bind(id, userId)
      .first()
    return row ? hydrate(row) : null
  }

  async addEntry(userId, entry) {
    await this.db
      .prepare(
        `INSERT INTO entries (id, user_id, date, kind, slot, raw, items, value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.id,
        userId,
        entry.date,
        entry.kind,
        entry.slot ?? null,
        entry.raw ?? null,
        JSON.stringify(entry.items ?? []),
        entry.value ?? null,
        entry.createdAt
      )
      .run()
    return entry
  }

  async updateEntry(userId, id, patch) {
    const existing = await this.getEntry(userId, id)
    if (!existing) return null
    const next = { ...existing, ...patch }
    await this.db
      .prepare(
        `UPDATE entries SET date = ?, kind = ?, slot = ?, raw = ?, items = ?, value = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(
        next.date,
        next.kind,
        next.slot ?? null,
        next.raw ?? null,
        JSON.stringify(next.items ?? []),
        next.value ?? null,
        id,
        userId
      )
      .run()
    return next
  }

  async deleteEntry(userId, id) {
    const result = await this.db
      .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run()
    return (result.meta?.changes ?? 0) > 0
  }

  // --------------------------------------------------------------- pantry

  /**
   * The pantry table creates itself on first use. Deploys are hands-off via
   * Git integration now, so a schema change must not depend on anyone
   * remembering to run a migration from a terminal.
   */
  async #ensurePantry() {
    if (this.#pantryReady) return
    await this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS pantry (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           data TEXT NOT NULL,
           created_at TEXT NOT NULL
         )`
      )
      .run()
    await this.db
      .prepare('CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry (user_id)')
      .run()
    this.#pantryReady = true
  }
  #pantryReady = false

  async listPantry(userId) {
    await this.#ensurePantry()
    const { results } = await this.db
      .prepare('SELECT data FROM pantry WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all()
    return (results || []).map((row) => JSON.parse(row.data))
  }

  /**
   * Everyone else's scans. One person photographs a label once and the whole
   * household can log that product — reads are free on D1, so this costs
   * nothing but the query.
   */
  async listSharedPantry(userId) {
    await this.#ensurePantry()
    const { results } = await this.db
      .prepare('SELECT data FROM pantry WHERE user_id != ? ORDER BY created_at DESC LIMIT 500')
      .bind(userId)
      .all()
    return (results || []).map((row) => JSON.parse(row.data))
  }

  async addPantryItem(userId, item) {
    await this.#ensurePantry()
    await this.db
      .prepare('INSERT INTO pantry (id, user_id, data, created_at) VALUES (?, ?, ?, ?)')
      .bind(item.id, userId, JSON.stringify(item), new Date().toISOString())
      .run()
    return item
  }

  async deletePantryItem(userId, id) {
    await this.#ensurePantry()
    const result = await this.db
      .prepare('DELETE FROM pantry WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run()
    return (result.meta?.changes ?? 0) > 0
  }

  // -------------------------------------------------------------- reviews

  async getReview(userId, date) {
    const row = await this.db
      .prepare('SELECT data FROM reviews WHERE user_id = ? AND date = ?')
      .bind(userId, date)
      .first()
    return row ? JSON.parse(row.data) : null
  }

  async deleteReview(userId, date) {
    await this.db
      .prepare('DELETE FROM reviews WHERE user_id = ? AND date = ?')
      .bind(userId, date)
      .run()
  }

  async setReview(userId, date, data) {
    await this.db
      .prepare(
        `INSERT INTO reviews (user_id, date, data, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`
      )
      .bind(userId, date, JSON.stringify(data), new Date().toISOString())
      .run()
    return data
  }
}

function hydrate(row) {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    slot: row.slot,
    raw: row.raw,
    items: row.items ? JSON.parse(row.items) : [],
    value: row.value,
    createdAt: row.created_at,
  }
}
