/**
 * JSON-file storage adapter for local development and self-hosted Node —
 * multi-user, mirroring the D1 adapter's interface exactly.
 *
 * Files written by the single-user version are upgraded on read: the old
 * `profile` object becomes profiles.owner, date-keyed `reviews` become
 * reviews.owner, and entries without a userId belong to 'owner'.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_PROFILE } from '../engine.js'

const EMPTY = { users: [], profiles: {}, entries: [], reviews: {} }

export class FileStore {
  /** @param {string} path */
  constructor(path) {
    this.path = path
    this.queue = Promise.resolve()
  }

  async #read() {
    let data
    try {
      data = JSON.parse(await readFile(this.path, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(EMPTY)
      throw error
    }
    return upgrade(data)
  }

  async #write(data) {
    await mkdir(dirname(this.path), { recursive: true })
    const tmp = `${this.path}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await rename(tmp, this.path)
  }

  /** Serialise mutations so concurrent requests cannot lose writes. */
  #mutate(fn) {
    const run = this.queue.then(async () => {
      const data = await this.#read()
      const result = await fn(data)
      await this.#write(data)
      return result
    })
    this.queue = run.catch(() => {})
    return run
  }

  // ---------------------------------------------------------------- users

  async listUsers() {
    const data = await this.#read()
    return data.users
  }

  async createUser({ id, name, passcodeHash, salt }) {
    return this.#mutate((data) => {
      data.users.push({ id, name: name || null, passcodeHash, salt, createdAt: new Date().toISOString() })
      return { id, name }
    })
  }

  // -------------------------------------------------------------- profile

  async getProfile(userId) {
    const data = await this.#read()
    return { ...DEFAULT_PROFILE, ...(data.profiles[userId] || {}) }
  }

  async setProfile(userId, profile) {
    return this.#mutate((data) => {
      data.profiles[userId] = { ...DEFAULT_PROFILE, ...profile }
      return data.profiles[userId]
    })
  }

  // -------------------------------------------------------------- entries

  async listEntries(userId, fromDate, toDate) {
    const data = await this.#read()
    return data.entries
      .filter((e) => (e.userId || 'owner') === userId && e.date >= fromDate && e.date <= toDate)
      .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
  }

  async getEntry(userId, id) {
    const data = await this.#read()
    return data.entries.find((e) => e.id === id && (e.userId || 'owner') === userId) || null
  }

  async addEntry(userId, entry) {
    return this.#mutate((data) => {
      data.entries.push({ ...entry, userId })
      return entry
    })
  }

  async updateEntry(userId, id, patch) {
    return this.#mutate((data) => {
      const index = data.entries.findIndex((e) => e.id === id && (e.userId || 'owner') === userId)
      if (index === -1) return null
      data.entries[index] = { ...data.entries[index], ...patch }
      return data.entries[index]
    })
  }

  async deleteEntry(userId, id) {
    return this.#mutate((data) => {
      const before = data.entries.length
      data.entries = data.entries.filter((e) => !(e.id === id && (e.userId || 'owner') === userId))
      return data.entries.length < before
    })
  }

  // -------------------------------------------------------------- reviews

  async getReview(userId, date) {
    const data = await this.#read()
    return data.reviews[userId]?.[date] || null
  }

  async setReview(userId, date, review) {
    return this.#mutate((data) => {
      if (!data.reviews[userId]) data.reviews[userId] = {}
      data.reviews[userId][date] = review
      return review
    })
  }
}

/** Upgrade a pre-multi-user file in place. Idempotent. */
function upgrade(data) {
  const upgraded = { ...structuredClone(EMPTY), ...data }

  // v1 had a single `profile` object.
  if (data.profile && !upgraded.profiles.owner) {
    upgraded.profiles = { ...upgraded.profiles, owner: data.profile }
  }
  delete upgraded.profile

  // v1 reviews were keyed by date at the top level.
  const reviewKeys = Object.keys(upgraded.reviews)
  const looksDateKeyed = reviewKeys.length && reviewKeys.every((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
  if (looksDateKeyed) {
    upgraded.reviews = { owner: upgraded.reviews }
  }

  if (!Array.isArray(upgraded.users)) upgraded.users = []
  return upgraded
}
