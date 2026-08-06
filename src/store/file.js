/**
 * JSON-file storage adapter for local development and self-hosted Node.
 *
 * Deliberately dependency-free. The dataset is one person's food log, which
 * stays comfortably small, so the whole file is read and written on each
 * mutation and writes are serialised through a promise chain to avoid
 * interleaved writers clobbering each other.
 *
 * Note: on Render's free tier the filesystem is ephemeral, so this adapter
 * loses data on every restart. Use D1 for anything you care about keeping.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_PROFILE } from '../engine.js'

const EMPTY = { profile: null, entries: [], reviews: {} }

export class FileStore {
  /** @param {string} path */
  constructor(path) {
    this.path = path
    this.queue = Promise.resolve()
  }

  async #read() {
    try {
      const text = await readFile(this.path, 'utf8')
      return { ...EMPTY, ...JSON.parse(text) }
    } catch (error) {
      if (error.code === 'ENOENT') return { ...EMPTY }
      throw error
    }
  }

  async #write(data) {
    await mkdir(dirname(this.path), { recursive: true })
    // Write to a temp file and rename, so a crash mid-write cannot truncate
    // an existing log.
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
    // Keep the chain alive even if one mutation rejects.
    this.queue = run.catch(() => {})
    return run
  }

  async getProfile() {
    const data = await this.#read()
    return { ...DEFAULT_PROFILE, ...(data.profile || {}) }
  }

  async setProfile(profile) {
    return this.#mutate((data) => {
      data.profile = { ...DEFAULT_PROFILE, ...profile }
      return data.profile
    })
  }

  async listEntries(fromDate, toDate) {
    const data = await this.#read()
    return data.entries
      .filter((e) => e.date >= fromDate && e.date <= toDate)
      .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
  }

  async getEntry(id) {
    const data = await this.#read()
    return data.entries.find((e) => e.id === id) || null
  }

  async addEntry(entry) {
    return this.#mutate((data) => {
      data.entries.push(entry)
      return entry
    })
  }

  async updateEntry(id, patch) {
    return this.#mutate((data) => {
      const index = data.entries.findIndex((e) => e.id === id)
      if (index === -1) return null
      data.entries[index] = { ...data.entries[index], ...patch }
      return data.entries[index]
    })
  }

  async deleteEntry(id) {
    return this.#mutate((data) => {
      const before = data.entries.length
      data.entries = data.entries.filter((e) => e.id !== id)
      return data.entries.length < before
    })
  }

  async getReview(date) {
    const data = await this.#read()
    return data.reviews[date] || null
  }

  async setReview(date, review) {
    return this.#mutate((data) => {
      data.reviews[date] = review
      return review
    })
  }
}
