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

const lift = (day) => day.blocks.find((b) => b.key === 'lift')
const cardio = (day) => day.blocks.find((b) => b.key === 'cardio')
const mealBlock = (day, slot) => day.blocks.find((b) => b.key === `meal:${slot}`)

// ------------------------------------------------------------ planForDate

test('plan lifecycle: upcoming, active, complete', () => {
  assert.equal(planForDate('sixmonthsback', START, '2026-08-02').status, 'upcoming')
  assert.equal(planForDate('sixmonthsback', START, '2026-08-03').status, 'active')
  // Week 26 runs to Sunday 2027-01-31; the day after, the plan is done.
  assert.equal(planForDate('sixmonthsback', START, '2027-01-31').status, 'active')
  assert.equal(planForDate('sixmonthsback', START, '2027-02-01').status, 'complete')
  assert.equal(planForDate('nonsense', START, '2026-08-03'), null)
})

test('gareth week 1: A/B alternation across Mon-Wed-Fri, rest between', () => {
  const mon = planForDate('sixmonthsback', START, '2026-08-03')
  assert.equal(mon.week, 1)
  assert.equal(mon.phase.number, 1)
  assert.ok(lift(mon).title.startsWith('Session A'))
  assert.equal(lift(mon).exercises[0].sets, 2) // phase 1: 2 sets
  assert.ok(cardio(mon), 'gym day carries the incline-walk cardio')

  const tue = planForDate('sixmonthsback', START, '2026-08-04')
  assert.equal(lift(tue), undefined, 'Tuesday is a rest day')
  assert.ok(tue.restNote)
  assert.ok(tue.blocks.find((b) => b.key === 'steps'), 'steps are prescribed daily')

  assert.ok(lift(planForDate('sixmonthsback', START, '2026-08-05')).title.startsWith('Session B'))
  assert.ok(lift(planForDate('sixmonthsback', START, '2026-08-07')).title.startsWith('Session A'))
  // Alternation carries into week 2: Monday is B.
  assert.ok(lift(planForDate('sixmonthsback', START, '2026-08-10')).title.startsWith('Session B'))
})

test('gareth deload and phase boundaries', () => {
  // Week 5 Monday = phase 2, 3 sets.
  const w5 = planForDate('sixmonthsback', START, '2026-08-31')
  assert.equal(w5.week, 5)
  assert.equal(w5.phase.number, 2)
  assert.equal(lift(w5).exercises[0].sets, 3)

  // Week 8 Monday: deload halves the sets.
  const w8 = planForDate('sixmonthsback', START, '2026-09-21')
  assert.equal(w8.week, 8)
  assert.ok(w8.deload)
  assert.equal(lift(w8).exercises[0].sets, 2)
  assert.match(lift(w8).detail, /deload/i)

  // Week 13 Monday: phase 3, weekly rotation pins Monday to Session A.
  const w13 = planForDate('sixmonthsback', START, '2026-10-26')
  assert.equal(w13.phase.number, 3)
  assert.match(lift(w13).title, /legs & push/)
  const w13wed = planForDate('sixmonthsback', START, '2026-10-28')
  assert.match(lift(w13wed).title, /pull & core/)

  // Week 26: test week replaces the session.
  const w26 = planForDate('sixmonthsback', START, '2027-01-25')
  assert.ok(w26.testWeek)
  assert.match(lift(w26).title, /Test week/)
})

test('katy: weekly A/B/C, run after Wednesday weights, weekend run on rest days', () => {
  const mon = planForDate('sixmonthsstronger', START, '2026-08-03')
  assert.match(lift(mon).title, /glutes & hamstrings/)
  assert.equal(cardio(mon), undefined, 'no run stacked on Monday leg day')

  const wed = planForDate('sixmonthsstronger', START, '2026-08-05')
  assert.match(lift(wed).title, /upper body/)
  assert.ok(cardio(wed), 'run goes after the Wednesday upper session')

  const fri = planForDate('sixmonthsstronger', START, '2026-08-07')
  assert.match(lift(fri).title, /glutes & quads/)

  const tue = planForDate('sixmonthsstronger', START, '2026-08-04')
  assert.equal(cardio(tue), undefined, 'weekend-only rest cardio stays off weekdays')
  const sat = planForDate('sixmonthsstronger', START, '2026-08-08')
  assert.ok(cardio(sat), 'Saturday offers the easy run')
  assert.ok(cardio(sat).optional)

  // Phase 1 keeps the glute bridge; phase 2 swaps in the hip thrust.
  assert.match(lift(mon).exercises[0].name, /Glute bridge/)
  const w5 = planForDate('sixmonthsstronger', START, '2026-08-31')
  assert.match(lift(w5).exercises[0].name, /Hip thrust/)
})

test('meals rotate through the bank and cover all four slots', () => {
  const day0 = planForDate('sixmonthsback', START, '2026-08-03')
  const day1 = planForDate('sixmonthsback', START, '2026-08-04')
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    assert.ok(mealBlock(day0, slot), `${slot} prescribed`)
  }
  assert.equal(mealBlock(day0, 'breakfast').title, PLANS.sixmonthsback.meals.breakfast[0].name)
  assert.notEqual(mealBlock(day0, 'breakfast').title, mealBlock(day1, 'breakfast').title)
  // Bank of 4 cycles back around on day 4.
  const day4 = planForDate('sixmonthsback', START, '2026-08-07')
  assert.equal(mealBlock(day4, 'breakfast').title, mealBlock(day0, 'breakfast').title)
})

// ---------------------------------------------------------- itemsForBlock

test('every cardio/steps logText in both plans parses to a recognised item', () => {
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
  const day = planForDate('sixmonthsback', START, '2026-08-03')
  const items = itemsForBlock(PLANS.sixmonthsback, lift(day))
  assert.equal(items.length, 5)
  for (const item of items) {
    assert.ok(item.tags.includes('strength'))
    assert.equal(item.minutes, 6) // 2 sets × 3 min
    assert.ok(item.exercise.group)
    assert.ok(item.fromPlan)
  }
})

test('meal block items reconstruct the stated calories closely', () => {
  const day = planForDate('sixmonthsback', START, '2026-08-03')
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const block = mealBlock(day, slot)
    const [item] = itemsForBlock(PLANS.sixmonthsback, block)
    assert.equal(item.kcal, block.meal.kcal)
    assert.equal(item.protein, block.meal.protein)
    const rebuilt = item.protein * 4 + item.carbs * 4 + item.fat * 9
    assert.ok(Math.abs(rebuilt - item.kcal) < 25, `${block.title}: ${rebuilt} vs ${item.kcal}`)
  }
})

// ----------------------------------------------------------- plan targets

test('an active plan pins the daily targets to its prescription', () => {
  const gareth = { name: 'Gareth', sex: 'male', age: 37, heightCm: 178, weightKg: 115, baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5, timezone: 'Asia/Dubai', climate: 'hot', proteinPerKg: null, planId: 'sixmonthsback', planStart: START }
  const t = targetsFor(gareth, 0)
  assert.equal(t.calories, 2300)
  assert.equal(t.protein, 180)
  assert.equal(t.carbs, 225)
  assert.equal(t.fat, 75)
  assert.equal(t.plan.id, 'sixmonthsback')
  // Without the plan the derived targets return.
  const free = targetsFor({ ...gareth, planId: null }, 0)
  assert.notEqual(free.calories, 2300)
  assert.equal(free.plan, null)
})

test('planOverview pins phases to the calendar', () => {
  const o = planOverview('sixmonthsback', START, '2026-08-06')
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
  await call(ctx, '/profile', { method: 'PUT', token, body: { ...profile, name: 'Gareth', planId: 'sixmonthsback', planStart: START } })
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
  assert.equal(entry.items[0].kcal, PLANS.sixmonthsback.meals.dinner[0].kcal)

  const built = await (await call(ctx, `/day?date=${date}`, { token })).json()
  assert.equal(built.day.caloriesIn, PLANS.sixmonthsback.meals.dinner[0].kcal)
  assert.equal(built.day.targets.calories, 2300, 'plan pins the day target')
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

test('the seed migration hash matches the passcode "katy"', async () => {
  const { verifyPasscodeHash } = await import('../src/auth.js')
  const ok = await verifyPasscodeHash(
    'katy',
    '653b699059fe5cceb1de99454658f791',
    '4fac01e926aaac44b6a812dad575e6eb2188c1ae82adf1d0e5b1b6fad8330522'
  )
  assert.ok(ok)
})
