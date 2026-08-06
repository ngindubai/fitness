import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseMeal } from '../src/parse.js'
import { FOODS } from '../src/data/foods.js'

/** Parse a single phrase and return the matched food id (or null). */
function idOf(text) {
  const [item] = parseMeal(text)
  return item?.foodId ?? null
}

test('raw cooking ingredients parse to the right larder entries', () => {
  const expectations = [
    ['200g flour', 'flour_plain'],
    ['10g sugar', 'sugar'],
    ['20g honey', 'honey'],
    ['2 cloves garlic', 'garlic'],
    ['10g fresh ginger', 'ginger'],
    ['400g tinned tomatoes', 'tinned_tomatoes'],
    ['30g tomato puree', 'tomato_puree'],
    ['200g coconut milk', 'coconut_milk'],
    ['75g dry rice', 'rice_dry'],
    ['100g dry pasta', 'pasta_dry'],
    ['150g turkey mince', 'turkey_mince'],
    ['150g lamb mince', 'lamb_mince'],
    ['15g cornflour', 'cornflour'],
    ['30g breadcrumbs', 'breadcrumbs'],
    ['10g coconut oil', 'coconut_oil'],
    ['15g ghee', 'ghee'],
    ['30g tahini', 'tahini'],
    ['10g sesame seeds', 'sesame_seeds'],
    ['200g butternut squash', 'butternut_squash'],
    ['1 lemon', 'lemon'],
    ['2 spring onions', 'spring_onion'],
    ['1 stick celery', 'celery'],
    ['100g natural yoghurt', 'yoghurt_natural'],
    ['30g sour cream', 'sour_cream'],
    ['chicken stock', 'stock_cube'],
    ['15g maple syrup', 'maple_syrup'],
    ['10g cocoa powder', 'cocoa_powder'],
    ['30g chocolate chips', 'dark_choc_chips'],
    ['30g pumpkin seeds', 'pumpkin_seeds'],
    ['10g flaxseed', 'flaxseed'],
  ]
  for (const [text, expected] of expectations) {
    assert.equal(idOf(text), expected, `"${text}" should match ${expected}, got ${idOf(text)}`)
  }
})

test('new aliases do not steal existing matches', () => {
  // "chilli" on its own is the dish; the raw pepper needs to be asked for.
  assert.equal(idOf('bowl of chilli'), 'chilli_con_carne')
  assert.equal(idOf('1 red chilli'), 'chilli_fresh')
  // "flour" must not hijack cauliflower, nor "oil" the olive oil entry.
  assert.equal(idOf('200g cauliflower'), 'cauliflower')
  assert.equal(idOf('10g olive oil'), 'olive_oil')
  // Cooked staples keep winning when the word "dry" is absent.
  assert.equal(idOf('150g rice'), 'rice_white_cooked')
  assert.equal(idOf('150g pasta'), 'pasta_cooked')
  // Sugar must not swallow "brown sugar".
  assert.equal(idOf('10g brown sugar'), 'sugar_brown')
})

test('no alias is claimed by two foods', () => {
  const seen = new Map()
  const clashes = []
  for (const food of FOODS) {
    for (const term of new Set([food.name.toLowerCase(), ...food.aliases])) {
      if (seen.has(term)) clashes.push(`"${term}": ${seen.get(term)} vs ${food.id}`)
      else seen.set(term, food.id)
    }
  }
  assert.deepEqual(clashes, [], clashes.join(' | '))
})

test('every food row is well-formed and ids stay unique', () => {
  const ids = new Set()
  for (const food of FOODS) {
    assert.ok(!ids.has(food.id), `duplicate id ${food.id}`)
    ids.add(food.id)
    assert.ok(food.per100.kcal >= 0 && food.per100.kcal <= 950, `${food.id} kcal ${food.per100.kcal}`)
    // Macros cannot add up to more energy than the calories claim (small
    // rounding slack allowed).
    const macroKcal = food.per100.protein * 4 + food.per100.carbs * 4 + food.per100.fat * 9
    assert.ok(macroKcal <= food.per100.kcal * 1.25 + 40, `${food.id}: macros ${macroKcal} vs ${food.per100.kcal} kcal`)
    assert.ok(food.unit.grams > 0, `${food.id} unit grams`)
  }
  assert.ok(FOODS.length >= 290, `library size ${FOODS.length}`)
})
