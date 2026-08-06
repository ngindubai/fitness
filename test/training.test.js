import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { EXERCISES, EXERCISES_BY_ID, exerciseByName } from '../src/data/exercises.js'
import { parseWorkout, activityKcal } from '../src/parse.js'
import { muscleRangeStats, recommendWorkout } from '../src/muscles.js'
import { planForDate, itemsForBlock, applySessionEdits } from '../src/plan.js'
import { PLANS } from '../src/data/plans.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

// ------------------------------------------------- per-exercise calories

test('every exercise carries a compendium MET class', () => {
  const allowed = new Set([8.0, 6.0, 5.0, 3.8, 3.5, 2.8])
  for (const exercise of EXERCISES) {
    assert.ok(allowed.has(exercise.met), `${exercise.id} met ${exercise.met} is not a compendium class`)
  }
  // Spot checks against the assignment rules.
  assert.equal(EXERCISES_BY_ID.get('deadlift').met, 6.0)  // vigorous free-weight (02050)
  assert.equal(EXERCISES_BY_ID.get('bench').met, 5.0)     // compound lift (02052)
  assert.equal(EXERCISES_BY_ID.get('curl').met, 3.5)      // isolation (02054)
  assert.equal(EXERCISES_BY_ID.get('burpee').met, 8.0)    // vigorous calisthenics (02020)
  assert.equal(EXERCISES_BY_ID.get('press_up').met, 3.8)  // moderate calisthenics (02022)
  assert.equal(EXERCISES_BY_ID.get('plank').met, 2.8)     // light calisthenics (02024)
})

test('parsed lifts burn by their own MET, not a flat rate', () => {
  const [squat] = parseWorkout('squat 3x5 100kg')
  const [curl] = parseWorkout('bicep curls 3x12 12kg')
  assert.equal(squat.met, 6.0)
  assert.equal(curl.met, 3.5)
  // Same 9 minutes of work, same person: the squat costs meaningfully more.
  const squatKcal = activityKcal(squat, 100)
  const curlKcal = activityKcal(curl, 100)
  assert.equal(squatKcal, 75)  // (6−1) × 100 kg × 0.15 h
  assert.equal(curlKcal, 38)   // (3.5−1) × 100 kg × 0.15 h → rounded
  assert.ok(squatKcal > curlKcal * 1.8)
})

test('plan lift blocks inherit the exercise MET and id', () => {
  const planId = Object.keys(PLANS)[0]
  const day = planForDate(planId, '2026-08-03', '2026-08-03')
  const lift = day.blocks.find((b) => b.key === 'lift')
  const items = itemsForBlock(PLANS[planId], lift)
  for (const item of items) {
    const known = exerciseByName(item.exercise.name)
    if (known) {
      assert.equal(item.met, known.met, `${item.exercise.name} should burn at MET ${known.met}`)
      assert.equal(item.exercise.id, known.id)
    }
  }
})

// ------------------------------------------------- range stats + recommender

const entry = (text) => ({ createdAt: new Date().toISOString(), date: '2026-08-05', items: parseWorkout(text) })

test('range stats report exact reps and exercises per muscle', () => {
  const stats = muscleRangeStats([entry('bench 3x8 80kg, squat 5x5 100kg, rowing machine 30 min')])
  assert.equal(stats.totals.sets, 8)
  assert.equal(stats.totals.reps, 49)          // 24 + 25
  assert.equal(stats.totals.cardioMinutes, 30)
  assert.equal(stats.totals.exercises, 3)
  assert.equal(stats.perMuscle.chest.reps, 24)
  assert.equal(stats.perMuscle.chest.exercises.length, 1)
  assert.equal(stats.perMuscle.quads.reps, 25)
  // Lats: no strength reps, but the rower credits minutes.
  assert.equal(stats.perMuscle.lats.reps, 0)
  assert.equal(stats.perMuscle.lats.cardioMinutes, 30)
})

test('the recommender targets what the week neglected, primary movers only', () => {
  const rec = recommendWorkout([entry('bench 4x8 80kg, ohp 3x8 40kg, tricep pushdown 3x12')])
  assert.ok(rec.exercises.length >= 3, 'a push-only week leaves plenty to fix')
  const names = rec.exercises.map((e) => e.name.toLowerCase())
  // Every pick's primary muscle must be one of the neglected targets.
  for (const pick of rec.exercises) {
    const primaries = Object.entries(pick.muscles).filter(([, s]) => s === 1).map(([m]) => m)
    assert.ok(primaries.some((m) => rec.targets.includes(m)), `${pick.name} fixes none of ${rec.targets}`)
  }
  // And none of them should be another pressing movement.
  assert.ok(!names.some((n) => /bench|overhead press|pushdown/.test(n)))
  // Legs and pull were skipped — they should headline.
  assert.ok(rec.exercises.some((e) => e.muscles.quads === 1 || e.muscles.hamstrings === 1 || e.muscles.glutes === 1))
})

test('an empty week recommends a full-body starter, not nothing', () => {
  const rec = recommendWorkout([])
  assert.ok(rec.exercises.length >= 4)
})

// ------------------------------------------------------------ plan edits

test('session edits remove and add exercises by name', () => {
  const exercises = [{ name: 'Goblet squat' }, { name: 'Press-ups' }]
  const edited = applySessionEdits(exercises, 1, 'Session A', {
    '1|Session A': { removed: ['press-ups'], added: [{ name: 'Bulgarian split squat' }] },
  })
  assert.deepEqual(edited.map((e) => e.name), ['Goblet squat', 'Bulgarian split squat'])
  assert.ok(edited[1].addedByUser)
  // Other sessions untouched.
  assert.equal(applySessionEdits(exercises, 1, 'Session B', { '1|Session A': { removed: ['press-ups'] } }).length, 2)
})

// ---------------------------------------------------------------- via API

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-training-test-'))
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

test('the muscles range endpoint reports reps, exercises and a recommendation', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'workout', text: 'bench 3x8 80kg, lat pulldown 3x10 60kg' } })

  const today = (await (await call(ctx, '/profile', { token })).json()).today
  const range = await (await call(ctx, `/muscles?from=${today}&to=${today}`, { token })).json()
  assert.equal(range.totals.reps, 54)
  assert.equal(range.totals.exercises, 2)
  assert.equal(range.stats.chest.reps, 24)
  assert.deepEqual(range.stats.chest.exercises, ['Bench press'])
  assert.ok(range.recommendation.exercises.length >= 1, 'the range reply carries tomorrow’s fix')

  const rec = await (await call(ctx, '/recommend-workout', { token })).json()
  assert.ok(rec.exercises.length >= 1)
  assert.ok(rec.targets.length >= 1)
})

test('the exercise menu prices every lift for this user', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const menu = await (await call(ctx, '/exercises', { token })).json()
  assert.ok(menu.exercises.every((e) => e.met > 0 && e.kcalPerSet >= 1))
  const squat = menu.exercises.find((e) => e.id === 'squat')
  const curl = menu.exercises.find((e) => e.id === 'curl')
  assert.ok(squat.kcalPerSet > curl.kcalPerSet, 'a squat set must out-burn a curl set')
})

test('plan edits persist on the profile and reshape plan-day and overview', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  const planId = Object.keys(PLANS)[0]
  await call(ctx, '/profile', { method: 'PUT', token, body: { planId, planStart: '2026-08-03' } })

  // Find a gym day and its first exercise.
  const before = await (await call(ctx, '/plan-day?date=2026-08-03', { token })).json()
  const lift = before.day.blocks.find((b) => b.key === 'lift')
  assert.ok(lift, '2026-08-03 is a Monday: gym day')
  const victim = lift.exercises[0].name
  const skey = `${before.day.phase.number}|${lift.title}`

  await call(ctx, '/profile', {
    method: 'PUT', token,
    body: { planEdits: { [skey]: { removed: [victim], added: [{ name: 'Face pulls' }] } } },
  })

  const after = await (await call(ctx, '/plan-day?date=2026-08-03', { token })).json()
  const editedLift = after.day.blocks.find((b) => b.key === 'lift')
  const names = editedLift.exercises.map((e) => e.name)
  assert.ok(!names.includes(victim), `${victim} should be gone`)
  assert.ok(names.includes('Face pulls'), 'the added lift appears with the session scheme')

  const overview = await (await call(ctx, '/plan-overview', { token })).json()
  const phase = overview.plan.phases.find((p) => p.number === before.day.phase.number)
  const session = phase.sessions.find((s) => s.title === lift.title)
  assert.ok(!session.exercises.some((e) => e.name === victim))
  assert.ok(session.exercises.some((e) => e.name === 'Face pulls' && e.addedByUser))

  // Confirming the edited block logs the edited list, with real METs.
  const confirm = await (await call(ctx, '/plan-day/confirm', {
    method: 'POST', token, body: { date: '2026-08-03', key: 'lift' },
  })).json()
  const itemNames = confirm.entry.items.map((i) => i.exercise.name)
  assert.ok(!itemNames.includes(victim))
  assert.ok(itemNames.includes('Face pulls'))

  // Junk edits are ignored, valid ones bounded.
  const junk = await (await call(ctx, '/profile', {
    method: 'PUT', token, body: { planEdits: { bad: 'nope', [skey]: { removed: [victim] } } },
  })).json()
  assert.equal(junk.profile.planEdits.bad, undefined)
  assert.ok(junk.profile.planEdits[skey])
})
