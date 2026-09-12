/**
 * Check-ins: the weekly sit-down with the coach, in data form.
 *
 * A check-in is deliberately more than a weigh-in. Weight alone cannot tell
 * you whether the last month went well — it moves with water, food volume and
 * training load, and it says nothing about what the weight is made of. A tape
 * measure around the waist says considerably more, and how you actually feel
 * says something neither number can.
 *
 * Measurements matter here for a specific reason: waist-to-height ratio is the
 * one body-composition signal this app can genuinely collect. NICE NG246
 * (January 2025) recommends recording it alongside BMI precisely because BMI
 * "may be a less accurate measure of central adiposity" in people with high
 * muscle mass — which is the entire complaint against BMI. Keep your waist
 * under half your height and the ratio stays under 0.5.
 */

/** Everything a tape measure can tell us, in centimetres. */
export const MEASUREMENT_FIELDS = [
  { id: 'waist', label: 'Waist', hint: 'Around the navel, relaxed — the one that matters most', min: 40, max: 200 },
  { id: 'chest', label: 'Chest', hint: 'Around the widest point', min: 50, max: 200 },
  { id: 'hips', label: 'Hips', hint: 'Around the widest point', min: 50, max: 200 },
  { id: 'thigh', label: 'Thigh', hint: 'Mid-thigh, one side', min: 25, max: 110 },
  { id: 'arm', label: 'Arm', hint: 'Upper arm, relaxed', min: 15, max: 80 },
  { id: 'neck', label: 'Neck', hint: 'Below the Adam’s apple', min: 20, max: 70 },
]

const MEASUREMENT_BY_ID = new Map(MEASUREMENT_FIELDS.map((f) => [f.id, f]))

/** The 1–5 scales. Words, not numbers, because nobody feels like "a 3". */
export const SCALES = {
  feeling: ['Rough', 'Flat', 'Fine', 'Good', 'Flying'],
  energy: ['Empty', 'Low', 'Steady', 'Strong', 'Buzzing'],
  sleep: ['Terrible', 'Poor', 'OK', 'Good', 'Excellent'],
}

/**
 * NICE NG246 central-adiposity bands. Unlike BMI, this one is explicitly
 * endorsed for people with high muscle mass — which is the whole point of
 * showing it.
 */
export const WHTR_BANDS = [
  { id: 'healthy', label: 'Healthy', max: 0.5, note: 'Waist under half your height.' },
  { id: 'increased', label: 'Increased', max: 0.6, note: 'Above half your height — worth bringing down.' },
  { id: 'high', label: 'High', max: Infinity, note: 'Well above half your height.' },
]

/**
 * Waist-to-height ratio and what NICE says about it.
 * @param {number} waistCm
 * @param {number} heightCm
 * @param {number} [bmi] used only to flag where the ratio stops adding much
 */
export function waistToHeight(waistCm, heightCm, bmi = null) {
  if (!waistCm || !heightCm) return null
  const ratio = Math.round((waistCm / heightCm) * 100) / 100
  const band = WHTR_BANDS.find((b) => ratio < b.max) || WHTR_BANDS[WHTR_BANDS.length - 1]
  return {
    ratio,
    band: band.id,
    label: band.label,
    note: band.note,
    // NICE: above BMI 35 nearly everyone has a high ratio, so it stops
    // discriminating. Saying so is more honest than quietly showing it anyway.
    lowValue: typeof bmi === 'number' && bmi >= 35,
    targetWaistCm: Math.round(heightCm * 0.5),
  }
}

const clamp = (value, min, max) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return Math.round(n * 10) / 10
}

const scale = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/**
 * Normalise whatever the form sent into a storable check-in. Everything is
 * optional: a check-in with nothing but "knee still sore" in the notes is a
 * legitimate check-in.
 */
export function sanitiseCheckin(input = {}) {
  const measurements = {}
  for (const [id, raw] of Object.entries(input.measurements || {})) {
    const field = MEASUREMENT_BY_ID.get(id)
    if (!field) continue
    const value = clamp(raw, field.min, field.max)
    if (value !== null) measurements[id] = value
  }
  return {
    weightKg: clamp(input.weightKg, 30, 400),
    measurements,
    feeling: scale(input.feeling),
    energy: scale(input.energy),
    sleep: scale(input.sleep),
    training: String(input.training || '').trim().slice(0, 600),
    notes: String(input.notes || '').trim().slice(0, 1200),
  }
}

/** True when a check-in carries nothing worth storing. */
export function isEmptyCheckin(checkin) {
  return checkin.weightKg === null
    && Object.keys(checkin.measurements).length === 0
    && checkin.feeling === null && checkin.energy === null && checkin.sleep === null
    && !checkin.training && !checkin.notes
}

/**
 * What changed between two check-ins. Direction is reported, never judged —
 * whether a smaller waist is good depends on what the person is training for,
 * and the app does not get to decide that for them.
 */
export function checkinDelta(current, previous) {
  if (!current || !previous) return null
  const delta = { measurements: {} }
  if (current.weightKg !== null && previous.weightKg !== null) {
    delta.weightKg = Math.round((current.weightKg - previous.weightKg) * 10) / 10
  }
  for (const field of MEASUREMENT_FIELDS) {
    const a = current.measurements?.[field.id]
    const b = previous.measurements?.[field.id]
    if (typeof a === 'number' && typeof b === 'number') {
      delta.measurements[field.id] = Math.round((a - b) * 10) / 10
    }
  }
  delta.days = daysBetween(previous.date, current.date)
  return delta
}

function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`)
  const b = new Date(`${toIso}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
