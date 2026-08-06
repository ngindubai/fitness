import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { EXERCISES } from '../src/data/exercises.js'
import { MUSCLES, itemMuscleEffort, muscleEffortFor, recoveringMuscles, neglectedMuscles } from '../src/muscles.js'
import { parseWorkout } from '../src/parse.js'
import { buildDay, buildWeek } from '../src/engine.js'
import { reviewWeek } from '../src/coach.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const PROFILE = {
  name: 'Gareth', sex: 'male', age: 37, heightCm: 178, weightKg: 115,
  baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5, timezone: 'Asia/Dubai',
  climate: 'hot', proteinPerKg: null, planId: null, planStart: null, eatBack: 'all',
}

// ---------------------------------------------------------- the catalogue

test('the exercise menu is genuinely large and fully muscle-mapped', () => {
  assert.ok(EXERCISES.length >= 100, `only ${EXERCISES.length} exercises`)
  const valid = new Set(MUSCLES.map((m) => m.id))
  for (const exercise of EXERCISES) {
    const muscles = Object.entries(exercise.muscles)
    assert.ok(muscles.length >= 1, `${exercise.id} maps no muscles`)
    for (const [muscle, share] of muscles) {
      assert.ok(valid.has(muscle), `${exercise.id} maps unknown muscle "${muscle}"`)
      assert.ok(share > 0 && share <= 1, `${exercise.id} ${muscle} share ${share}`)
    }
    assert.ok(muscles.some(([, share]) => share === 1), `${exercise.id} has no prime mover`)
  }
})

test('every muscle in the catalogue is reachable by at least one exercise', () => {
  const reached = new Set(EXERCISES.flatMap((e) => Object.keys(e.muscles)))
  for (const muscle of MUSCLES) {
    assert.ok(reached.has(muscle.id), `no exercise trains ${muscle.id}`)
  }
})

test('old aliases still resolve after the split-out', () => {
  const [goblet] = parseWorkout('goblet squat 3x10 20kg')
  assert.equal(goblet.exercise.id, 'goblet_squat')
  const [bulgarian] = parseWorkout('bulgarian split squat 3x8')
  assert.equal(bulgarian.exercise.id, 'bulgarian_split_squat')
  const [bench] = parseWorkout('bench 3x8 80kg')
  assert.equal(bench.exercise.id, 'bench')
  const [incline] = parseWorkout('incline bench 3x8 60kg')
  assert.equal(incline.exercise.id, 'incline_bench')
})

// ------------------------------------------------------------ effort maths

test('a bench set loads chest most, triceps and front delts less', () => {
  const [item] = parseWorkout('bench 3x8 80kg')
  const effort = itemMuscleEffort(item)
  assert.equal(effort.chest, 3)          // 3 sets × share 1
  assert.equal(effort.triceps, 1.8)      // 3 × 0.6
  assert.equal(effort.front_delts, 1.5)  // 3 × 0.5
  assert.ok(!effort.quads)
})

test('cardio machines credit their muscles by time and intensity', () => {
  const [rower] = parseWorkout('rowing machine 30 min')
  const effort = itemMuscleEffort(rower)
  assert.ok(effort.lats > 1 && effort.quads > 1, `rower: ${JSON.stringify(effort)}`)
  const [walk] = parseWorkout('walked 30 min')
  assert.ok(itemMuscleEffort(walk).calves > 0)
  // Harder effort earns more for the same minutes.
  const [easy] = parseWorkout('spin class 30 min easy')
  const [hard] = parseWorkout('spin class 30 min hard')
  assert.ok(itemMuscleEffort(hard).quads > itemMuscleEffort(easy).quads)
})

test('recovery lasts 24 hours from logging, then clears', () => {
  const now = new Date('2026-08-08T18:00:00Z')
  const entries = [
    { createdAt: '2026-08-08T08:00:00Z', date: '2026-08-08', items: parseWorkout('bench 3x8 80kg') },      // 10h ago
    { createdAt: '2026-08-07T08:00:00Z', date: '2026-08-07', items: parseWorkout('squat 5x5 100kg') },     // 34h ago
  ]
  const recovering = recoveringMuscles(entries, now)
  assert.ok(recovering.chest, 'chest trained 10h ago is recovering')
  assert.equal(recovering.chest.hoursLeft, 14)
  assert.ok(!recovering.quads, 'squats from 34h ago are done recovering')
})

test('neglect needs training to have happened at all', () => {
  assert.deepEqual(neglectedMuscles({}), [])
  const neglected = neglectedMuscles(muscleEffortFor([
    { items: parseWorkout('bench 3x8, curls 3x10') },
  ]))
  assert.ok(neglected.includes('quads'))
  assert.ok(neglected.includes('hamstrings'))
  assert.ok(!neglected.includes('chest'))
})

// --------------------------------------------------------- coach feedback

test('the coach names skipped major muscles and mirror-muscle bias', () => {
  const day = (text, date) => buildDay({
    profile: PROFILE, meals: [], date,
    workouts: [{ items: parseWorkout(text) }],
  })
  const days = [
    day('bench 4x8 80kg, incline bench 3x10, curls 3x12', '2026-08-03'),
    day('shoulder press 4x8, chest fly 3x12, curls 3x10', '2026-08-05'),
  ]
  const review = reviewWeek(buildWeek(days), PROFILE, days)
  assert.ok(review.findings.some((f) => f.code === 'week_muscles_skipped'), 'legs skipped should be named')
  assert.ok(review.findings.some((f) => f.code === 'week_mirror_muscles'), 'all-push week should be flagged')
  assert.ok(review.findings.some((f) => f.code === 'week_muscle_top'))
})

// ------------------------------------------------------------- API + store

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-body-test-'))
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

test('the muscles endpoint: live recovery and range aggregation', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'workout', text: 'bench 3x8 80kg, lat pulldown 3x10 60kg' } })

  const live = await (await call(ctx, '/muscles?mode=live', { token })).json()
  assert.ok(live.recovering.chest, 'chest just trained → recovering')
  assert.ok(live.recovering.lats, 'lats just trained → recovering')
  assert.ok(live.recovering.chest.hoursLeft > 23)
  assert.ok(!live.recovering.quads)

  const today = (await (await call(ctx, '/profile', { token })).json()).today
  const range = await (await call(ctx, `/muscles?from=${today}&to=${today}`, { token })).json()
  assert.equal(range.effort.chest, 3)
  assert.equal(range.workoutCount, 1)

  const bad = await call(ctx, '/muscles?from=2026-09-01&to=2026-08-01', { token })
  assert.equal(bad.status, 400)
})

test('the exercise menu endpoint serves lifts and cardio machines', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const menu = await (await call(ctx, '/exercises', { token })).json()
  assert.ok(menu.exercises.length >= 100)
  assert.ok(menu.cardio.some((c) => c.id === 'rowing_machine'))
  assert.ok(menu.cardio.some((c) => c.id === 'treadmill'))
  assert.ok(menu.exercises.every((e) => e.muscles && e.group))
})

test('scanned products are shared across the household', async () => {
  const ctx = makeCtx()
  const owner = (await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()).token
  const katy = (await (await call(ctx, '/signup', { method: 'POST', body: { passcode: 'katy-cooks', name: 'Katy' } })).json()).token

  await call(ctx, '/pantry', {
    method: 'POST', token: owner,
    body: { name: 'Household Granola', servingG: 50, per100: { kcal: 400, protein: 20, carbs: 50, fat: 12, fibre: 6, sugar: 10 } },
  })

  // Katy sees it, marked shared, and can log it by name.
  const hers = await (await call(ctx, '/pantry', { token: katy })).json()
  const sharedItem = hers.items.find((i) => i.name === 'Household Granola')
  assert.ok(sharedItem, 'shared item visible')
  assert.ok(sharedItem.shared, 'and marked as shared')

  const parsed = await (await call(ctx, '/parse', {
    method: 'POST', token: katy, body: { kind: 'meal', text: '1 serving household granola' },
  })).json()
  assert.equal(parsed.items[0].kcal, 200)

  // But she cannot delete someone else's scan.
  const del = await call(ctx, `/pantry/${sharedItem.id}`, { method: 'DELETE', token: katy })
  assert.equal(del.status, 404)

  // Her own copy of the same name wins over the shared one.
  await call(ctx, '/pantry', {
    method: 'POST', token: katy,
    body: { name: 'Household Granola', servingG: 40, per100: { kcal: 300, protein: 15, carbs: 40, fat: 8, fibre: 5, sugar: 8 } },
  })
  const reparsed = await (await call(ctx, '/parse', {
    method: 'POST', token: katy, body: { kind: 'meal', text: '1 serving household granola' },
  })).json()
  assert.equal(reparsed.items[0].kcal, 120) // 40 g of her 300/100g version
})
