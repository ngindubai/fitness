import { test } from 'node:test'
import assert from 'node:assert/strict'

import { targetsFor } from '../src/engine.js'
import { parseWorkout, activityKcal } from '../src/parse.js'
import { climateAdjustedKcal } from '../src/engine.js'

const GARETH = {
  name: 'Gareth', sex: 'male', age: 37, heightCm: 178, weightKg: 115,
  baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5, timezone: 'Asia/Dubai',
  climate: 'hot', proteinPerKg: null, planId: 'sixmonthsback', planStart: '2026-08-03',
  eatBack: 'all',
}

// ------------------------------------------------------- eat-back policy

test('with a plan, exercise now extends the eating budget (the ring moves)', () => {
  const rest = targetsFor(GARETH, 0)
  const trained = targetsFor(GARETH, 300)
  assert.equal(rest.calories, 2300)
  assert.equal(trained.calories, 2600, 'all 300 kcal of training added to the budget')
  assert.equal(trained.exerciseCredit, 300)
  // Macro prescriptions stay the plan's own.
  assert.equal(trained.protein, 180)
})

test('half and none eat-back behave as labelled', () => {
  assert.equal(targetsFor({ ...GARETH, eatBack: 'half' }, 300).calories, 2450)
  const fixed = targetsFor({ ...GARETH, eatBack: 'none' }, 300)
  assert.equal(fixed.calories, 2300)
  assert.equal(fixed.exerciseCredit, 0)
})

test('non-plan users keep their long-standing full eat-back by default', () => {
  const free = { ...GARETH, planId: null, planStart: null }
  const diff = targetsFor(free, 300).calories - targetsFor(free, 0).calories
  assert.equal(diff, 300)
  const halfDiff = targetsFor({ ...free, eatBack: 'half' }, 300).calories - targetsFor({ ...free, eatBack: 'half' }, 0).calories
  assert.equal(halfDiff, 150)
})

// --------------------------------------------------- honest walking maths

test('a bare walk uses the compendium moderate value, not a brisk one', () => {
  const [item] = parseWorkout('walked 1 hour')
  assert.equal(item.met, 3.5)
  // 115 kg, hot climate, outdoors: (3.5 − 1) × 115 × 1.08 ≈ 310 net kcal.
  const kcal = climateAdjustedKcal(activityKcal(item, 115), item, GARETH)
  assert.ok(kcal >= 300 && kcal <= 320, `bare 1 h walk → ${kcal} kcal`)
})

test('a timed-and-measured walk is graded by its true pace', () => {
  const [item] = parseWorkout('walked 4.3km in 1 hour')
  // 4.3 km/h ≈ 2.7 mph → the 3.0-MET bracket.
  assert.equal(item.met, 3)
  const kcal = climateAdjustedKcal(activityKcal(item, 115), item, GARETH)
  assert.ok(kcal >= 240 && kcal <= 260, `4.3 km in 1 h → ${kcal} kcal`)
  // Saying "brisk" earns more, because pace beats adjectives only when given.
  const [brisk] = parseWorkout('brisk walk 1 hour')
  assert.equal(brisk.met, 4.5)
})
