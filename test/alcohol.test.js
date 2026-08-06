import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseMeal } from '../src/parse.js'
import { unitsFor, ABV, FOODS_BY_ID } from '../src/data/foods.js'
import { buildDay, buildWeek, summarisePeriod } from '../src/engine.js'
import { reviewDay, reviewWeek } from '../src/coach.js'

const first = (text) => parseMeal(text)[0]
const PROFILE = {
  name: 'Gareth', sex: 'male', age: 37, heightCm: 178, weightKg: 115,
  baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5, timezone: 'Asia/Dubai',
  climate: 'hot', proteinPerKg: null, planId: null, planStart: null, eatBack: 'all',
}
const mealOf = (text) => ({ items: parseMeal(text) })

// ------------------------------------------------------------- the drinks

test('the drinks he actually drinks are recognised', () => {
  assert.equal(first('guinness').foodId, 'guinness')
  assert.equal(first('pint of guinness').foodId, 'guinness')
  assert.equal(first('brewdog').foodId, 'brewdog_punk')
  assert.equal(first('punk ipa').foodId, 'brewdog_punk')
  assert.equal(first('hazy jane').foodId, 'brewdog_hazy')
  assert.equal(first('red wine').foodId, 'wine_red')
  assert.equal(first('white wine').foodId, 'wine_white')
  assert.equal(first('guinness 0.0').foodId, 'guinness_zero')
})

test('wine varietals resolve to the right colour', () => {
  for (const red of ['merlot', 'shiraz', 'malbec', 'rioja', 'pinot noir', 'cab sav', 'chianti']) {
    assert.equal(first(red).foodId, 'wine_red', `${red} should be red`)
  }
  for (const white of ['sauvignon blanc', 'chardonnay', 'pinot grigio', 'riesling']) {
    assert.equal(first(white).foodId, 'wine_white', `${white} should be white`)
  }
})

test('a pint of Guinness lands on the published figure', () => {
  const pint = first('pint of guinness')
  assert.equal(pint.grams, 568)
  // Guinness Draught is ~210 kcal a pint - famously less than people assume.
  assert.ok(pint.kcal >= 200 && pint.kcal <= 220, `pint of Guinness = ${pint.kcal} kcal`)
  assert.equal(pint.units, 2.4)
})

// ---------------------------------------------- containers are real sizes

test('a can is 330 ml and a pint is 568 ml, for the same drink', () => {
  const can = first('can of brewdog')
  const pint = first('pint of brewdog')
  assert.equal(can.grams, 330)
  assert.equal(pint.grams, 568)
  assert.ok(pint.kcal > can.kcal * 1.6, 'a pint must cost meaningfully more than a can')
  // The default serving for a craft can IS the can.
  assert.equal(first('brewdog').grams, 330)
  assert.equal(first('brewdog').units, 1.8)
})

test('a bottle means 750 ml of wine but 330 ml of beer', () => {
  assert.equal(first('bottle of red wine').grams, 750)
  assert.equal(first('bottle of guinness').grams, 330)
  // A whole bottle of red is most of the weekly guideline in one go.
  assert.equal(first('bottle of red wine').units, 9.8)
})

test('glass sizes still respond to the size words', () => {
  const standard = first('glass of red wine')
  const large = first('large glass of red wine')
  assert.equal(standard.grams, 175)
  assert.ok(large.grams > standard.grams)
  assert.equal(standard.units, 2.3) // 175 ml at 13%
})

test('container sizes never apply to food, only drinks', () => {
  // "tin" is a container word; a tin of tuna must stay a tin of tuna.
  const tuna = first('tin of tuna')
  assert.equal(tuna.foodId, 'tuna_tinned')
  assert.equal(tuna.grams, FOODS_BY_ID.get('tuna_tinned').unit.grams)
})

// ------------------------------------------------------------ units maths

test('units follow the UK definition of 10 ml of ethanol', () => {
  assert.equal(unitsFor('spirits', 25), 1) // a single measure of 40%
  assert.equal(unitsFor('wine_red', 175), 2.3)
  assert.equal(unitsFor('guinness', 568), 2.4)
  assert.equal(unitsFor('brewdog_punk', 330), 1.8)
  // Alcohol-free drinks carry no units at all.
  assert.equal(unitsFor('guinness_zero', 568), 0)
  assert.equal(first('punk af').units, 0)
})

test('every alcohol-tagged food has an ABV, and no soft drink has one', () => {
  for (const food of FOODS_BY_ID.values()) {
    if (food.tags.includes('alcohol')) {
      assert.ok(ABV[food.id] > 0, `${food.id} is tagged alcohol but has no ABV`)
    } else {
      assert.ok(!ABV[food.id], `${food.id} has an ABV but is not tagged alcohol`)
    }
  }
})

// --------------------------------------------------------- day and week

test('a day totals its units and the coach names them', () => {
  const day = buildDay({
    profile: PROFILE,
    meals: [mealOf('2 pints of guinness, 2 glasses of red wine')],
    workouts: [],
    date: '2026-08-07',
  })
  // 2 × 2.4 + 2 × 2.3 = 9.4
  assert.equal(day.alcoholUnits, 9.4)
  assert.ok(day.alcoholKcal > 700)

  const review = reviewDay(day, PROFILE, [])
  const alcohol = review.findings.find((f) => f.code.startsWith('alcohol'))
  assert.ok(alcohol, 'the coach says something about it')
  assert.match(alcohol.text, /9\.4 units/)
})

test('lifting then drinking earns its own warning', () => {
  const day = buildDay({
    profile: PROFILE,
    meals: [mealOf('4 pints of guinness')],
    workouts: [{ items: [{ name: 'Bench press', minutes: 45, met: 5, tags: ['strength'], kcal: 300, exercise: { sets: 3, group: 'push' } }] }],
    date: '2026-08-07',
  })
  const review = reviewDay(day, PROFILE, [])
  assert.ok(review.findings.some((f) => f.code === 'alcohol_after_lifting'))
})

test('the week measures units against the 14-unit guideline', () => {
  const heavy = Array.from({ length: 7 }, (_, i) => buildDay({
    profile: PROFILE,
    meals: [mealOf(i < 4 ? '3 pints of guinness' : '200g chicken breast')],
    workouts: [],
    date: `2026-08-0${i + 1}`,
  }))
  const week = buildWeek(heavy)
  const summary = summarisePeriod(heavy)
  assert.equal(summary.alcoholUnits, 28.8) // 4 days × 3 pints × 2.4
  assert.equal(week.alcoholUnits, 28.8)

  const review = reviewWeek(week, PROFILE, heavy)
  const over = review.findings.find((f) => f.code === 'week_units_over')
  assert.ok(over, 'going over the guideline is called out')
  assert.match(over.text, /14-unit/)

  // A modest week gets credit rather than a lecture.
  const light = heavy.map((d, i) => buildDay({
    profile: PROFILE,
    meals: [mealOf(i === 5 ? '2 glasses of red wine' : '200g chicken breast')],
    workouts: [],
    date: d.date,
  }))
  const lightReview = reviewWeek(buildWeek(light), PROFILE, light)
  assert.ok(lightReview.findings.some((f) => f.code === 'week_units_ok'))
})
