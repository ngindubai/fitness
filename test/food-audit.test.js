import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { auditDay, SWAPS, UNIT_BASIS } from '../src/food-audit.js'
import { FOODS_BY_ID } from '../src/data/foods.js'
import { parseMeal } from '../src/parse.js'
import { buildDay, DEFAULT_PROFILE } from '../src/engine.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const PROFILE = { ...DEFAULT_PROFILE, name: 'T', sex: 'male', age: 37, heightCm: 178, weightKg: 115 }

function audit(text) {
  const items = parseMeal(text)
  const meals = [{ items }]
  const day = buildDay({ profile: PROFILE, meals, workouts: [], date: '2026-08-06' })
  return auditDay(meals, day)
}

test('every swap target exists and genuinely saves calories per 100 g', () => {
  for (const [fromId, toIds] of Object.entries(SWAPS)) {
    const from = FOODS_BY_ID.get(fromId)
    assert.ok(from, `unknown swap source ${fromId}`)
    assert.ok(toIds.length >= 1)
    for (const toId of toIds) {
      const to = FOODS_BY_ID.get(toId)
      assert.ok(to, `unknown swap target ${toId} (for ${fromId})`)
    }
    // The FIRST candidate must be a real improvement on the basis the engine
    // uses: item-for-item for discrete foods, per-100g for everything else.
    const best = FOODS_BY_ID.get(toIds[0])
    if (UNIT_BASIS[fromId]) {
      const fromKcal = (from.per100.kcal * from.unit.grams) / 100
      const toKcal = (UNIT_BASIS[fromId] * best.per100.kcal * best.unit.grams) / 100
      assert.ok(toKcal < fromKcal, `${fromId} → ${toIds[0]} costs more per item`)
    } else {
      const savesKcal = best.per100.kcal < from.per100.kcal
      const buysProtein = best.per100.protein >= from.per100.protein + 5
      assert.ok(savesKcal || buysProtein, `${fromId} → ${toIds[0]} improves nothing`)
    }
  }
})

test('fatty mince earns a like-for-like swap with honest arithmetic', () => {
  const result = audit('250g regular mince')
  const swap = result.findings.find((f) => f.kind === 'swap')
  assert.ok(swap, 'expected a swap finding')
  assert.match(swap.swapTo, /5% fat/)
  // (254 − 137) kcal/100g × 2.5 = 292 kcal, computed not vibes.
  assert.equal(swap.saveKcal, 293)
  assert.match(swap.why, /Same portion/)
})

test('alcohol with no lighter twin is a straight cut, with units named', () => {
  const result = audit('large glass of red wine')
  const cut = result.findings.find((f) => f.kind === 'cut')
  assert.ok(cut, 'red wine should be a cut')
  assert.match(cut.why, /units/)
  assert.ok(cut.saveKcal > 100)
})

test('beer swaps to the zero version instead of demanding abstinence', () => {
  const result = audit('pint of guinness')
  const swap = result.findings.find((f) => f.kind === 'swap')
  assert.ok(swap, 'guinness should offer the 0.0 swap')
  assert.match(swap.swapTo, /0\.0|zero/i)
})

test('the best protein deal on the plate gets kept, not cut', () => {
  const result = audit('200g chicken breast, doughnut')
  const keep = result.findings.find((f) => f.kind === 'keep')
  assert.ok(keep)
  assert.match(keep.item, /Chicken breast/)
  const donut = result.findings.find((f) => f.kind === 'swap' && /Doughnut/i.test(f.item))
  assert.ok(donut, 'the doughnut does not escape')
})

test('day notes call out protein and fibre shortfalls', () => {
  const result = audit('doughnut, crisps')
  const notes = result.findings.filter((f) => f.kind === 'note')
  assert.ok(notes.some((f) => /Protein/i.test(f.why)), 'protein shortfall note')
  assert.ok(notes.some((f) => /fibre/i.test(f.why)), 'fibre shortfall note')
})

test('the potential line adds up and an empty day audits to nothing', () => {
  const result = audit('250g regular mince, doughnut')
  const saves = result.findings.filter((f) => f.saveKcal && f.kind !== 'keep')
    .reduce((s, f) => s + f.saveKcal, 0)
  assert.equal(result.potential.saveKcal, saves)
  assert.equal(result.potential.wouldBe, result.potential.caloriesIn - saves)

  const empty = auditDay([], buildDay({ profile: PROFILE, meals: [], workouts: [], date: '2026-08-06' }))
  assert.equal(empty.findings.length, 0)
  assert.match(empty.headline, /Nothing logged/)
})

test('a clean high-protein day is praised, not nitpicked', () => {
  const result = audit('200g chicken breast, 200g broccoli, 150g brown rice')
  assert.ok(!result.findings.some((f) => f.kind === 'cut'), 'nothing to cut')
  assert.match(result.headline, /clean day|nothing worth flagging/i)
})

// ---------------------------------------------------------------- via API

test('the food-audit endpoint reads a real logged day', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-audit-test-'))
  const ctx = { store: new FileStore(join(dir, 'data.json')), secret: 's', passcode: 'boss-code', aiKey: null }
  const call = (path, opts = {}) => handleApi(
    new Request(`http://x/api${path}`, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }), ctx)

  const { token } = await (await call('/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  await call('/entries', { method: 'POST', token, body: { kind: 'meal', slot: 'lunch', text: '250g regular mince, pint of guinness' } })

  const auditResult = await (await call('/food-audit', { token })).json()
  assert.ok(auditResult.findings.some((f) => f.kind === 'swap' && /mince/i.test(f.item)))
  assert.ok(auditResult.findings.some((f) => /Guinness/i.test(f.item)))
  assert.match(auditResult.headline, /kcal in/)
  assert.ok(auditResult.potential.saveKcal > 200)
})
