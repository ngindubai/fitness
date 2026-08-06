import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseMeal, parseWorkout, parseFoodPhrase, parseWorkoutPhrase, activityKcal } from '../src/parse.js'
import { bmr, targetsFor, buildDay, buildWeek, DEFAULT_PROFILE } from '../src/engine.js'
import { reviewDay, reviewWeek } from '../src/coach.js'
import { recommendMeals, mealMacros } from '../src/recommend.js'
import { MEAL_TEMPLATES } from '../src/data/meals.js'
import { FOODS, FOODS_BY_ID } from '../src/data/foods.js'
import { ACTIVITIES } from '../src/data/activities.js'

const PROFILE = { ...DEFAULT_PROFILE, sex: 'male', age: 42, heightCm: 180, weightKg: 90, goal: 'lose', rateKgPerWeek: 0.5 }

// ------------------------------------------------------------ data integrity

test('every meal template references foods that exist', () => {
  const missing = []
  for (const template of MEAL_TEMPLATES) {
    for (const { foodId } of template.components) {
      if (!FOODS_BY_ID.has(foodId)) missing.push(`${template.id} -> ${foodId}`)
    }
  }
  assert.deepEqual(missing, [], `unknown food ids: ${missing.join(', ')}`)
})

test('food ids and activity ids are unique', () => {
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length)
  assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length)
})

test('macros are physically plausible for every food', () => {
  for (const food of FOODS) {
    const { kcal, protein, carbs, fat } = food.per100
    const fromMacros = protein * 4 + carbs * 4 + fat * 9
    // Alcohol carries 7 kcal/g that the four tracked macros do not account for,
    // so those rows legitimately sit above the macro-derived figure.
    if (food.tags.includes('alcohol')) {
      assert.ok(kcal >= fromMacros - 5, `${food.id}: alcohol should not be below macro energy`)
      continue
    }
    assert.ok(
      Math.abs(kcal - fromMacros) <= Math.max(30, kcal * 0.2),
      `${food.id}: ${kcal} kcal vs ${fromMacros.toFixed(0)} from macros`
    )
  }
})

// -------------------------------------------------------------- food parsing

test('parses counts, units and explicit weights', () => {
  const items = parseMeal('2 eggs, 200g chicken breast, 3 slices wholemeal bread')
  assert.equal(items.length, 3)

  const [eggs, chicken, bread] = items
  assert.equal(eggs.foodId, 'egg')
  assert.equal(eggs.grams, 100)         // 2 x 50 g
  assert.equal(chicken.foodId, 'chicken_breast')
  assert.equal(chicken.grams, 200)
  assert.equal(Math.round(chicken.protein), 62)
  assert.equal(bread.foodId, 'bread_wholemeal')
  assert.equal(bread.grams, 108)        // 3 x 36 g
})

test('prefers the more specific food when names overlap', () => {
  assert.equal(parseFoodPhrase('sweet potato').foodId, 'sweet_potato')
  assert.equal(parseFoodPhrase('potato').foodId, 'potato_boiled')
  assert.equal(parseFoodPhrase('brown rice').foodId, 'rice_brown_cooked')
})

test('handles size modifiers and worded quantities', () => {
  const large = parseFoodPhrase('large banana')
  const plain = parseFoodPhrase('banana')
  assert.ok(large.grams > plain.grams)

  assert.equal(parseFoodPhrase('a coffee').foodId, 'coffee_black')
  assert.equal(parseFoodPhrase('two apples').grams, 360)
})

test('flags food it cannot identify rather than guessing', () => {
  const [item] = parseMeal('grandmas mystery casserole')
  assert.equal(item.recognised, false)
  assert.equal(item.kcal, 0)
})

test('splits a natural sentence into separate items', () => {
  const items = parseMeal('bacon and eggs with a black coffee')
  const ids = items.map((i) => i.foodId)
  assert.ok(ids.includes('bacon'))
  assert.ok(ids.includes('egg'))
  assert.ok(ids.includes('coffee_black'))
})

// ----------------------------------------------------------- workout parsing

test('derives running intensity from pace when distance and time are given', () => {
  const fast = parseWorkoutPhrase('ran 10k in 40 mins')
  const slow = parseWorkoutPhrase('ran 10k in 70 mins')
  assert.equal(fast.minutes, 40)
  assert.equal(slow.minutes, 70)
  assert.ok(fast.met > slow.met, 'a faster pace must score a higher MET value')
})

test('parses hours, colons and steps', () => {
  assert.equal(parseWorkoutPhrase('1h30 cycling').minutes, 90)
  assert.equal(parseWorkoutPhrase('cycling 1:15').minutes, 75)

  const steps = parseWorkoutPhrase('12000 steps')
  assert.equal(steps.activityId, 'walk_moderate')
  assert.ok(steps.distanceKm > 8 && steps.distanceKm < 10)
})

test('recognises strength work and tags it', () => {
  const [item] = parseWorkout('45 min weights')
  assert.ok(item.tags.includes('strength'))
  assert.equal(item.minutes, 45)
})

test('exercise energy is net of resting metabolism', () => {
  // 1 MET is what the body burns at rest, so it must cost nothing extra.
  assert.equal(activityKcal({ met: 1, minutes: 60 }, 80), 0)
  // A 10 MET hour at 80 kg is 800 gross, 80 resting, 720 net.
  assert.equal(activityKcal({ met: 10, minutes: 60 }, 80), 720)
})

// ---------------------------------------------------------------- the engine

test('Mifflin-St Jeor matches the published formula', () => {
  // 10(90) + 6.25(180) - 5(42) + 5 = 900 + 1125 - 210 + 5
  assert.equal(bmr(PROFILE), 1820)
  assert.equal(bmr({ ...PROFILE, sex: 'female' }), 1654)
})

test('a fat-loss target sits below maintenance but respects the safety floor', () => {
  const normal = targetsFor(PROFILE, 0)
  assert.ok(normal.calories < normal.maintenance)
  assert.equal(normal.protein, 180)   // 2.0 g/kg in a deficit

  const extreme = targetsFor({ ...PROFILE, weightKg: 55, rateKgPerWeek: 1.5 }, 0)
  assert.ok(extreme.calories >= 1500, 'must not recommend below the 1500 kcal floor for men')
  assert.ok(extreme.capNote)
})

test('training raises both the burn and the day\'s allowance', () => {
  const rest = targetsFor(PROFILE, 0)
  const trained = targetsFor(PROFILE, 500)
  assert.equal(trained.maintenance - rest.maintenance, 500)
  assert.equal(trained.calories - rest.calories, 500)
})

test('buildDay totals food, training and balance together', () => {
  const day = buildDay({
    profile: PROFILE,
    date: '2026-08-06',
    meals: [{ date: '2026-08-06', slot: 'lunch', items: parseMeal('200g chicken breast, 180g brown rice') }],
    workouts: [{ date: '2026-08-06', items: parseWorkout('30 min run').map((i) => ({ ...i, kcal: activityKcal(i, 90) })) }],
  })

  assert.ok(day.caloriesIn > 500 && day.caloriesIn < 700)
  assert.ok(day.training.kcal > 200)
  assert.equal(day.caloriesOut, day.targets.baseline + day.training.kcal)
  assert.equal(day.deficit, -day.net)
  assert.ok(day.logged)
})

// ----------------------------------------------------------------- the coach

test('calls out a surplus day as a surplus', () => {
  const meals = [{ date: '2026-08-06', slot: 'dinner', items: [
    { foodId: 'pizza_cheese', name: 'Pizza', kcal: 2400, protein: 90, carbs: 300, fat: 90, fibre: 12, sugar: 30, grams: 900, recognised: true, tags: ['junk'] },
    { foodId: 'beer_lager', name: 'Lager', kcal: 800, protein: 4, carbs: 60, fat: 0, fibre: 0, sugar: 4, grams: 1800, recognised: true, tags: ['alcohol'] },
  ] }]
  const day = buildDay({ profile: PROFILE, date: '2026-08-06', meals, workouts: [] })
  const review = reviewDay(day, PROFILE, [])

  assert.ok(day.net > 0, 'test fixture should produce a surplus')
  assert.equal(review.findings[0].severity, 'critical')
  assert.equal(review.findings[0].code, 'surplus')
  assert.ok(review.findings.some((f) => f.code === 'alcohol_heavy'))
  assert.ok(review.score < 40)
})

test('a good day is graded as one, without invented criticism', () => {
  const meals = [{ date: '2026-08-06', slot: 'all', items: [
    { foodId: 'x', name: 'On-plan food', kcal: 2200, protein: 185, carbs: 210, fat: 65, fibre: 35, sugar: 40, grams: 1500, recognised: true, tags: [] },
  ] }]
  const workouts = [{ date: '2026-08-06', items: [
    { activityId: 'weights_vigorous', name: 'Weights', minutes: 60, met: 6, kcal: 450, tags: ['strength', 'vigorous'], recognised: true },
  ] }]

  const day = buildDay({ profile: PROFILE, date: '2026-08-06', meals, workouts })
  const review = reviewDay(day, PROFILE, [])

  assert.ok(review.score >= 70, `expected a good score, got ${review.score}`)
  assert.ok(!review.findings.some((f) => f.severity === 'critical' || f.severity === 'bad'))
})

test('an empty day is reported as missing data, not as a perfect day', () => {
  const day = buildDay({ profile: PROFILE, date: '2026-08-06', meals: [], workouts: [] })
  const review = reviewDay(day, PROFILE, [])
  assert.equal(review.score, 0)
  assert.equal(review.findings[0].code, 'no_log')
})

test('spots a run of untrained days', () => {
  const blank = { training: { minutes: 0, strengthMinutes: 0 } }
  const meals = [{ date: '2026-08-06', items: [
    { foodId: 'x', name: 'Food', kcal: 2000, protein: 150, carbs: 200, fat: 60, fibre: 30, sugar: 30, grams: 1200, recognised: true, tags: [] },
  ] }]
  const day = buildDay({ profile: PROFILE, date: '2026-08-06', meals, workouts: [] })
  const review = reviewDay(day, PROFILE, [blank, blank, blank])
  assert.ok(review.findings.some((f) => f.code === 'no_training_streak'))
})

test('the weekly review reads the trend, not a single day', () => {
  const days = Array.from({ length: 7 }, (_, index) => buildDay({
    profile: PROFILE,
    date: `2026-08-0${index + 1}`,
    meals: [{ date: `2026-08-0${index + 1}`, items: [
      { foodId: 'x', name: 'Food', kcal: 2100, protein: 180, carbs: 200, fat: 60, fibre: 32, sugar: 30, grams: 1300, recognised: true, tags: [] },
    ] }],
    workouts: [],
  }))
  const week = buildWeek(days)
  const review = reviewWeek(week, PROFILE, days)

  assert.equal(week.loggedDays, 7)
  assert.ok(week.projectedKgPerWeek < 0, 'a week under maintenance should project a loss')
  assert.ok(review.findings.some((f) => f.code === 'week_strength'))
})

// ------------------------------------------------------------ the recommender

test('meal templates compute sane macros', () => {
  for (const template of MEAL_TEMPLATES) {
    const macros = mealMacros(template)
    assert.deepEqual(macros.missing, [], `${template.id} has unknown components`)
    assert.ok(macros.kcal > 50, `${template.id} is suspiciously low at ${macros.kcal} kcal`)
    assert.ok(macros.kcal < 1600, `${template.id} is suspiciously high at ${macros.kcal} kcal`)
  }
})

test('recommendations respect the slot and the calories left', () => {
  const { meals } = recommendMeals({
    profile: PROFILE,
    remaining: { kcal: 700, protein: 60 },
    slot: 'dinner',
    history: [],
    today: '2026-08-06',
    limit: 4,
  })

  assert.equal(meals.length, 4)
  assert.ok(meals.every((m) => m.slot === 'dinner'))
  assert.ok(meals[0].macros.kcal <= 900, 'top pick should fit the remaining budget')
})

test('recommendations shift towards foods that appear in the history', () => {
  const history = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    slot: 'dinner',
    items: [{ foodId: 'salmon' }, { foodId: 'sweet_potato' }, { foodId: 'broccoli' }],
  }))

  const withHistory = recommendMeals({
    profile: PROFILE, remaining: { kcal: 900, protein: 60 }, slot: 'dinner',
    history, today: '2026-08-06', limit: 5,
  })

  const salmonRank = withHistory.meals.findIndex((m) => m.id === 'd_salmon_sweet_potato')
  assert.ok(salmonRank >= 0 && salmonRank < 3, `expected the salmon dish near the top, got rank ${salmonRank}`)
  assert.ok(withHistory.taste.confident)
  assert.equal(withHistory.taste.favourites[0].foodId, 'salmon')
})

test('low-effort filter excludes anything that takes too long', () => {
  const { meals } = recommendMeals({
    profile: PROFILE, remaining: { kcal: 600, protein: 40 },
    history: [], today: '2026-08-06', maxEffortMinutes: 5, limit: 4,
  })
  assert.ok(meals.every((m) => m.effortMinutes <= 5))
})

// ------------------------------------------------------- regression coverage

test('a qualifier picks the right bread rather than the generic one', () => {
  assert.equal(parseFoodPhrase('2 slices wholemeal toast').foodId, 'bread_wholemeal')
  assert.equal(parseFoodPhrase('brown toast').foodId, 'bread_wholemeal')
  assert.equal(parseFoodPhrase('toast').foodId, 'bread_white')
})

test('parsed food reports the portion it assumed', () => {
  const pizza = parseFoodPhrase('large pepperoni pizza')
  assert.equal(pizza.foodId, 'pizza_pepperoni')
  assert.equal(pizza.portion.unit, 'slices')
  assert.ok(pizza.portion.count > 1)

  assert.equal(parseFoodPhrase('1 egg').portion.unit, 'egg')
  assert.equal(parseFoodPhrase('2 eggs').portion.count, 2)
})

test('past-tense logging is understood', () => {
  assert.equal(parseWorkoutPhrase('ran 5k in 27 mins').activityId?.startsWith('run'), true)
  assert.equal(parseWorkoutPhrase('cycled for 40 minutes').activityId, 'cycle_light')
  assert.equal(parseWorkoutPhrase('swam 30 mins').activityId, 'swim_moderate')
  assert.equal(parseWorkoutPhrase('lifted for an hour').activityId, 'weights_light')
})

test('a trivial overshoot does not trigger the "ate it back" rebuke', () => {
  const meals = [{ date: '2026-08-06', items: [
    { foodId: 'x', name: 'Food', kcal: 2400, protein: 180, carbs: 220, fat: 70, fibre: 30, sugar: 30, grams: 1500, recognised: true, tags: [] },
  ] }]
  const workouts = [{ date: '2026-08-06', items: [
    { activityId: 'run_6mph', name: 'Run', minutes: 30, met: 9.3, kcal: 400, tags: ['cardio', 'vigorous'], recognised: true },
  ] }]
  const day = buildDay({ profile: PROFILE, date: '2026-08-06', meals, workouts })
  const review = reviewDay(day, PROFILE, [])

  // Just over target, well inside the error bars — the coach should not both
  // excuse it and scold it in the same review.
  assert.ok(day.caloriesIn - day.targets.calories < 250)
  assert.ok(!review.findings.some((f) => f.code === 'ate_back'))
})

// ------------------------------------------------ strength & environment (v2)

test('parses structured lifts: sets, reps, load, volume', () => {
  const bench = parseWorkoutPhrase('bench press 3x8 80kg')
  assert.equal(bench.exercise.id, 'bench')
  assert.equal(bench.exercise.sets, 3)
  assert.equal(bench.exercise.reps, 8)
  assert.equal(bench.exercise.weightKg, 80)
  assert.equal(bench.exercise.volume, 1920)
  assert.equal(bench.minutes, 9)
  assert.ok(bench.tags.includes('strength'))

  const squat = parseWorkoutPhrase('squat 5 sets of 5 at 140')
  assert.equal(squat.exercise.id, 'squat')
  assert.equal(squat.exercise.volume, 3500)

  const pullups = parseWorkoutPhrase('pull ups 4x8')
  assert.equal(pullups.exercise.id, 'pull_up')
  assert.equal(pullups.exercise.volume, null)   // bodyweight - no tonnage claim
  assert.equal(pullups.recognised, true)
})

test('interval notation is not mistaken for lifting', () => {
  // 5x400m sprints: reps 400 exceeds the cap, so this stays cardio.
  const intervals = parseWorkoutPhrase('ran 5x400m intervals in 12 mins')
  assert.ok(!intervals.exercise, 'should not be parsed as a lift')
})

test('a whole gym session parses line by line', () => {
  const items = parseWorkout('bench 3x8 80kg, incline bench 3x10 60kg, lat pulldown 4x12 70kg then 15 min treadmill')
  const lifts = items.filter((i) => i.exercise)
  assert.equal(lifts.length, 3)
  assert.equal(lifts[1].exercise.id, 'incline_bench')
  const cardio = items.find((i) => i.activityId === 'treadmill')
  assert.ok(cardio)
  assert.equal(cardio.outdoor, false)
})

test('outdoor detection: street yes, treadmill and gym no', () => {
  assert.equal(parseWorkoutPhrase('ran 5k in 30 min').outdoor, true)
  assert.equal(parseWorkoutPhrase('30 min treadmill run').outdoor, false)
  assert.equal(parseWorkoutPhrase('8000 steps').outdoor, true)
  assert.equal(parseWorkoutPhrase('8000 steps on the treadmill').outdoor, false)
})

test('hot climate raises outdoor burn by 8%, indoor untouched', async () => {
  const { climateAdjustedKcal, HEAT_MULTIPLIER } = await import('../src/engine.js')
  const hot = { ...PROFILE, climate: 'hot' }
  const temperate = { ...PROFILE, climate: 'temperate' }

  assert.equal(climateAdjustedKcal(400, { outdoor: true }, hot), Math.round(400 * HEAT_MULTIPLIER))
  assert.equal(climateAdjustedKcal(400, { outdoor: false }, hot), 400)
  assert.equal(climateAdjustedKcal(400, { outdoor: true }, temperate), 400)
})

test('water target scales with weight, climate and training', async () => {
  const { waterTargetMl } = await import('../src/engine.js')
  const gareth = { weightKg: 115, climate: 'hot' }

  const rest = waterTargetMl(gareth, 0)
  assert.equal(rest, 4500)                       // 115*35 + 500 = 4525, to nearest 250
  assert.ok(waterTargetMl(gareth, 60) > rest)    // training adds
  assert.ok(waterTargetMl({ weightKg: 115, climate: 'temperate' }, 0) < rest)
})

test('buildDay carries water and the day target', () => {
  const day = buildDay({
    profile: { ...PROFILE, weightKg: 115, climate: 'hot' },
    date: '2026-08-06',
    meals: [],
    workouts: [],
    waters: [{ value: 500 }, { value: 750 }],
  })
  assert.equal(day.waterMl, 1250)
  assert.equal(day.targets.waterMl, 4500)
})

test('summarisePeriod aggregates volume, streaks and weight change', async () => {
  const { summarisePeriod } = await import('../src/engine.js')
  const liftDay = (date) => buildDay({
    profile: PROFILE, date,
    meals: [{ date, items: [{ foodId: 'x', name: 'F', kcal: 2000, protein: 180, carbs: 180, fat: 60, fibre: 30, sugar: 20, grams: 1200, recognised: true, tags: [] }] }],
    workouts: [{ date, items: parseWorkout('bench 3x8 80kg, squat 3x5 120kg').map((i) => ({ ...i, kcal: 200 })) }],
  })
  const emptyDay = (date) => buildDay({ profile: PROFILE, date, meals: [], workouts: [] })

  const days = [liftDay('2026-08-01'), liftDay('2026-08-02'), emptyDay('2026-08-03'), liftDay('2026-08-04')]
  const summary = summarisePeriod(days, [
    { date: '2026-08-01', value: 116.2 }, { date: '2026-08-04', value: 115.4 },
  ])

  assert.equal(summary.loggedDays, 3)
  assert.equal(summary.totalVolumeKg, (1920 + 1800) * 3)
  assert.ok(summary.volumeByGroup.push > 0 && summary.volumeByGroup.legs > 0)
  assert.equal(summary.bestStreak, 2)
  assert.equal(summary.weightChange, -0.8)
})

test('the coach notices heat and thin hydration', () => {
  const hotProfile = { ...PROFILE, weightKg: 115, climate: 'hot' }
  const meals = [{ date: '2026-08-06', items: [
    { foodId: 'x', name: 'Food', kcal: 2000, protein: 200, carbs: 150, fat: 60, fibre: 30, sugar: 20, grams: 1200, recognised: true, tags: [] },
  ] }]
  const workouts = [{ date: '2026-08-06', items: [
    { activityId: 'walk_brisk', name: 'Walk', minutes: 60, met: 4.8, kcal: 380, tags: ['cardio'], outdoor: true, recognised: true },
  ] }]
  const day = buildDay({ profile: hotProfile, date: '2026-08-06', meals, workouts, waters: [{ value: 1000 }] })
  const review = reviewDay(day, hotProfile, [])

  assert.ok(review.findings.some((f) => f.code === 'heat'))
  assert.ok(review.findings.some((f) => f.code === 'water_low'), 'a litre against 4.5L should be called out')
})

test('exercise ids are unique and defaults now match the owner', async () => {
  const { EXERCISES } = await import('../src/data/exercises.js')
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length)

  assert.equal(DEFAULT_PROFILE.age, 37)
  assert.equal(DEFAULT_PROFILE.weightKg, 115)
  assert.equal(DEFAULT_PROFILE.timezone, 'Asia/Dubai')
  assert.equal(DEFAULT_PROFILE.climate, 'hot')
})

test('protein scales to adjusted body weight above BMI 30', () => {
  // 115 kg at 178 cm is BMI ~36. Ideal = 25 x 1.78^2 = 79.2 kg;
  // adjusted = 79.2 + 0.4 x 35.8 = 93.5 kg; at 2.0 g/kg -> 187 g.
  const heavy = targetsFor({ ...PROFILE, weightKg: 115, heightCm: 178, goal: 'lose' }, 0)
  assert.ok(heavy.protein >= 180 && heavy.protein <= 192, `got ${heavy.protein}`)

  // Under BMI 30 nothing changes: 90 kg at 180 cm is BMI 27.8.
  const lean = targetsFor({ ...PROFILE, weightKg: 90, heightCm: 180, goal: 'lose' }, 0)
  assert.equal(lean.protein, 180)
})
