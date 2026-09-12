import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PLANS } from '../src/data/plans.js'
import { planForDate, itemsForBlock, planOverview } from '../src/plan.js'
import { parseWorkout, activityKcal } from '../src/parse.js'
import { targetsFor } from '../src/engine.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

// Plans start on a Monday in every test.
const START = '2026-08-03'

// The plan engine is exercised against the plan that is actually shipped.
// Naming it once means retiring or adding a plan does not mean rewriting the
// engine's tests — only re-pointing this constant.
const PLAN = 'sixmonthsstronger'

const lift = (day) => day.blocks.find((b) => b.key === 'lift')
const cardio = (day) => day.blocks.find((b) => b.key === 'cardio')
const mealBlock = (day, slot) => day.blocks.find((b) => b.key === `meal:${slot}`)

// ------------------------------------------------------------ planForDate

test('plan lifecycle: upcoming, active, complete', () => {
  assert.equal(planForDate(PLAN, START, '2026-08-02').status, 'upcoming')
  assert.equal(planForDate(PLAN, START, '2026-08-03').status, 'active')
  // Week 26 runs to Sunday 2027-01-31; the day after, the plan is done.
  assert.equal(planForDate(PLAN, START, '2027-01-31').status, 'active')
  assert.equal(planForDate(PLAN, START, '2027-02-01').status, 'complete')
  assert.equal(planForDate('nonsense', START, '2026-08-03'), null)
})

test('daily shape: rest days keep steps, gym days carry a session', () => {
  const mon = planForDate(PLAN, START, '2026-08-03')
  assert.equal(mon.week, 1)
  assert.equal(mon.phase.number, 1)
  assert.ok(lift(mon).title.startsWith('Session A'))
  assert.equal(lift(mon).exercises[0].sets, 3) // phase 1: 3 sets

  const tue = planForDate(PLAN, START, '2026-08-04')
  assert.equal(lift(tue), undefined, 'Tuesday is a rest day')
  assert.ok(tue.restNote)
  assert.ok(tue.blocks.find((b) => b.key === 'steps'), 'steps are prescribed daily')
})

/**
 * No plan currently shipped uses `rotation: 'alternate'` — the plan that did
 * was retired — but the engine still supports it, so it is exercised against a
 * fixture registered for the length of this test. Without this the A/B
 * alternation maths (which has to carry the cycle across week boundaries, not
 * restart it every Monday) would have no coverage at all.
 */
test('alternate rotation cycles A/B by gym day, carrying across weeks', () => {
  const session = (title) => ({ title, exercises: [{ name: 'Goblet squat', group: 'legs' }] })
  PLANS.__fixture = {
    id: '__fixture', name: 'Fixture', owner: 'Test', weeks: 4,
    gymDays: [0, 2, 4], deloadWeeks: [], testWeek: null,
    kcal: 2000, macros: { protein: 150, carbs: 200, fat: 65 },
    stepsTarget: 8000, stepsNote: 'x', restNote: 'rest',
    phases: [{
      number: 1, name: 'Only', weeks: [1, 4], focus: 'x',
      scheme: { sets: 2, reps: '10', effort: 'x', rest: '60 s' },
      rotation: 'alternate',
      sessions: [session('Session A'), session('Session B')],
      cardio: null,
    }],
    meals: { breakfast: [{ name: 'b', kcal: 400, protein: 30 }], lunch: [{ name: 'l', kcal: 500, protein: 40 }], dinner: [{ name: 'd', kcal: 600, protein: 45 }], snack: [{ name: 's', kcal: 200, protein: 20 }] },
    rules: [],
  }
  try {
    const title = (date) => lift(planForDate('__fixture', START, date)).title
    assert.equal(title('2026-08-03'), 'Session A') // week 1 Mon
    assert.equal(title('2026-08-05'), 'Session B') // week 1 Wed
    assert.equal(title('2026-08-07'), 'Session A') // week 1 Fri
    // Three gym days a week against a two-session cycle means week 2 has to
    // start on B. Restarting the cycle each week would wrongly give A.
    assert.equal(title('2026-08-10'), 'Session B') // week 2 Mon
    assert.equal(title('2026-08-12'), 'Session A')
    assert.equal(title('2026-08-14'), 'Session B')
  } finally {
    delete PLANS.__fixture
  }
})

test('deload and phase boundaries', () => {
  // Week 5 Monday = phase 2, and the main lift swaps in.
  const w5 = planForDate(PLAN, START, '2026-08-31')
  assert.equal(w5.week, 5)
  assert.equal(w5.phase.number, 2)
  assert.match(lift(w5).exercises[0].name, /Hip thrust/)

  // Week 8 Monday: deload halves the sets.
  const w8 = planForDate(PLAN, START, '2026-09-21')
  assert.equal(w8.week, 8)
  assert.ok(w8.deload)
  assert.equal(lift(w8).exercises[0].sets, 2) // ceil(3 / 2)
  assert.match(lift(w8).detail, /deload/i)

  // Week 13 Monday: phase 3 steps the sets up, weekly rotation pins Mon to A.
  const w13 = planForDate(PLAN, START, '2026-10-26')
  assert.equal(w13.phase.number, 3)
  assert.equal(lift(w13).exercises[0].sets, 4)
  assert.match(lift(w13).title, /glutes & hamstrings/)
  const w13wed = planForDate(PLAN, START, '2026-10-28')
  assert.match(lift(w13wed).title, /upper body/)

  // Week 26: test week replaces the session.
  const w26 = planForDate(PLAN, START, '2027-01-25')
  assert.ok(w26.testWeek)
  assert.match(lift(w26).title, /Test week/)
})

test('weekly A/B/C rotation, run after Wednesday weights, weekend run on rest days', () => {
  const mon = planForDate(PLAN, START, '2026-08-03')
  assert.match(lift(mon).title, /glutes & hamstrings/)
  assert.equal(cardio(mon), undefined, 'no run stacked on Monday leg day')

  const wed = planForDate(PLAN, START, '2026-08-05')
  assert.match(lift(wed).title, /upper body/)
  assert.ok(cardio(wed), 'run goes after the Wednesday upper session')

  const fri = planForDate(PLAN, START, '2026-08-07')
  assert.match(lift(fri).title, /glutes & quads/)

  const tue = planForDate(PLAN, START, '2026-08-04')
  assert.equal(cardio(tue), undefined, 'weekend-only rest cardio stays off weekdays')
  const sat = planForDate(PLAN, START, '2026-08-08')
  assert.ok(cardio(sat), 'Saturday offers the easy run')
  assert.ok(cardio(sat).optional)

  // Phase 1 keeps the glute bridge; phase 2 swaps in the hip thrust.
  assert.match(lift(mon).exercises[0].name, /Glute bridge/)
  const w5 = planForDate(PLAN, START, '2026-08-31')
  assert.match(lift(w5).exercises[0].name, /Hip thrust/)
})

test('meals rotate through the bank and cover all four slots', () => {
  const day0 = planForDate(PLAN, START, '2026-08-03')
  const day1 = planForDate(PLAN, START, '2026-08-04')
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    assert.ok(mealBlock(day0, slot), `${slot} prescribed`)
  }
  assert.equal(mealBlock(day0, 'breakfast').title, PLANS[PLAN].meals.breakfast[0].name)
  assert.notEqual(mealBlock(day0, 'breakfast').title, mealBlock(day1, 'breakfast').title)
  // Bank of 4 cycles back around on day 4.
  const day4 = planForDate(PLAN, START, '2026-08-07')
  assert.equal(mealBlock(day4, 'breakfast').title, mealBlock(day0, 'breakfast').title)
})

// ---------------------------------------------------------- itemsForBlock

test('every cardio/steps logText in every shipped plan parses to a recognised item', () => {
  for (const plan of Object.values(PLANS)) {
    const texts = [`${plan.stepsTarget} steps`]
    for (const phase of plan.phases) {
      for (const c of (Array.isArray(phase.cardio) ? phase.cardio : [phase.cardio])) {
        if (c) texts.push(c.logText)
      }
      if (phase.restCardio) texts.push(phase.restCardio.logText)
    }
    for (const text of texts) {
      const items = parseWorkout(text)
      assert.ok(items.length, `${text} produced items`)
      for (const item of items) {
        assert.ok(item.recognised, `"${text}" must be recognised (got: ${item.name})`)
        assert.ok(activityKcal(item, 100) > 0, `"${text}" must burn something`)
      }
    }
  }
})

test('lift block becomes one strength item per exercise', () => {
  const day = planForDate(PLAN, START, '2026-08-03')
  const items = itemsForBlock(PLANS[PLAN], lift(day))
  assert.equal(items.length, lift(day).exercises.length)
  for (const item of items) {
    assert.ok(item.tags.includes('strength'))
    assert.equal(item.minutes, 9) // 3 sets × 3 min
    assert.ok(item.exercise.group)
    assert.ok(item.fromPlan)
  }
})

test('meal block items reconstruct the stated calories closely', () => {
  const day = planForDate(PLAN, START, '2026-08-03')
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const block = mealBlock(day, slot)
    const [item] = itemsForBlock(PLANS[PLAN], block)
    assert.equal(item.kcal, block.meal.kcal)
    assert.equal(item.protein, block.meal.protein)
    const rebuilt = item.protein * 4 + item.carbs * 4 + item.fat * 9
    assert.ok(Math.abs(rebuilt - item.kcal) < 25, `${block.title}: ${rebuilt} vs ${item.kcal}`)
  }
})

// ----------------------------------------------------------- plan targets

test('an active plan pins the daily targets to its prescription', () => {
  const prescribed = PLANS[PLAN]
  const person = { name: 'Katy', sex: 'female', age: 34, heightCm: 165, weightKg: 68, baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5, timezone: 'Asia/Dubai', climate: 'hot', proteinPerKg: null, planId: PLAN, planStart: START }
  const t = targetsFor(person, 0)
  assert.equal(t.calories, prescribed.kcal)
  assert.equal(t.protein, prescribed.macros.protein)
  assert.equal(t.carbs, prescribed.macros.carbs)
  assert.equal(t.fat, prescribed.macros.fat)
  assert.equal(t.plan.id, PLAN)
  // Without the plan the derived targets return. This is the path a profile
  // takes when its plan is detached or retired: Mifflin-St Jeor, not the
  // plan's fixed number.
  const free = targetsFor({ ...person, planId: null }, 0)
  assert.notEqual(free.calories, prescribed.kcal)
  assert.equal(free.plan, null)
  // A planId with no plan behind it must fall back the same way rather than
  // throwing or pinning stale targets — exactly what a retired plan leaves in
  // a stored profile until the next save.
  const orphaned = targetsFor({ ...person, planId: 'sixmonthsback' }, 0)
  assert.equal(orphaned.calories, free.calories)
  assert.equal(orphaned.plan, null)
})

test('planOverview pins phases to the calendar', () => {
  const o = planOverview(PLAN, START, '2026-08-06')
  assert.equal(o.currentWeek, 1)
  assert.equal(o.endDate, '2027-01-31')
  assert.equal(o.plan.phases[0].from, '2026-08-03')
  assert.equal(o.plan.phases[0].to, '2026-08-30')
  assert.equal(o.plan.phases[3].to, '2027-01-31')
})

// -------------------------------------------------------- API integration

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-plan-test-'))
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

async function ownerWithPlan(ctx) {
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const profile = (await (await call(ctx, '/profile', { token })).json()).profile
  await call(ctx, '/profile', { method: 'PUT', token, body: { ...profile, name: 'Katy', planId: PLAN, planStart: START } })
  return token
}

test('plan-day returns the prescription and confirm writes a real entry', async () => {
  const ctx = makeCtx()
  const token = await ownerWithPlan(ctx)
  const date = '2026-08-05' // week 1 Wednesday

  const day = (await (await call(ctx, `/plan-day?date=${date}`, { token })).json()).day
  assert.equal(day.status, 'active')
  const liftBlock = day.blocks.find((b) => b.key === 'lift')
  assert.ok(liftBlock.title.startsWith('Session B'))
  assert.equal(liftBlock.entryId, null)

  // Confirm the session.
  const confirmed = await call(ctx, '/plan-day/confirm', { method: 'POST', token, body: { date, key: 'lift' } })
  assert.equal(confirmed.status, 201)
  const { entry } = await confirmed.json()
  assert.equal(entry.kind, 'workout')
  assert.ok(entry.items.every((item) => item.planKey === `${date}:lift`))
  assert.ok(entry.items.every((item) => item.kcal > 0), 'decorated with real energy')

  // The tick shows up on re-read, and the day totals count the training.
  const after = (await (await call(ctx, `/plan-day?date=${date}`, { token })).json()).day
  assert.equal(after.blocks.find((b) => b.key === 'lift').entryId, entry.id)
  const built = await (await call(ctx, `/day?date=${date}`, { token })).json()
  assert.ok(built.day.training.strengthMinutes > 0)

  // Confirming twice does not double-log.
  const again = await (await call(ctx, '/plan-day/confirm', { method: 'POST', token, body: { date, key: 'lift' } })).json()
  assert.ok(again.already)
  const entries = (await (await call(ctx, `/day?date=${date}`, { token })).json()).entries
  assert.equal(entries.workouts.length, 1)

  // Deleting the entry unconfirms the block.
  await call(ctx, `/entries/${entry.id}`, { method: 'DELETE', token })
  const cleared = (await (await call(ctx, `/plan-day?date=${date}`, { token })).json()).day
  assert.equal(cleared.blocks.find((b) => b.key === 'lift').entryId, null)
})

test('meal confirm lands in the right slot with the plan macros', async () => {
  const ctx = makeCtx()
  const token = await ownerWithPlan(ctx)
  const date = '2026-08-03'

  const { entry } = await (await call(ctx, '/plan-day/confirm', { method: 'POST', token, body: { date, key: 'meal:dinner' } })).json()
  assert.equal(entry.kind, 'meal')
  assert.equal(entry.slot, 'dinner')
  assert.equal(entry.items[0].kcal, PLANS[PLAN].meals.dinner[0].kcal)

  const built = await (await call(ctx, `/day?date=${date}`, { token })).json()
  assert.equal(built.day.caloriesIn, PLANS[PLAN].meals.dinner[0].kcal)
  assert.equal(built.day.targets.calories, PLANS[PLAN].kcal, 'plan pins the day target')
})

test('plan endpoints behave without a plan and reject bad blocks', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  assert.equal((await (await call(ctx, '/plan-day', { token })).json()).plan, null)
  assert.equal((await call(ctx, '/plan-day/confirm', { method: 'POST', token, body: { key: 'lift' } })).status, 400)

  const withPlan = await ownerWithPlan(ctx)
  // Rest day has no lift block to confirm.
  assert.equal((await call(ctx, '/plan-day/confirm', { method: 'POST', token: withPlan, body: { date: '2026-08-04', key: 'lift' } })).status, 404)
  assert.equal((await call(ctx, '/plan-day/confirm', { method: 'POST', token: withPlan, body: { date: '2026-08-03', key: 'garbage' } })).status, 404)
})

/**
 * Retiring a plan has to reach profiles that were already following it — the
 * user cannot be expected to go and detach it by hand, and on a deployed app
 * nobody can reach into their stored profile to do it for them.
 */
test('retiring a plan detaches it from a profile that was following it', async () => {
  const ctx = makeCtx()
  const token = await ownerWithPlan(ctx)
  const before = (await (await call(ctx, '/profile', { token })).json()).profile
  assert.equal(before.planId, PLAN, 'precondition: the plan is attached')

  const retired = PLANS[PLAN]
  delete PLANS[PLAN]
  try {
    const { profile, targets } = await (await call(ctx, '/profile', { token })).json()
    assert.equal(profile.planId, null, 'the retired plan is no longer claimed')
    assert.equal(profile.planStart, null, 'its start date goes with it')
    assert.deepEqual(profile.planEdits, {}, 'and so do its per-session edits')
    // Targets revert to the derived numbers rather than the plan's fixed ones.
    assert.equal(targets.plan, null)
    assert.notEqual(targets.calories, retired.kcal)
    // The plan screens report "no plan" instead of erroring.
    assert.equal((await (await call(ctx, '/plan-day?date=2026-08-05', { token })).json()).plan, null)
    assert.equal((await (await call(ctx, '/plan-overview', { token })).json()).plan, null)
    assert.equal((await call(ctx, '/plan-day/confirm', { method: 'POST', token, body: { date: '2026-08-05', key: 'lift' } })).status, 400)
    // And the day still builds — this is the screen the user actually opens.
    const day = await (await call(ctx, '/day?date=2026-08-05', { token })).json()
    assert.ok(day.day.targets.calories > 0)
  } finally {
    PLANS[PLAN] = retired
  }
})

test('the seed migration hash matches the passcode "katy"', async () => {
  const { verifyPasscodeHash } = await import('../src/auth.js')
  const ok = await verifyPasscodeHash(
    'katy',
    '653b699059fe5cceb1de99454658f791',
    '4fac01e926aaac44b6a812dad575e6eb2188c1ae82adf1d0e5b1b6fad8330522'
  )
  assert.ok(ok)
})
