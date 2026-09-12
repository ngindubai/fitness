import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  goalDirectionFrom, bodyComposition, isHotClimate, CLIMATES, DEFAULT_PROFILE,
  climateAdjustedKcal, waterTargetMl, HEAT_MULTIPLIER, buildDay,
} from '../src/engine.js'
import { sanitiseCheckin, isEmptyCheckin, checkinDelta, waistToHeight, MEASUREMENT_FIELDS } from '../src/checkin.js'
import { recentMeals } from '../src/recommend.js'
import { parseMeal } from '../src/parse.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const PROFILE = { ...DEFAULT_PROFILE, sex: 'male', age: 37, heightCm: 178, weightKg: 115, onboarded: true }

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-checkin-test-'))
  return { store: new FileStore(join(dir, 'data.json')), secret: 's', passcode: 'boss-code', aiKey: null }
}
const call = (ctx, path, { method = 'GET', token, body } = {}) => handleApi(
  new Request(`http://x/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), ctx)

// ------------------------------------------------------ the written goal

test('a written goal is read for its direction, loss beating maintenance', () => {
  // The user's own examples, which are the ones that have to work.
  assert.equal(goalDirectionFrom('Lose 10kg while maintaining muscle'), 'lose')
  assert.equal(goalDirectionFrom('Build muscle'), 'gain')
  assert.equal(goalDirectionFrom('Improve my 5K running time'), 'maintain')
  assert.equal(goalDirectionFrom('Get fitter for football'), 'maintain')
  assert.equal(goalDirectionFrom('Reduce body fat'), 'lose')
  assert.equal(goalDirectionFrom('Improve general health'), 'maintain')
})

test('the earliest intent in the sentence wins, not the fixed category order', () => {
  // The qualifying clause carries words from the opposite category, so a
  // fixed lose-then-gain-then-maintain order gets these backwards.
  assert.equal(goalDirectionFrom('maintain my weight but get stronger'), 'maintain')
  assert.equal(goalDirectionFrom('build muscle without losing strength'), 'gain')
  assert.equal(goalDirectionFrom('stay the same weight but lose belly fat'), 'maintain')
  assert.equal(goalDirectionFrom('lose fat while building muscle'), 'lose')
})

test('an empty goal falls back rather than guessing', () => {
  assert.equal(goalDirectionFrom('', 'lose'), 'lose')
  assert.equal(goalDirectionFrom('   ', 'gain'), 'gain')
  assert.equal(goalDirectionFrom(null), 'maintain')
})

test('the goal round-trips through the API and re-reads on change', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  let saved = await (await call(ctx, '/profile', {
    method: 'PUT', token, body: { goalText: 'Build muscle and get stronger' },
  })).json()
  assert.equal(saved.profile.goalText, 'Build muscle and get stronger')
  assert.equal(saved.profile.goal, 'gain', 'the direction follows the words')

  // Rewriting the sentence moves the direction with it...
  saved = await (await call(ctx, '/profile', { method: 'PUT', token, body: { goalText: 'Drop 8kg of fat' } })).json()
  assert.equal(saved.profile.goal, 'lose')

  // ...but an explicit direction always wins over the reading.
  saved = await (await call(ctx, '/profile', {
    method: 'PUT', token, body: { goalText: 'Drop 8kg of fat', goal: 'maintain' },
  })).json()
  assert.equal(saved.profile.goal, 'maintain')
  assert.equal(saved.profile.goalText, 'Drop 8kg of fat')

  // And a save that never mentions the goal leaves both alone.
  saved = await (await call(ctx, '/profile', { method: 'PUT', token, body: { name: 'Gareth' } })).json()
  assert.equal(saved.profile.goalText, 'Drop 8kg of fat')
  assert.equal(saved.profile.goal, 'maintain')
})

// ------------------------------------------------------------- climate

test('climate drives heat through a flag, not a hard-coded id', () => {
  assert.ok(isHotClimate({ climate: 'hot' }))
  assert.ok(isHotClimate({ climate: 'hot_dry' }), 'a desert is also hot')
  assert.ok(!isHotClimate({ climate: 'temperate' }))
  assert.ok(!isHotClimate({ climate: 'cold' }))
  assert.ok(!isHotClimate({ climate: 'nonsense' }))
  assert.ok(Object.keys(CLIMATES).length >= 4, 'more than two climates are offered now')
})

test('the new climates actually change the numbers', () => {
  const item = { met: 5, minutes: 60, outdoor: true }
  const hotDry = climateAdjustedKcal(500, item, { ...PROFILE, climate: 'hot_dry' })
  const cold = climateAdjustedKcal(500, item, { ...PROFILE, climate: 'cold' })
  assert.equal(hotDry, Math.round(500 * HEAT_MULTIPLIER))
  assert.equal(cold, 500)
  assert.ok(waterTargetMl({ ...PROFILE, climate: 'hot_dry' }) > waterTargetMl({ ...PROFILE, climate: 'cold' }))
})

test('the profile keeps a region and still keeps a timezone', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const saved = await (await call(ctx, '/profile', {
    method: 'PUT', token, body: { region: 'Dubai, UAE', climate: 'hot_dry' },
  })).json()
  assert.equal(saved.profile.region, 'Dubai, UAE')
  assert.equal(saved.profile.climate, 'hot_dry')
  // The field left the form; the value must not leave the profile.
  assert.ok(saved.profile.timezone, 'timezone still stored even though it is no longer a form field')
})

// ------------------------------------------------------- waist and BMI

test('waist-to-height follows the NICE bands', () => {
  // NG246: 0.4-0.49 healthy, 0.5-0.59 increased, 0.6+ high.
  assert.equal(waistToHeight(80, 180).band, 'healthy')   // 0.44
  assert.equal(waistToHeight(90, 180).band, 'increased') // 0.50
  assert.equal(waistToHeight(108, 180).band, 'high')     // 0.60
  assert.equal(waistToHeight(89, 178).targetWaistCm, 89, 'half your height is the target')
  assert.equal(waistToHeight(null, 180), null)
})

test('above BMI 35 the ratio is flagged as less discriminating', () => {
  assert.equal(waistToHeight(104, 178, 36.3).lowValue, true)
  assert.equal(waistToHeight(104, 178, 28).lowValue, false)
})

test('BMI is the last indicator, never the headline', () => {
  const composition = bodyComposition({ profile: PROFILE, days: [], weighIns: [] })
  const ids = composition.indicators.map((i) => i.id)
  assert.equal(ids[ids.length - 1], 'bmi', 'BMI must come last')
  assert.equal(ids[0], 'waist', 'central adiposity leads')
  assert.match(composition.caveat, /muscle/i)
  assert.equal(composition.indicators.find((i) => i.id === 'bmi').tone, 'neutral',
    'BMI must not be coloured as a pass or a fail')
})

test('composition uses a waist from the latest check-in', () => {
  const composition = bodyComposition({
    profile: PROFILE, days: [], weighIns: [],
    latestCheckin: { measurements: { waist: 104 } },
  })
  assert.equal(composition.waist.ratio, 0.58)
  assert.equal(composition.indicators[0].value, '0.58')
})

test('composition reports protein and lifting when there is history', () => {
  const days = Array.from({ length: 14 }, (_, i) => buildDay({
    profile: PROFILE, date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    meals: [{ items: parseMeal('300g chicken breast, 200g brown rice') }],
    workouts: i % 3 === 0 ? [{ items: [{ name: 'Bench', minutes: 30, met: 5, kcal: 200, tags: ['strength'], exercise: { id: 'bench', name: 'Bench press', sets: 3, reps: 8, weightKg: 80, volume: 1920 } }] }] : [],
  }))
  const composition = bodyComposition({ profile: PROFILE, days, weighIns: [] })
  const ids = composition.indicators.map((i) => i.id)
  assert.ok(ids.includes('protein'), 'protein adherence shows up')
  assert.ok(ids.includes('lifting'), 'resistance training shows up')
  assert.equal(ids[ids.length - 1], 'bmi')
})

// -------------------------------------------------------------- check-ins

test('a check-in keeps only sensible values', () => {
  const checkin = sanitiseCheckin({
    weightKg: '113.4',
    measurements: { waist: '104', chest: 118, thigh: 9999, nonsense: 50 },
    feeling: 4, energy: '3', sleep: 9,
    training: '  Three sessions  ', notes: 'x'.repeat(2000),
  })
  assert.equal(checkin.weightKg, 113.4)
  assert.deepEqual(checkin.measurements, { waist: 104, chest: 118 }, 'out-of-range and unknown fields dropped')
  assert.equal(checkin.feeling, 4)
  assert.equal(checkin.energy, 3, 'form values arrive as strings and must still count')
  assert.equal(checkin.sleep, null, 'out of the 1-5 range')
  assert.equal(checkin.training, 'Three sessions')
  assert.equal(checkin.notes.length, 1200)
})

test('an empty check-in is recognised as empty', () => {
  assert.ok(isEmptyCheckin(sanitiseCheckin({})))
  assert.ok(!isEmptyCheckin(sanitiseCheckin({ notes: 'knee still sore' })))
})

test('the delta reports what moved between two check-ins', () => {
  const delta = checkinDelta(
    { date: '2026-09-12', weightKg: 113, measurements: { waist: 104 } },
    { date: '2026-08-29', weightKg: 116, measurements: { waist: 107, chest: 120 } },
  )
  assert.equal(delta.weightKg, -3)
  assert.equal(delta.measurements.waist, -3)
  assert.equal(delta.measurements.chest, undefined, 'no comparison without both sides')
  assert.equal(delta.days, 14)
})

test('check-ins save, list, and feed the composition picture', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  const created = await (await call(ctx, '/checkins', {
    method: 'POST', token,
    body: { weightKg: 113.4, measurements: { waist: 104 }, feeling: 4, training: 'Squats moving', notes: 'Knee fine' },
  })).json()
  assert.equal(created.checkin.weightKg, 113.4)
  assert.equal(created.checkin.measurements.waist, 104)

  const listed = await (await call(ctx, '/checkins', { token })).json()
  assert.equal(listed.checkins.length, 1)
  assert.equal(listed.checkins[0].training, 'Squats moving')
  assert.equal(listed.fields.length, MEASUREMENT_FIELDS.length)

  // The weight given at a check-in is a weigh-in everywhere else too.
  const history = await (await call(ctx, '/history?days=30', { token })).json()
  assert.ok(history.weights.some((w) => w.value === 113.4), 'check-in weight reaches weight history')
  assert.equal(history.composition.waist.ratio, Math.round((104 / 178) * 100) / 100)
  const profile = await (await call(ctx, '/profile', { token })).json()
  assert.equal(profile.profile.weightKg, 113.4, 'and updates the profile weight')

  // Empty ones are refused rather than silently stored.
  const empty = await call(ctx, '/checkins', { method: 'POST', token, body: {} })
  assert.equal(empty.status, 400)

  const del = await call(ctx, `/checkins/${created.checkin.id}`, { method: 'DELETE', token })
  assert.equal(del.status, 200)
  const after = await (await call(ctx, '/checkins', { token })).json()
  assert.equal(after.checkins.length, 0)
})

test('check-in entries never disturb the day totals', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'meal', text: '200g chicken breast' } })
  const before = await (await call(ctx, '/day', { token })).json()

  await call(ctx, '/checkins', { method: 'POST', token, body: { measurements: { waist: 100 }, notes: 'fine' } })
  const after = await (await call(ctx, '/day', { token })).json()

  assert.equal(after.day.caloriesIn, before.day.caloriesIn, 'a check-in is not food')
  assert.equal(after.entries.meals.length, before.entries.meals.length)
})

test('deleting a check-in cannot delete anything else', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const meal = await (await call(ctx, '/entries', {
    method: 'POST', token, body: { kind: 'meal', text: '200g chicken breast' },
  })).json()

  // The check-in delete route must not be a back door to the entries table.
  const attempt = await call(ctx, `/checkins/${meal.entry.id}`, { method: 'DELETE', token })
  assert.equal(attempt.status, 404, 'a meal id must not be deletable through the check-in route')

  const day = await (await call(ctx, '/day', { token })).json()
  assert.ok(day.day.caloriesIn > 0, 'the meal survived')
})

test('deleting a check-in takes its mirrored weigh-in with it', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'weight', value: 118 } })
  const created = await (await call(ctx, '/checkins', {
    method: 'POST', token, body: { weightKg: 113.4, notes: 'lighter' },
  })).json()

  let history = await (await call(ctx, '/history?days=30', { token })).json()
  assert.ok(history.weights.some((w) => w.value === 113.4))

  await call(ctx, `/checkins/${created.checkin.id}`, { method: 'DELETE', token })

  history = await (await call(ctx, '/history?days=30', { token })).json()
  assert.ok(!history.weights.some((w) => w.value === 113.4),
    'the weigh-in the check-in created must go too, or the charts quote a deleted reading')
  const profile = await (await call(ctx, '/profile', { token })).json()
  assert.equal(profile.profile.weightKg, 118,
    'and the profile falls back to the weigh-in that still stands')
})

test('a measurement carries forward when a later check-in skips the tape', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const today = (await (await call(ctx, '/profile', { token })).json()).today
  const earlier = new Date(`${today}T00:00:00Z`)
  earlier.setUTCDate(earlier.getUTCDate() - 14)

  await call(ctx, '/checkins', {
    method: 'POST', token,
    body: { date: earlier.toISOString().slice(0, 10), measurements: { waist: 112 }, notes: 'tape day' },
  })
  // A later check-in with no tape measure must not erase the waist.
  await call(ctx, '/checkins', { method: 'POST', token, body: { feeling: 4, notes: 'busy week' } })

  const history = await (await call(ctx, '/history?days=60', { token })).json()
  assert.ok(history.composition.waist, 'the waist should still be known')
  assert.equal(history.composition.waist.ratio, Math.round((112 / 178) * 100) / 100)
})

test('a mistyped weight is refused rather than silently dropped', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  // 1134 is the classic fat-finger for 113.4.
  const bad = await call(ctx, '/checkins', { method: 'POST', token, body: { weightKg: 1134, notes: 'weighed in' } })
  assert.equal(bad.status, 400)
  const listed = await (await call(ctx, '/checkins', { token })).json()
  assert.equal(listed.checkins.length, 0, 'nothing stored when the weight was rejected')
})

test('a back-dated check-in does not rewrite what you weigh today', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const today = (await (await call(ctx, '/profile', { token })).json()).today
  const old = new Date(`${today}T00:00:00Z`)
  old.setUTCDate(old.getUTCDate() - 30)

  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'weight', value: 100 } })
  await call(ctx, '/checkins', {
    method: 'POST', token,
    body: { date: old.toISOString().slice(0, 10), weightKg: 130, notes: 'back-filled' },
  })

  const profile = await (await call(ctx, '/profile', { token })).json()
  assert.equal(profile.profile.weightKg, 100,
    'every calorie target derives from this — a month-old reading must not claim it')
})

test('the weight trend refuses to quote a weekly rate from a couple of days', () => {
  const near = bodyComposition({
    profile: PROFILE, days: [],
    weighIns: [{ date: '2026-09-11', value: 115 }, { date: '2026-09-12', value: 114 }],
  })
  const trend = near.indicators.find((i) => i.id === 'trend')
  assert.match(trend.detail, /too short for a weekly rate/)

  const far = bodyComposition({
    profile: PROFILE, days: [],
    weighIns: [{ date: '2026-08-12', value: 118 }, { date: '2026-09-12', value: 114 }],
  })
  assert.match(far.indicators.find((i) => i.id === 'trend').detail, /kg a week/)
})

test('lifting frequency is judged on recent weeks, not the whole history window', () => {
  // Three sessions a week for a month, inside a 180-day request window.
  const days = Array.from({ length: 180 }, (_, i) => {
    const date = new Date('2026-04-01T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + i)
    const lifting = i >= 152 && i % 2 === 0
    return buildDay({
      profile: PROFILE, date: date.toISOString().slice(0, 10), meals: [],
      workouts: lifting ? [{ items: [{ name: 'Bench', minutes: 30, met: 5, kcal: 200, tags: ['strength'], exercise: { id: 'bench', name: 'Bench press', sets: 3, reps: 8, weightKg: 80, volume: 1920 } }] }] : [],
    })
  })
  const lifting = bodyComposition({ profile: PROFILE, days, weighIns: [] }).indicators.find((i) => i.id === 'lifting')
  assert.ok(parseFloat(lifting.value) >= 3, `training every other day should read 3+/week, got ${lifting.value}`)
  assert.equal(lifting.tone, 'good')
})

// ------------------------------------------------------- repeating meals

test('recent meals dedupe by content and carry their items', () => {
  const entries = [
    { date: '2026-09-01', createdAt: '2026-09-01T08:00:00Z', slot: 'breakfast', items: parseMeal('3 eggs') },
    { date: '2026-09-02', createdAt: '2026-09-02T08:00:00Z', slot: 'breakfast', items: parseMeal('3 eggs') },
    { date: '2026-09-03', createdAt: '2026-09-03T13:00:00Z', slot: 'lunch', items: parseMeal('200g chicken breast') },
  ]
  const recent = recentMeals(entries)
  assert.equal(recent.length, 2, 'the same breakfast twice is one suggestion')
  assert.equal(recent[0].slot, 'lunch', 'newest first')
  assert.equal(recent[1].count, 2, 'and it remembers how often')
  assert.ok(recent[1].items.length >= 1)
  assert.ok(recent[1].kcal > 0)
})

test('a repeat never carries a plan key forward', () => {
  const items = parseMeal('3 eggs').map((i) => ({ ...i, planKey: '2026-09-01:meal:breakfast' }))
  const [recent] = recentMeals([{ date: '2026-09-01', createdAt: '2026-09-01T08:00:00Z', slot: 'breakfast', items }])
  assert.ok(recent.items.every((i) => i.planKey === undefined),
    'copying planKey would mark a plan block done on a day it was not followed')
})

test('today is excluded from its own repeat suggestions', () => {
  const entries = [
    { date: '2026-09-12', createdAt: '2026-09-12T08:00:00Z', slot: 'breakfast', items: parseMeal('3 eggs') },
    { date: '2026-09-11', createdAt: '2026-09-11T08:00:00Z', slot: 'lunch', items: parseMeal('200g cod') },
  ]
  const recent = recentMeals(entries, { excludeDate: '2026-09-12' })
  assert.equal(recent.length, 1)
  assert.match(recent[0].title, /Cod/i)
})

test('the day payload carries repeat suggestions', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const today = (await (await call(ctx, '/profile', { token })).json()).today
  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const y = yesterday.toISOString().slice(0, 10)

  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'meal', date: y, slot: 'breakfast', text: '3 eggs' } })
  const day = await (await call(ctx, '/day', { token })).json()
  assert.ok(Array.isArray(day.recent))
  assert.equal(day.recent.length, 1)
  assert.match(day.recent[0].title, /Egg/i)
  assert.ok(day.recent[0].items.length >= 1, 'the items travel so a repeat keeps the same portions')
})
