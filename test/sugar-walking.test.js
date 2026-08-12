import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FOODS, FOODS_BY_ID } from '../src/data/foods.js'
import { freeSugarShareFor, freeSugarTarget } from '../src/sugar.js'
import { parseMeal, parseWorkout, activityKcal } from '../src/parse.js'
import { buildDay, targetsFor, climateAdjustedKcal, DEFAULT_PROFILE, HEAT_MULTIPLIER } from '../src/engine.js'
import { ACTIVITIES_BY_ID } from '../src/data/activities.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const GARETH = { ...DEFAULT_PROFILE, sex: 'male', age: 37, heightCm: 178, weightKg: 115, climate: 'hot', onboarded: true }

// ------------------------------------------------------------ sugar mapping

test('every food gets a free-sugar share in range, and free never exceeds total', () => {
  for (const food of FOODS) {
    const share = food.freeSugarShare
    assert.ok(share >= 0 && share <= 1, `${food.id} share ${share} out of range`)
    assert.ok(food.per100.freeSugar <= food.per100.sugar + 0.05, `${food.id} free > total`)
    assert.ok(food.per100.freeSugar >= 0, `${food.id} negative free sugar`)
  }
})

test('whole fruit, veg and plain dairy contribute no free sugars', () => {
  for (const id of ['banana', 'apple', 'grapes', 'mango', 'dates', 'raisins', 'berries_mixed',
    'milk_whole', 'milk_semi', 'greek_yoghurt', 'greek_yoghurt_full', 'yoghurt_natural',
    'cottage_cheese', 'cheddar', 'carrot', 'beetroot', 'sweetcorn']) {
    const food = FOODS_BY_ID.get(id)
    assert.ok(food, `${id} missing`)
    assert.equal(food.per100.freeSugar, 0, `${id} should carry no free sugars`)
  }
})

test('juice, confectionery and sweet drinks are entirely free sugars', () => {
  for (const id of ['orange_juice', 'apple_juice', 'smoothie', 'sugarcane_juice', 'cola',
    'energy_drink', 'sugar', 'honey', 'chocolate_milk', 'gummy_sweets', 'sweet_chilli']) {
    const food = FOODS_BY_ID.get(id)
    assert.ok(food, `${id} missing`)
    assert.equal(food.per100.freeSugar, food.per100.sugar, `${id} should be all free sugars`)
  }
})

test('the classifier is driven by identity, not by the sugar figure', () => {
  // Dates read 66 g of sugar and juice reads 8.4 — yet the juice is the one
  // the guideline is about. That inversion is the whole point.
  assert.equal(freeSugarShareFor(FOODS_BY_ID.get('dates')), 0)
  assert.equal(freeSugarShareFor(FOODS_BY_ID.get('orange_juice')), 1)
  // Mixed foods land in between.
  const bread = freeSugarShareFor(FOODS_BY_ID.get('bread_white'))
  assert.ok(bread > 0 && bread < 1, `bread share ${bread} should be partial`)
})

test('parsed meals carry free sugars separately from total sugars', () => {
  const items = parseMeal('glass of orange juice, banana')
  const juice = items.find((i) => /juice/i.test(i.name))
  const banana = items.find((i) => /banana/i.test(i.name))
  assert.ok(juice.freeSugar > 15, `juice free sugars ${juice.freeSugar}`)
  assert.equal(juice.freeSugar, juice.sugar)
  assert.ok(banana.sugar > 10, 'a banana does contain sugar')
  assert.equal(banana.freeSugar, 0, 'but none of it is free sugar')
})

test('the day totals and target both track free sugars', () => {
  const day = buildDay({
    profile: GARETH, workouts: [], date: '2026-08-06',
    meals: [{ items: parseMeal('glass of orange juice, banana, 200g greek yoghurt') }],
  })
  assert.equal(day.nutrition.freeSugar, day.nutrition.sugar - 14.2 - 7.2, 'fruit and yoghurt sugars excluded')
  assert.ok(day.nutrition.sugar > day.nutrition.freeSugar, 'total exceeds free on a fruit day')
  assert.ok(day.targets.freeSugar > 0 && day.targets.freeSugar <= 30, 'NHS limit is the ceiling')
})

test('the free-sugar limit is 5% of energy, capped at the NHS 30 g', () => {
  assert.equal(freeSugarTarget(2000), 25)
  assert.equal(freeSugarTarget(4000), 30) // capped, not 50
  assert.equal(freeSugarTarget(800), 15)  // floored, never absurdly small
})

// ------------------------------------------------------------------ walking

test('walking METs match the compendium, uphill included', () => {
  assert.equal(ACTIVITIES_BY_ID.get('walk_brisk').met, 4.3)        // 17200
  assert.equal(ACTIVITIES_BY_ID.get('walk_uphill').met, 5.3)       // 17210, 1-5%
  assert.equal(ACTIVITIES_BY_ID.get('walk_uphill_steep').met, 8.0) // 17211, 6-15%
})

test('the uphill treadmill toggle costs far more than flat walking', () => {
  const [flat] = parseWorkout('brisk walk 45 min')
  const [uphill] = parseWorkout('uphill treadmill 45 min')
  assert.equal(flat.activityId, 'walk_brisk')
  assert.equal(uphill.activityId, 'walk_uphill_steep')
  const flatKcal = climateAdjustedKcal(activityKcal(flat, 115), flat, GARETH)
  const uphillKcal = climateAdjustedKcal(activityKcal(uphill, 115), uphill, GARETH)
  assert.ok(uphillKcal > flatKcal * 1.8, `uphill ${uphillKcal} vs flat ${flatKcal}`)
  // Indoors, so the hot-climate heat bonus must NOT be applied.
  assert.equal(uphill.outdoor, false)
  assert.equal(uphillKcal, activityKcal(uphill, 115))
})

test('outside warm and outside cool differ by the heat adjustment', () => {
  const [warm] = parseWorkout('brisk walk 60 min outside warm')
  const [cool] = parseWorkout('brisk walk 60 min outside cool')
  assert.equal(warm.conditions, 'warm')
  assert.equal(cool.conditions, 'cool')
  assert.equal(warm.met, cool.met, 'same pace, same MET')

  const warmKcal = climateAdjustedKcal(activityKcal(warm, 115), warm, GARETH)
  const coolKcal = climateAdjustedKcal(activityKcal(cool, 115), cool, GARETH)
  assert.ok(warmKcal > coolKcal, `warm ${warmKcal} should beat cool ${coolKcal}`)
  assert.equal(warmKcal, Math.round(activityKcal(warm, 115) * HEAT_MULTIPLIER))
})

test('saying "outside cool" beats the hot-climate assumption', () => {
  // Without the override, a hot-climate profile heat-adjusts every outdoor walk.
  const [plain] = parseWorkout('brisk walk 60 min')
  const [cool] = parseWorkout('brisk walk 60 min outside cool')
  const plainKcal = climateAdjustedKcal(activityKcal(plain, 115), plain, GARETH)
  const coolKcal = climateAdjustedKcal(activityKcal(cool, 115), cool, GARETH)
  assert.ok(plainKcal > coolKcal, 'the default assumes Dubai heat; "cool" says otherwise')
})

test('uphill walking is priced by gradient even when distance is given', () => {
  // 4 km in an hour is a slow flat pace, but on a steep incline it is not easy.
  const [item] = parseWorkout('uphill treadmill 4km in 60 min')
  assert.equal(item.met, 8.0, 'gradient sets the cost, not the speed')
})

// ---------------------------------------------------------------- API wiring

test('the exercise menu offers walking with priced conditions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-walk-test-'))
  const ctx = { store: new FileStore(join(dir, 'data.json')), secret: 's', passcode: 'boss-code', aiKey: null }
  const call = (path, opts = {}) => handleApi(
    new Request(`http://x/api${path}`, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }), ctx)

  const { token } = await (await call('/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const menu = await (await call('/exercises', { token })).json()

  assert.ok(menu.walking, 'walking is on the menu')
  const ids = menu.walking.options.map((o) => o.id)
  assert.deepEqual(ids, ['flat', 'uphill', 'warm', 'cool'])

  const byId = Object.fromEntries(menu.walking.options.map((o) => [o.id, o]))
  assert.equal(byId.uphill.met, 8.0)
  assert.ok(byId.uphill.kcal30 > byId.flat.kcal30 * 1.8, 'uphill is priced far higher')
  assert.ok(byId.warm.kcal30 > byId.cool.kcal30, 'warm carries the heat adjustment')
  assert.equal(byId.cool.kcal30, byId.flat.kcal30, 'cool is plain flat walking')

  // Every option's phrase must parse back to the activity it promised.
  for (const option of menu.walking.options) {
    const [parsed] = parseWorkout(`${option.phrase} 30 min${option.suffix ? ` ${option.suffix}` : ''}`)
    assert.equal(parsed.activityId, option.activityId, `${option.id} phrase parses wrong`)
  }
})

test('a logged uphill walk burns what the menu promised', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-walk-log-test-'))
  const ctx = { store: new FileStore(join(dir, 'data.json')), secret: 's', passcode: 'boss-code', aiKey: null }
  const call = (path, opts = {}) => handleApi(
    new Request(`http://x/api${path}`, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }), ctx)

  const { token } = await (await call('/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call('/profile', { method: 'PUT', token, body: { weightKg: 115, climate: 'hot', onboarded: true } })

  const flat = await (await call('/entries', { method: 'POST', token, body: { kind: 'workout', text: 'brisk walk 30 min outside cool' } })).json()
  const uphill = await (await call('/entries', { method: 'POST', token, body: { kind: 'workout', text: 'uphill treadmill 30 min' } })).json()
  assert.ok(uphill.entry.items[0].kcal > flat.entry.items[0].kcal * 1.8,
    `uphill ${uphill.entry.items[0].kcal} vs flat ${flat.entry.items[0].kcal}`)
})

test('the day payload carries free sugars for the main-screen tracker', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-sugar-day-test-'))
  const ctx = { store: new FileStore(join(dir, 'data.json')), secret: 's', passcode: 'boss-code', aiKey: null }
  const call = (path, opts = {}) => handleApi(
    new Request(`http://x/api${path}`, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }), ctx)

  const { token } = await (await call('/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call('/entries', { method: 'POST', token, body: { kind: 'meal', slot: 'breakfast', text: 'banana, glass of orange juice' } })

  const day = await (await call('/day', { token })).json()
  assert.ok(day.day.nutrition.freeSugar > 15, 'juice counted')
  assert.ok(day.day.nutrition.sugar > day.day.nutrition.freeSugar, 'banana excluded from free sugars')
  assert.ok(day.day.targets.freeSugar > 0, 'the bar has a limit to draw against')
})
