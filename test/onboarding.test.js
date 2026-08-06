import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { targetsFor, bmiInfo, BMI_BANDS, DEFAULT_PROFILE } from '../src/engine.js'
import { EXERCISES, muscleTiers } from '../src/data/exercises.js'
import { handleApi } from '../src/api.js'
import { FileStore } from '../src/store/file.js'

const base = {
  ...DEFAULT_PROFILE,
  name: 'Test', sex: 'male', age: 37, heightCm: 178, weightKg: 115,
  baseline: 'light', goal: 'lose', rateKgPerWeek: 0.5,
}

// -------------------------------------------------- BMR truly personal

test('starting calories depend on sex: Mifflin-St Jeor offsets', () => {
  const male = targetsFor({ ...base, sex: 'male' }, 0)
  const female = targetsFor({ ...base, sex: 'female' }, 0)
  // Same body, different sex: the equations differ by exactly 166 kcal of BMR.
  assert.equal(male.bmr - female.bmr, 166)
})

test('starting calories depend on age and weight', () => {
  const young = targetsFor({ ...base, age: 25 }, 0)
  const old = targetsFor({ ...base, age: 55 }, 0)
  assert.equal(young.bmr - old.bmr, 150) // 5 kcal BMR per year, 30 years apart

  const heavy = targetsFor({ ...base, weightKg: 120 }, 0)
  const light = targetsFor({ ...base, weightKg: 80 }, 0)
  assert.equal(heavy.bmr - light.bmr, 400) // 10 kcal BMR per kg
})

// ----------------------------------------------------------------- BMI

test('bmiInfo lands people in the right WHO band', () => {
  const at = (weightKg, heightCm = 178) => bmiInfo({ ...base, weightKg, heightCm })
  assert.equal(at(55).band, 'underweight')   // BMI 17.4
  assert.equal(at(70).band, 'healthy')       // BMI 22.1
  assert.equal(at(85).band, 'overweight')    // BMI 26.8
  assert.equal(at(100).band, 'obese1')       // BMI 31.6
  assert.equal(at(115).band, 'obese2')       // BMI 36.3
  assert.equal(at(130).band, 'obese3')       // BMI 41.0
})

test('bmiInfo band edges follow WHO cutoffs exactly', () => {
  // Pick weights that hit the cutoffs dead-on for a 2.00 m frame (BMI = kg/4).
  // BMI is rounded to one decimal before banding, so 73.6 kg → 18.4.
  const at = (weightKg) => bmiInfo({ ...base, heightCm: 200, weightKg })
  assert.equal(at(73.6).band, 'underweight') // 18.4
  assert.equal(at(74).band, 'healthy')       // exactly 18.5 → healthy
  assert.equal(at(100).band, 'overweight')   // exactly 25 → overweight
  assert.equal(at(120).band, 'obese1')       // exactly 30
})

test('bmiInfo names the healthy weight range for the height', () => {
  const info = bmiInfo(base) // 178 cm
  assert.equal(info.healthyKgMin, Math.round(18.5 * 1.78 * 1.78))
  assert.equal(info.healthyKgMax, Math.round(24.9 * 1.78 * 1.78))
  assert.ok(info.healthyKgMin < info.healthyKgMax)
})

// -------------------------------------------------------- muscle tiers

test('muscleTiers splits every exercise into 1st/2nd/3rd groups', () => {
  for (const exercise of EXERCISES) {
    const tiers = muscleTiers(exercise)
    assert.ok(tiers.primary.length >= 1, `${exercise.id} has no primary muscle`)
    const total = tiers.primary.length + tiers.secondary.length + tiers.tertiary.length
    assert.equal(total, Object.keys(exercise.muscles).length, `${exercise.id} tier split lost a muscle`)
  }
  const bench = EXERCISES.find((e) => e.id === 'bench')
  const tiers = muscleTiers(bench)
  assert.deepEqual(tiers.primary, ['chest'])
  assert.ok(tiers.secondary.includes('triceps'))
})

// ------------------------------------------------- forced onboarding API

function makeCtx() {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-onboard-test-'))
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

test('a fresh signup starts un-onboarded and flips once details are saved', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/signup', { method: 'POST', body: { passcode: 'newbie-pass', name: 'Newbie' } })).json()

  const before = await (await call(ctx, '/profile', { token })).json()
  assert.equal(before.profile.onboarded, false, 'new accounts must be forced through onboarding')
  assert.ok(before.bmi && typeof before.bmi.bmi === 'number', 'profile ships BMI info')
  assert.equal(before.bmiBands.length, BMI_BANDS.length, 'profile ships the WHO bands for the chart')

  await call(ctx, '/profile', {
    method: 'PUT', token,
    body: { sex: 'female', age: 34, heightCm: 165, weightKg: 62, baseline: 'light', goal: 'maintain', onboarded: true },
  })

  const after = await (await call(ctx, '/profile', { token })).json()
  assert.equal(after.profile.onboarded, true)
  assert.equal(after.profile.sex, 'female')
  assert.equal(after.bmi.band, 'healthy') // 62 kg at 165 cm → BMI 22.8

  // A later save that never mentions onboarded must not lock her out again.
  await call(ctx, '/profile', { method: 'PUT', token, body: { weightKg: 63 } })
  const later = await (await call(ctx, '/profile', { token })).json()
  assert.equal(later.profile.onboarded, true, 'onboarded flag survives ordinary saves')
})

test('the exercise menu labels muscles by tier, cardio included', async () => {
  const ctx = makeCtx()
  const { token } = await (await call(ctx, '/login', { method: 'POST', body: { passcode: 'boss-code' } })).json()
  const menu = await (await call(ctx, '/exercises', { token })).json()

  assert.ok(menu.exercises.every((e) => e.tiers && e.tiers.primary.length >= 1))
  const rower = menu.cardio.find((c) => c.id === 'rowing_machine')
  assert.ok(rower.tiers, 'cardio machines carry tiers too')
  assert.ok(rower.tiers.secondary.includes('lats'))
})
