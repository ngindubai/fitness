import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'
import { hashPasscode, verifyPasscodeHash } from '../src/auth.js'

/** Drive the real router against a real (temp-file) store. */
function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-test-'))
  return {
    store: new FileStore(join(dir, 'data.json')),
    secret: 'test-secret',
    passcode: 'boss-code',
    aiKey: null,
  }
}

function call(ctx, path, { method = 'GET', token, body } = {}) {
  return handleApi(
    new Request(`http://x/api${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    ctx
  )
}

test('passcode hashing round-trips and rejects the wrong code', async () => {
  const { salt, hash } = await hashPasscode('1234')
  assert.ok(await verifyPasscodeHash('1234', salt, hash))
  assert.ok(!(await verifyPasscodeHash('1235', salt, hash)))
  // Per-user salts: same passcode, different hashes.
  const second = await hashPasscode('1234')
  assert.notEqual(second.hash, hash)
})

test('owner logs in with APP_PASSCODE exactly as before', async () => {
  const ctx = makeCtx()
  const response = await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })
  assert.equal(response.status, 200)
  const { token } = await response.json()
  assert.ok(token)

  const day = await call(ctx, '/day', { token })
  assert.equal(day.status, 200)
})

test('signup creates a user who can immediately use the app', async () => {
  const ctx = makeCtx()
  const response = await call(ctx, '/signup', { method: 'POST', body: { passcode: 'wife-pass', name: 'Sara' } })
  assert.equal(response.status, 201)
  const { token, name } = await response.json()
  assert.equal(name, 'Sara')

  // Their profile carries their name from day one.
  const profile = await (await call(ctx, '/profile', { token })).json()
  assert.equal(profile.profile.name, 'Sara')

  // And logging in later with the same passcode returns the same account.
  const login = await call(ctx, '/login', { method: 'POST', body: { passcode: 'wife-pass' } })
  assert.equal(login.status, 200)
  const secondToken = (await login.json()).token
  const sameProfile = await (await call(ctx, '/profile', { token: secondToken })).json()
  assert.equal(sameProfile.profile.name, 'Sara')
})

test('users cannot see each other\'s data - the whole point', async () => {
  const ctx = makeCtx()
  const owner = (await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()).token
  const guest = (await (await call(ctx, '/signup', { method: 'POST', body: { passcode: 'guest-99', name: 'G' } })).json()).token

  // Owner logs a meal.
  const saved = await call(ctx, '/entries', {
    method: 'POST', token: owner,
    body: { kind: 'meal', date: '2026-08-06', slot: 'lunch', text: '200g chicken breast' },
  })
  assert.equal(saved.status, 201)
  const entryId = (await saved.json()).entry.id

  // The guest's day is empty; the owner's is not.
  const guestDay = await (await call(ctx, '/day?date=2026-08-06', { token: guest })).json()
  const ownerDay = await (await call(ctx, '/day?date=2026-08-06', { token: owner })).json()
  assert.equal(guestDay.day.caloriesIn, 0)
  assert.ok(ownerDay.day.caloriesIn > 200)

  // The guest cannot delete or edit the owner's entry.
  const del = await call(ctx, `/entries/${entryId}`, { method: 'DELETE', token: guest })
  assert.equal(del.status, 404)
  const patch = await call(ctx, `/entries/${entryId}`, { method: 'PATCH', token: guest, body: { removeIndex: 0 } })
  assert.equal(patch.status, 404)

  // Profiles are independent: guest changes theirs, owner's is untouched.
  await call(ctx, '/profile', { method: 'PUT', token: guest, body: { weightKg: 70, age: 30 } })
  const ownerProfile = await (await call(ctx, '/profile', { token: owner })).json()
  assert.equal(ownerProfile.profile.weightKg, 115)
})

test('duplicate and weak passcodes are rejected', async () => {
  const ctx = makeCtx()
  await call(ctx, '/signup', { method: 'POST', body: { passcode: 'guest-99' } })

  const dupe = await call(ctx, '/signup', { method: 'POST', body: { passcode: 'guest-99' } })
  assert.equal(dupe.status, 409)

  // A new user cannot register the founder's passcode and shadow the account.
  const shadow = await call(ctx, '/signup', { method: 'POST', body: { passcode: 'boss-code' } })
  assert.equal(shadow.status, 409)

  const weak = await call(ctx, '/signup', { method: 'POST', body: { passcode: '123' } })
  assert.equal(weak.status, 400)
})

test('wrong passcode still fails, and old owner tokens still verify', async () => {
  const ctx = makeCtx()
  const bad = await call(ctx, '/login', { method: 'POST', body: { passcode: 'nope' } })
  assert.equal(bad.status, 401)

  // Tokens minted before multi-user carried sub "owner" - simulate one.
  const { issueToken } = await import('../src/auth.js')
  const legacy = await issueToken(ctx.secret, 'owner')
  const day = await call(ctx, '/day', { token: legacy })
  assert.equal(day.status, 200)
})

test('unrecognised food comes back with did-you-mean suggestions', async () => {
  const ctx = makeCtx()
  const token = (await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()).token

  const parsed = await (await call(ctx, '/parse', {
    method: 'POST', token,
    body: { kind: 'meal', text: 'chiken brest and haloumi chese' },
  })).json()

  // "haloumi" is a direct alias now, so that item parses outright...
  const halloumi = parsed.items.find((i) => i.raw.includes('haloumi'))
  assert.equal(halloumi.recognised, true)
  assert.equal(halloumi.foodId, 'halloumi')

  // ...while the double-typo item comes back with did-you-mean suggestions.
  const typo = parsed.items.find((i) => !i.recognised)
  assert.ok(typo, 'expected one unrecognised item')
  assert.ok(typo.suggestions.length > 0, `no suggestions for "${typo.raw}"`)
  assert.match(typo.suggestions.map((s) => s.name).join('|'), /Chicken breast/)
})

test('the old single-user data file upgrades in place', async () => {
  const { writeFileSync } = await import('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'fitness-legacy-'))
  const path = join(dir, 'data.json')
  writeFileSync(path, JSON.stringify({
    profile: { name: 'Gareth', weightKg: 114, age: 37 },
    entries: [{ id: 'e1', date: '2026-08-01', kind: 'meal', slot: 'lunch', raw: 'x', createdAt: '2026-08-01T10:00:00Z',
      items: [{ foodId: 'egg', name: 'Egg', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fibre: 0, sugar: 0.4, grams: 100, recognised: true, tags: [] }] }],
    reviews: { '2026-08-01': { score: 50 } },
  }))

  const store = new FileStore(path)
  const profile = await store.getProfile('owner')
  assert.equal(profile.name, 'Gareth')
  assert.equal(profile.weightKg, 114)

  const entries = await store.listEntries('owner', '2026-08-01', '2026-08-01')
  assert.equal(entries.length, 1)

  const review = await store.getReview('owner', '2026-08-01')
  assert.equal(review.score, 50)

  // And a different user sees none of it.
  assert.equal((await store.listEntries('someone-else', '2026-08-01', '2026-08-01')).length, 0)
})

test('new foods parse directly: the Dubai set', async () => {
  const { parseMeal } = await import('../src/parse.js')
  const expectations = [
    ['chicken shawarma', 'shawarma_chicken'],
    ['2 falafel', 'falafel'],
    ['grilled halloumi', 'halloumi'],
    ['labneh', 'labneh'],
    ['chicken biryani', 'biryani'],
    ['lamb mandi', 'kabsa'],
    ['karak chai', 'karak'],
    ['shakshuka', 'shakshuka'],
    ['kofta', 'kofta'],
    ['baklava', 'baklava'],
    ['a latte', 'latte'],
    ['6 chicken nuggets', 'nuggets'],
    ['skyr', 'skyr'],
    ['poke bowl', 'poke_bowl'],
    ['fillet steak', 'fillet_steak'],
  ]
  for (const [text, expected] of expectations) {
    const [item] = parseMeal(text)
    assert.equal(item.foodId, expected, `"${text}" -> ${item.foodId}`)
  }
})

test('new exercises land on the right movement', async () => {
  const { parseWorkoutPhrase } = await import('../src/parse.js')
  assert.equal(parseWorkoutPhrase('back extension 3x12').exercise.id, 'back_extension')
  assert.equal(parseWorkoutPhrase('hip abduction 3x15').exercise.id, 'hip_abduction')
  assert.equal(parseWorkoutPhrase('burpees 5x20').exercise.id, 'burpee')
  assert.equal(parseWorkoutPhrase('chest press machine 3x10 50kg').exercise.id, 'chest_press_machine')
  assert.equal(parseWorkoutPhrase('arnold press 3x12 20kg').exercise.id, 'arnold_press')
  assert.equal(parseWorkoutPhrase('sumo deadlift 3x5 160kg').exercise.id, 'deadlift')
  assert.equal(parseWorkoutPhrase('20 min assault bike').activityId, 'assault_bike')
  assert.equal(parseWorkoutPhrase('pickleball 45 min').activityId, 'pickleball')
})
