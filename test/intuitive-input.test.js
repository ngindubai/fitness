import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseMeal } from '../src/parse.js'
import { FOODS } from '../src/data/foods.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const first = (text) => parseMeal(text)[0]

// ------------------------------------------------- quantity-anywhere parsing

test('quantity works in any position, not just leading', () => {
  const lead = first('2 slices white bread')
  const trail = first('white bread 2 slices')
  assert.ok(lead.recognised && trail.recognised, 'both orders recognised')
  assert.equal(trail.foodId, lead.foodId)
  assert.equal(trail.grams, lead.grams)
  assert.equal(trail.kcal, lead.kcal)

  const worded = first('toast two slices')
  assert.ok(worded.recognised)
  assert.equal(worded.grams, lead.grams)
})

test('multiplier and trailing-count notation', () => {
  const x2 = first('banana x2')
  assert.equal(x2.foodId, 'banana')
  assert.equal(x2.grams, first('2 bananas').grams)

  const spaced = first('flat white x 3')
  assert.equal(spaced.foodId, 'flat_white')

  const bare = first('eggs 3')
  assert.equal(bare.foodId, 'egg')
  assert.equal(bare.grams, first('3 eggs').grams)

  // A dish with a number in its name must not explode into 65 portions.
  const named = first('chicken 65')
  assert.ok(named.grams <= 400, `chicken 65 → ${named.grams} g`)
})

test('a bare leading unit without "of" still reads as one portion', () => {
  const item = first('slice white bread')
  assert.equal(item.foodId, first('1 slice white bread').foodId)
  assert.equal(item.grams, first('1 slice white bread').grams)
})

// ------------------------------------------------------------- new library

test('satay sauce and friends are recognised', () => {
  assert.equal(first('satay sauce').foodId, 'satay_sauce')
  assert.equal(first('chicken satay').foodId, 'satay_chicken')
  assert.equal(first('2 tbsp peanut sauce').foodId, 'satay_sauce')
})

test('a sweep of new library entries parses to the right rows', () => {
  const expectations = [
    ['gyros', 'gyros'],
    ['chicken quesadilla', 'quesadilla'],
    ['cappuccino', 'cappuccino'],
    ['snickers', 'choc_bar'],
    ['roast potatoes', 'roast_potatoes'],
    ['sea bass fillet', 'seabass'],
    ['2 scoops sorbet', 'sorbet'],
    ['tzatziki', 'tzatziki'],
    ['brioche bun', 'brioche'],
    ['spag bol', 'spag_bol'],
    ['mac and cheese', 'mac_cheese'],
    ['tandoori chicken', 'chicken_tikka'],
    ['umm ali', 'umm_ali'],
    ['mint lemonade', 'mint_lemonade'],
    ['sunday roast', 'sunday_roast'],
    ['3 onion rings', 'onion_rings'],
    ['pomegranate', 'pomegranate'],
    ['watermelon', 'watermelon'],
    ['kimchi', 'kimchi'],
    ['prosecco', 'prosecco'],
  ]
  for (const [text, expected] of expectations) {
    assert.equal(first(text).foodId, expected, `"${text}" → ${first(text).foodId}, wanted ${expected}`)
  }
})

test('porridge means the cooked bowl; oats stay dry', () => {
  assert.equal(first('bowl of porridge').foodId, 'porridge')
  assert.equal(first('60g oats').foodId, 'oats')
  // The made-up bowl must not carry dry-oat calories.
  const bowl = first('porridge')
  assert.ok(bowl.kcal < 500, `a bowl of porridge came out at ${bowl.kcal} kcal`)
})

test('the library is genuinely massive now', () => {
  assert.ok(FOODS.length >= 460, `library holds ${FOODS.length} foods`)
})

// -------------------------------------- retro-logging refreshes the review

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-mech-test-'))
  return { store: new FileStore(join(dir, 'data.json')), secret: 'test-secret', passcode: 'boss-code', aiKey: null }
}

function call(ctx, path, { method = 'GET', token, body } = {}) {
  return handleApi(
    new Request(`http://x/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
    ctx
  )
}

test('adding training to a past day updates its deficit AND its cached review', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const { today } = await (await call(ctx, '/profile', { token })).json()
  const yesterday = (() => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  // Log a meal yesterday, then read the review so it caches.
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'meal', date: yesterday, text: '200g chicken breast, 150g rice' } })
  const firstReview = await (await call(ctx, `/review?date=${yesterday}`, { token })).json()
  const cachedCheck = await (await call(ctx, `/review?date=${yesterday}`, { token })).json()
  assert.ok(cachedCheck.cached, 'review for a finished day is cached')

  // Retro-log training: the cache must be discarded, the numbers must move.
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'workout', date: yesterday, text: 'bench 3x8 80kg, rowing machine 20 min' } })
  const after = await (await call(ctx, `/review?date=${yesterday}`, { token })).json()
  assert.ok(!after.cached, 'stale review was invalidated')
  assert.ok(after.day.training.kcal > 0, 'training now counts')
  assert.ok(after.day.caloriesOut > firstReview.day.caloriesOut, 'calories out rose')
  assert.ok(after.day.deficit > firstReview.day.deficit, 'the deficit moved')

  // Deleting that workout invalidates again.
  const entries = await (await call(ctx, `/day?date=${yesterday}`, { token })).json()
  const workoutId = entries.entries.workouts[0].id
  await (await call(ctx, `/review?date=${yesterday}`, { token })).json() // re-cache
  await call(ctx, `/entries/${workoutId}`, { method: 'DELETE', token })
  const cleared = await (await call(ctx, `/review?date=${yesterday}`, { token })).json()
  assert.ok(!cleared.cached)
  assert.equal(cleared.day.training.kcal, 0)
})
