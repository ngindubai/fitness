/**
 * Cloudflare D1 storage adapter.
 *
 * D1 is SQLite, so the schema in schema.sql is the single source of truth and
 * the Node adapter mirrors this interface exactly.
 */

import { DEFAULT_PROFILE } from '../engine.js'

export class D1Store {
  /** @param {D1Database} db */
  constructor(db) {
    this.db = db
  }

  async getProfile() {
    const row = await this.db.prepare('SELECT data FROM profile WHERE id = 1').first()
    if (!row) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(row.data) }
  }

  async setProfile(profile) {
    const merged = { ...DEFAULT_PROFILE, ...profile }
    await this.db
      .prepare(
        `INSERT INTO profile (id, data, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .bind(JSON.stringify(merged), new Date().toISOString())
      .run()
    return merged
  }

  async listEntries(fromDate, toDate) {
    const { results } = await this.db
      .prepare(
        `SELECT id, date, kind, slot, raw, items, value, created_at
         FROM entries WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC`
      )
      .bind(fromDate, toDate)
      .all()
    return (results || []).map(hydrate)
  }

  async getEntry(id) {
    const row = await this.db
      .prepare('SELECT id, date, kind, slot, raw, items, value, created_at FROM entries WHERE id = ?')
      .bind(id)
      .first()
    return row ? hydrate(row) : null
  }

  async addEntry(entry) {
    await this.db
      .prepare(
        `INSERT INTO entries (id, date, kind, slot, raw, items, value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.id,
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

  async updateEntry(id, patch) {
    const existing = await this.getEntry(id)
    if (!existing) return null
    const next = { ...existing, ...patch }
    await this.db
      .prepare(`UPDATE entries SET date = ?, kind = ?, slot = ?, raw = ?, items = ?, value = ? WHERE id = ?`)
      .bind(
        next.date,
        next.kind,
        next.slot ?? null,
        next.raw ?? null,
        JSON.stringify(next.items ?? []),
        next.value ?? null,
        id
      )
      .run()
    return next
  }

  async deleteEntry(id) {
    const result = await this.db.prepare('DELETE FROM entries WHERE id = ?').bind(id).run()
    return (result.meta?.changes ?? 0) > 0
  }

  async getReview(date) {
    const row = await this.db.prepare('SELECT data FROM reviews WHERE date = ?').bind(date).first()
    return row ? JSON.parse(row.data) : null
  }

  async setReview(date, data) {
    await this.db
      .prepare(
        `INSERT INTO reviews (date, data, created_at) VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`
      )
      .bind(date, JSON.stringify(data), new Date().toISOString())
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
