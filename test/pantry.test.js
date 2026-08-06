import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseNutritionLabel } from '../public/label-parse.js'
import { parseMeal, matchFood, suggestFoods } from '../src/parse.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

// ------------------------------------------------------- label text parsing
// Fixtures are typical of the legally mandated UK/EU layout, with the kind
// of noise OCR actually produces.

test('a clean UK back-of-pack label parses fully', () => {
  const result = parseNutritionLabel(`
    Nutrition information
    Typical values      per 100g     per 30g serving
    Energy              1620kJ / 385kcal   486kJ / 116kcal
    Fat                 6.1g         1.8g
    of which saturates  1.1g         0.3g
    Carbohydrate        62g          18.6g
    of which sugars     17g          5.1g
    Fibre               7.5g         2.3g
    Protein             10g          3.0g
    Salt                0.28g        0.08g
  `)
  assert.equal(result.per100.kcal, 385)
  assert.equal(result.per100.fat, 6.1)
  assert.equal(result.per100.carbs, 62)
  assert.equal(result.per100.sugar, 17)
  assert.equal(result.per100.fibre, 7.5)
  assert.equal(result.per100.protein, 10)
  assert.equal(result.servingG, 30)
  assert.equal(result.fields, 6)
})

test('kJ-only energy converts, decimal commas survive, OCR zeros heal', () => {
  const result = parseNutritionLabel(`
    Energy 2OO0kJ
    Fat 12,5g
    Carbohydrate 45,0 g
    Protein 22g
  `)
  assert.equal(result.per100.kcal, 478) // 2000 kJ / 4.184
  assert.equal(result.per100.fat, 12.5)
  assert.equal(result.per100.carbs, 45)
  assert.ok(result.notes.some((n) => /kJ/.test(n)))
})

test('sugars and saturates never masquerade as carbs and fat', () => {
  const result = parseNutritionLabel(`
    Fat 10g
    of which saturates 4.5g
    Carbohydrate 50g
    of which sugars 30g
    Protein 5g
  `)
  assert.equal(result.per100.fat, 10)
  assert.equal(result.per100.carbs, 50)
  assert.equal(result.per100.sugar, 30)
})

test('implausible reads are flagged, not silently saved', () => {
  const suspicious = parseNutritionLabel(`
    Energy 100kcal
    Fat 30g
    Carbohydrate 50g
    Protein 40g
  `)
  assert.ok(suspicious.notes.some((n) => /misread/.test(n)))

  const swapped = parseNutritionLabel(`
    Carbohydrate 10g
    of which sugars 25g
  `)
  assert.ok(swapped.notes.some((n) => /Sugars read higher/.test(n)))
})

test('garbage in produces zero fields, not invented numbers', () => {
  const result = parseNutritionLabel('best before end see lid   store in a cool dry place')
  assert.equal(result.fields, 0)
})

// ------------------------------------------------- custom foods in the parser

const WHEY = {
  id: 'custom-1',
  name: 'Mega Whey (GymCo)',
  aliases: ['mega whey', 'gymco mega whey'],
  per100: { kcal: 380, protein: 78, carbs: 6, fat: 5, fibre: 1, sugar: 4 },
  unit: { name: 'serving', grams: 32 },
  tags: ['pantry'],
}

test('a pantry food parses by name, scoop and serving', () => {
  const [byName] = parseMeal('mega whey', [WHEY])
  assert.equal(byName.foodId, 'custom-1')
  assert.equal(byName.grams, 32)
  assert.equal(byName.kcal, 122)

  const [scoops] = parseMeal('2 scoops mega whey', [WHEY])
  assert.equal(scoops.grams, 64)

  const [weighed] = parseMeal('40g mega whey', [WHEY])
  assert.equal(weighed.kcal, 152)
  assert.deepEqual(weighed.tags, ['pantry'])
})

test('the pantry wins ties against the static database', () => {
  const bar = { ...WHEY, id: 'custom-2', name: 'Protein bar', aliases: ['protein bar'] }
  assert.equal(matchFood('protein bar', [bar]).food.id, 'custom-2')
  // And without the pantry the static food still matches.
  assert.equal(matchFood('protein bar').food.id, 'protein_bar')
})

test('did-you-mean can suggest pantry items', () => {
  const suggestions = suggestFoods('mega whye', 3, [WHEY])
  assert.ok(suggestions.some((s) => s.id === 'custom-1'))
})

// ----------------------------------------------------------- API integration

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-pantry-test-'))
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

test('scan-to-log, end to end: save, recognise, count, delete', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  const saved = await call(ctx, '/pantry', {
    method: 'POST', token,
    body: {
      name: 'Overnight Oats Pot', brand: 'OatCo', servingG: 60, source: 'scan',
      per100: { kcal: 370, protein: 12, carbs: 60, fat: 8, fibre: 9, sugar: 15 },
    },
  })
  assert.equal(saved.status, 201)
  const { item } = await saved.json()
  assert.equal(item.name, 'Overnight Oats Pot (OatCo)')

  // It lists, it parses, it counts toward the day.
  const list = await (await call(ctx, '/pantry', { token })).json()
  assert.equal(list.items.length, 1)

  const parsed = await (await call(ctx, '/parse', {
    method: 'POST', token, body: { kind: 'meal', text: '1 serving overnight oats pot' },
  })).json()
  assert.equal(parsed.items[0].foodId, item.id)
  assert.equal(parsed.items[0].grams, 60)
  assert.equal(parsed.items[0].kcal, 222)

  const today = (await (await call(ctx, '/profile', { token })).json()).today
  await call(ctx, '/entries', { method: 'POST', token, body: { kind: 'meal', text: 'overnight oats pot' } })
  const day = await (await call(ctx, `/day?date=${today}`, { token })).json()
  assert.equal(day.day.caloriesIn, 222)

  // Deleting it un-registers the name for future parses.
  await call(ctx, `/pantry/${item.id}`, { method: 'DELETE', token })
  const gone = await (await call(ctx, '/parse', {
    method: 'POST', token, body: { kind: 'meal', text: 'overnight oats pot' },
  })).json()
  assert.notEqual(gone.items[0]?.foodId, item.id)
})

test('scans are shared with the household but stay owned by the scanner', async () => {
  const ctx = makeCtx()
  const owner = (await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()).token
  const katy = (await (await call(ctx, '/signup', { method: 'POST', body: { passcode: 'katy-cooks', name: 'Katy' } })).json()).token

  await call(ctx, '/pantry', {
    method: 'POST', token: owner,
    body: { name: 'Shared Snack', per100: { kcal: 500, protein: 10, carbs: 50, fat: 25, fibre: 0, sugar: 20 } },
  })
  // Katy can see it and log it - that is the point of a household pantry -
  // but it arrives marked as shared and only its owner can delete it.
  const hers = await (await call(ctx, '/pantry', { token: katy })).json()
  assert.equal(hers.items.length, 1)
  assert.ok(hers.items[0].shared)
  assert.equal((await call(ctx, `/pantry/${hers.items[0].id}`, { method: 'DELETE', token: katy })).status, 404)
  assert.equal((await call(ctx, `/pantry/${hers.items[0].id}`, { method: 'DELETE', token: owner })).status, 200)
})

test('nonsense labels are rejected at the door', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()

  assert.equal((await call(ctx, '/pantry', {
    method: 'POST', token,
    body: { name: 'X', per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 } },
  })).status, 400)

  assert.equal((await call(ctx, '/pantry', {
    method: 'POST', token,
    body: { name: 'Impossible Bar', per100: { kcal: 100, protein: 50, carbs: 50, fat: 30 } },
  })).status, 400)

  assert.equal((await call(ctx, '/pantry', {
    method: 'POST', token,
    body: { name: 'No numbers at all', per100: {} },
  })).status, 400)
})

test('cell-per-line OCR layouts still parse via look-ahead', () => {
  const result = parseNutritionLabel(`
    Energy
    1520kJ / 362kcal
    Fat
    9.69
    Carbohydrate
    49g
    Protein
    20g
  `)
  assert.equal(result.per100.kcal, 362)
  assert.equal(result.per100.fat, 9.6) // "9.69" healed back to 9.6g
  assert.equal(result.per100.carbs, 49)
  assert.equal(result.per100.protein, 20)
})
