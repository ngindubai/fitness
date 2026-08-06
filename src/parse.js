/**
 * Free-text parsing for meal and workout entries.
 *
 * The whole point of this app is that logging takes ten seconds on a phone, so
 * the input is a single text box. "2 eggs, 3 rashers bacon and a black coffee"
 * has to come out the other side as structured, weighed food items.
 */

import { ALIAS_INDEX, FOODS_BY_ID } from './data/foods.js'
import { ACTIVITY_ALIAS_INDEX, ACTIVITIES_BY_ID, metForSpeed } from './data/activities.js'

// ---------------------------------------------------------------- utilities

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a_half: 0.5, half: 0.5,
  quarter: 0.25, couple: 2, few: 3,
}

/** Count-style units resolve to the food's own natural portion weight. */
const PORTION_UNITS = new Set([
  'slice', 'slices', 'piece', 'pieces', 'portion', 'portions', 'serving', 'servings',
  'packet', 'packets', 'pack', 'packs', 'bar', 'bars', 'rasher', 'rashers',
  'fillet', 'fillets', 'breast', 'breasts', 'thigh', 'thighs', 'wing', 'wings',
  'egg', 'eggs', 'square', 'squares', 'scoop', 'scoops', 'biscuit', 'biscuits',
  'tin', 'tins', 'can', 'cans', 'bottle', 'bottles', 'pint', 'pints', 'glass',
  'glasses', 'cup', 'cups', 'mug', 'mugs', 'bowl', 'bowls', 'plate', 'plates',
  'wrap', 'wraps', 'roll', 'rolls', 'pie', 'pies', 'sausage', 'sausages',
  'chop', 'chops', 'steak', 'steaks', 'banana', 'apple', 'orange', 'pear',
  'potato', 'potatoes', 'avocado', 'bagel', 'croissant', 'muffin', 'doughnut',
  'burger', 'burgers', 'kebab', 'pot', 'pots', 'date', 'dates', 'single',
  'doubles', 'double', 'sandwich', 'sandwiches', 'ball', 'pitta', 'naan',
])

/** Units with a fixed weight regardless of which food they measure. */
const FIXED_UNIT_GRAMS = {
  tbsp: 15, tablespoon: 15, tablespoons: 15, tbsps: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5, tsps: 5,
  handful: 30, handfuls: 30,
  pinch: 1, pinches: 1,
}

const SIZE_MODIFIERS = {
  large: 1.35, big: 1.35, huge: 1.7, massive: 1.7, xl: 1.5, jumbo: 1.5,
  small: 0.7, little: 0.7, mini: 0.5, tiny: 0.5, medium: 1, regular: 1, standard: 1,
}

/**
 * Filler words dropped before matching. Cooking methods are deliberately NOT
 * in here: "baked potato" and "boiled potato" are different foods, and
 * stripping the method collapses both to "potato" and picks a winner at random.
 */
const NOISE_WORDS = new Set([
  'of', 'with', 'and', 'the', 'some', 'my', 'a', 'an', 'in', 'for', 'at',
  'ate', 'had', 'eaten', 'drank', 'plus', 'served',
])

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    // Colons survive so that "1:15" is still readable as a duration.
    .replace(/[^a-z0-9.,+&/:\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a free-text entry into individual item phrases. */
function splitItems(text) {
  return normalise(text)
    .split(/,| \+ |\band\b|\bwith\b|;|\n|\//)
    .map((s) => s.trim())
    .filter(Boolean)
}

function round(value, dp = 1) {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

// -------------------------------------------------------------- food matching

function tokenise(text) {
  return normalise(text)
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
}

/**
 * Score how well a candidate term describes the phrase. Exact and whole-word
 * containment beat partial token overlap, which keeps "chicken" from matching
 * "chicken tikka masala" when the user plainly just wrote "chicken".
 */
function scoreMatch(phrase, term) {
  if (phrase === term) return 1
  const phraseTokens = tokenise(phrase)
  const termTokens = tokenise(term)
  if (!phraseTokens.length || !termTokens.length) return 0

  const phraseSet = new Set(phraseTokens)
  const matched = termTokens.filter((t) => phraseSet.has(t)).length
  if (matched === 0) return 0

  // Every word of the term appears in the phrase - a strong signal.
  const coverage = matched / termTokens.length
  const precision = matched / phraseTokens.length
  const score = 0.7 * coverage + 0.3 * precision

  // A term that is a contiguous substring of the phrase is more trustworthy
  // than a bag-of-words overlap.
  const contiguous = ` ${phrase} `.includes(` ${term} `)
  return contiguous ? Math.min(1, score + 0.25) : score
}

/**
 * @param {string} phrase
 * @returns {{food: import('./data/foods.js').Food, score: number} | null}
 */
export function matchFood(phrase) {
  const cleaned = normalise(phrase)
  if (!cleaned) return null

  let best = null
  for (const { term, food } of ALIAS_INDEX) {
    const score = scoreMatch(cleaned, term)
    if (score > 0 && (!best || score > best.score)) {
      best = { food, score }
      if (score === 1) break
    }
  }
  return best && best.score >= 0.5 ? best : null
}

// --------------------------------------------------------------- food parsing

/**
 * @typedef {object} ParsedFoodItem
 * @property {string} raw            original phrase as typed
 * @property {string|null} foodId
 * @property {string} name
 * @property {number} grams
 * @property {number} kcal
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 * @property {number} fibre
 * @property {number} sugar
 * @property {boolean} recognised    false when we could not identify the food
 * @property {number} confidence
 */

/**
 * Turn one phrase ("2 slices of wholemeal toast") into a weighed food item.
 * @returns {ParsedFoodItem}
 */
export function parseFoodPhrase(phrase) {
  const raw = String(phrase).trim()
  let working = normalise(raw)

  let quantity = null
  let unit = null
  let explicitGrams = null
  let sizeFactor = 1

  // Explicit mass or volume always wins: "200g chicken", "0.5 kg mince".
  const massMatch = working.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gram|grams|gm|ml|l|litre|litres|oz|ounce|ounces|lb|lbs)\b/)
  if (massMatch) {
    const value = parseFloat(massMatch[1])
    const u = massMatch[2]
    if (u === 'kg' || u === 'kgs') explicitGrams = value * 1000
    else if (u === 'l' || u === 'litre' || u === 'litres') explicitGrams = value * 1000
    else if (u === 'oz' || u === 'ounce' || u === 'ounces') explicitGrams = value * 28.35
    else if (u === 'lb' || u === 'lbs') explicitGrams = value * 453.6
    else explicitGrams = value // g and ml both treated as ~1 g/ml
    working = working.replace(massMatch[0], ' ')
  }

  // Leading count, optionally with a unit: "3 rashers", "a couple of eggs".
  if (explicitGrams === null) {
    const countMatch = working.match(
      /^\s*(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter|couple|few)\s+(?:of\s+)?([a-z]+)?/
    )
    if (countMatch) {
      const rawQty = countMatch[1]
      quantity = /^\d/.test(rawQty) ? parseFloat(rawQty) : NUMBER_WORDS[rawQty] ?? 1
      const maybeUnit = countMatch[2]
      if (maybeUnit && (PORTION_UNITS.has(maybeUnit) || maybeUnit in FIXED_UNIT_GRAMS)) {
        unit = maybeUnit
        working = working.replace(countMatch[0], ' ')
      } else {
        // The word after the number is part of the food name, keep it.
        working = working.replace(new RegExp(`^\\s*${rawQty}\\s+(?:of\\s+)?`), ' ')
      }
    }
  }

  // A bare unit with no number still implies one portion: "slice of toast".
  if (quantity === null && explicitGrams === null) {
    const bareUnit = working.match(/^\s*([a-z]+)\s+of\s+/)
    if (bareUnit && (PORTION_UNITS.has(bareUnit[1]) || bareUnit[1] in FIXED_UNIT_GRAMS)) {
      quantity = 1
      unit = bareUnit[1]
      working = working.replace(bareUnit[0], ' ')
    }
  }

  for (const [word, factor] of Object.entries(SIZE_MODIFIERS)) {
    const re = new RegExp(`\\b${word}\\b`)
    if (re.test(working)) {
      sizeFactor = factor
      working = working.replace(re, ' ')
      break
    }
  }

  // "2 eggs" consumes "eggs" as the unit and leaves nothing to match on, so
  // when the stripped phrase finds nothing, try again with the unit word — for
  // these foods the unit *is* the name.
  let match = matchFood(working)
  if (!match && unit) match = matchFood(`${unit} ${working}`)

  if (!match) {
    return {
      raw,
      foodId: null,
      name: raw,
      grams: explicitGrams ?? 0,
      kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0,
      recognised: false,
      confidence: 0,
    }
  }

  const { food, score } = match

  let grams
  if (explicitGrams !== null) {
    grams = explicitGrams
  } else {
    const count = quantity ?? 1
    if (unit && unit in FIXED_UNIT_GRAMS) grams = count * FIXED_UNIT_GRAMS[unit]
    else grams = count * food.unit.grams
  }
  grams = Math.max(0, grams * sizeFactor)

  const scale = grams / 100
  return {
    raw,
    foodId: food.id,
    name: food.name,
    grams: round(grams, 0),
    // Surfaced in the UI so the portion the app assumed is visible and
    // correctable: "150 g, about 1.4 slices" is checkable at a glance in a way
    // that a bare gram figure is not.
    portion: describePortion(grams, food),
    kcal: round(food.per100.kcal * scale, 0),
    protein: round(food.per100.protein * scale),
    carbs: round(food.per100.carbs * scale),
    fat: round(food.per100.fat * scale),
    fibre: round(food.per100.fibre * scale),
    sugar: round(food.per100.sugar * scale),
    recognised: true,
    confidence: round(score, 2),
  }
}

/** @returns {{count:number, unit:string}|null} */
function describePortion(grams, food) {
  if (!food?.unit?.grams) return null
  const count = round(grams / food.unit.grams, 1)
  return { count, unit: count === 1 ? food.unit.name : pluralise(food.unit.name) }
}

function pluralise(word) {
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

/**
 * Parse a whole meal entry.
 * @param {string} text
 * @returns {ParsedFoodItem[]}
 */
export function parseMeal(text) {
  return splitItems(text).map(parseFoodPhrase).filter((item) => item.raw.length > 0)
}

/** Recompute an item after the user edits its weight in the UI. */
export function reweighFoodItem(item, grams) {
  const food = item.foodId ? FOODS_BY_ID.get(item.foodId) : null
  if (!food) {
    // Unrecognised items carry a manually entered calorie figure; scale linearly.
    const factor = item.grams > 0 ? grams / item.grams : 0
    return { ...item, grams: round(grams, 0), kcal: round(item.kcal * factor, 0),
      protein: round(item.protein * factor), carbs: round(item.carbs * factor),
      fat: round(item.fat * factor), fibre: round(item.fibre * factor),
      sugar: round(item.sugar * factor) }
  }
  const scale = grams / 100
  return {
    ...item,
    grams: round(grams, 0),
    portion: describePortion(grams, food),
    kcal: round(food.per100.kcal * scale, 0),
    protein: round(food.per100.protein * scale),
    carbs: round(food.per100.carbs * scale),
    fat: round(food.per100.fat * scale),
    fibre: round(food.per100.fibre * scale),
    sugar: round(food.per100.sugar * scale),
  }
}

// ----------------------------------------------------------- workout parsing

const INTENSITY_WORDS = {
  easy: 0.85, gentle: 0.85, light: 0.85, steady: 1, moderate: 1,
  hard: 1.15, intense: 1.15, vigorous: 1.15, brutal: 1.25, allout: 1.25,
}

/** Pull a duration in minutes out of a phrase, handling "1h30", "1:15", "45 mins". */
function extractMinutes(text) {
  const hm = text.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)?\s*(?:m|min|mins|minutes)?/)
  if (hm) {
    const hours = parseInt(hm[1], 10)
    const mins = hm[2] ? parseInt(hm[2], 10) : 0
    return { minutes: hours * 60 + mins, matched: hm[0] }
  }
  const colon = text.match(/\b(\d{1,2}):(\d{2})\b/)
  if (colon) {
    return { minutes: parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10), matched: colon[0] }
  }
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)
  if (m) return { minutes: parseFloat(m[1]), matched: m[0] }
  return null
}

/** Pull a distance in kilometres out of a phrase. */
function extractDistanceKm(text) {
  const km = text.match(/(\d+(?:\.\d+)?)\s*(?:k|km|kms|kilometre|kilometres|kilometer|kilometers)\b/)
  if (km) return { km: parseFloat(km[1]), matched: km[0] }
  const mi = text.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/)
  if (mi) return { km: parseFloat(mi[1]) * 1.60934, matched: mi[0] }
  const metres = text.match(/(\d+(?:\.\d+)?)\s*(?:metres|meters)\b/)
  if (metres) return { km: parseFloat(metres[1]) / 1000, matched: metres[0] }
  return null
}

function extractSteps(text) {
  const m = text.match(/(\d[\d,]*)\s*steps\b/)
  if (!m) return null
  return { steps: parseInt(m[1].replace(/,/g, ''), 10), matched: m[0] }
}

function matchActivity(phrase) {
  const cleaned = normalise(phrase)
  let best = null
  for (const { term, activity } of ACTIVITY_ALIAS_INDEX) {
    const score = scoreMatch(cleaned, term)
    if (score > 0 && (!best || score > best.score)) {
      best = { activity, score }
      if (score === 1) break
    }
  }
  return best && best.score >= 0.5 ? best : null
}

/**
 * @typedef {object} ParsedWorkoutItem
 * @property {string} raw
 * @property {string|null} activityId
 * @property {string} name
 * @property {number} minutes
 * @property {number|null} distanceKm
 * @property {number} met
 * @property {string[]} tags
 * @property {boolean} recognised
 */

/**
 * Turn one phrase ("ran 5k in 25 mins") into a structured workout item.
 * @param {string} phrase
 * @param {number} weightKg used only by the caller for kcal; kept out of here
 * @returns {ParsedWorkoutItem}
 */
export function parseWorkoutPhrase(phrase, weightKg = 80) {
  const raw = String(phrase).trim()
  let working = normalise(raw)

  const steps = extractSteps(working)
  if (steps) {
    // Roughly 0.762 m per step, at an everyday walking cadence of ~100 spm.
    const km = (steps.steps * 0.762) / 1000
    const minutes = steps.steps / 100
    return {
      raw,
      activityId: 'walk_moderate',
      name: `Walking (${steps.steps.toLocaleString()} steps)`,
      minutes: round(minutes, 0),
      distanceKm: round(km),
      met: metForSpeed('walk', (km / (minutes / 60)) * 0.621371),
      tags: ['cardio', 'neat'],
      recognised: true,
    }
  }

  const duration = extractMinutes(working)
  if (duration) working = working.replace(duration.matched, ' ')
  const distance = extractDistanceKm(working)
  if (distance) working = working.replace(distance.matched, ' ')

  let intensity = 1
  for (const [word, factor] of Object.entries(INTENSITY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(working)) {
      intensity = factor
      break
    }
  }

  const match = matchActivity(working)
  if (!match) {
    return {
      raw,
      activityId: null,
      name: raw,
      minutes: duration?.minutes ?? 0,
      distanceKm: distance ? round(distance.km, 2) : null,
      met: 0,
      tags: [],
      recognised: false,
    }
  }

  const { activity } = match
  let minutes = duration?.minutes ?? null
  let met = activity.met * intensity

  // When both distance and time are known the pace tells us far more than a
  // generic MET value does, so recompute from actual speed.
  const mode = activity.tags.includes('cardio')
    ? activity.id.startsWith('run') || activity.id === 'jog' || activity.id === 'parkrun' ||
      activity.id === 'marathon' || activity.id === 'trail_run' || activity.id === 'treadmill'
      ? 'run'
      : activity.id.startsWith('cycle') || activity.id === 'mtb' || activity.id === 'stationary_bike'
        ? 'cycle'
        : activity.id.startsWith('walk') || activity.id === 'hiking'
          ? 'walk'
          : null
    : null

  if (distance && minutes && mode) {
    const mph = (distance.km * 0.621371) / (minutes / 60)
    met = metForSpeed(mode, mph)
  } else if (distance && !minutes && mode) {
    // Assume the activity's default MET pace and derive the time from it.
    const assumedMph = mode === 'run' ? 6.0 : mode === 'cycle' ? 12 : 3.2
    minutes = round((distance.km * 0.621371) / assumedMph * 60, 0)
  }

  if (!minutes) minutes = activity.defaultMinutes

  return {
    raw,
    activityId: activity.id,
    name: activity.name,
    minutes: round(minutes, 0),
    distanceKm: distance ? round(distance.km, 2) : null,
    met: round(met, 1),
    tags: activity.tags,
    recognised: true,
  }
}

/**
 * @param {string} text
 * @returns {ParsedWorkoutItem[]}
 */
export function parseWorkout(text) {
  return normalise(text)
    .split(/,|\band\b|;|\n|\bthen\b/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((phrase) => parseWorkoutPhrase(phrase))
}

/**
 * Energy cost of an activity. Uses the standard compendium relation and then
 * subtracts the resting energy the body would have burned anyway, because
 * counting that twice is the single most common way calorie maths flatters you.
 *
 * @param {{met:number, minutes:number}} item
 * @param {number} weightKg
 * @returns {number} net kcal
 */
export function activityKcal(item, weightKg) {
  const hours = item.minutes / 60
  const gross = item.met * weightKg * hours
  const resting = 1 * weightKg * hours
  return Math.max(0, Math.round(gross - resting))
}

export { normalise, splitItems, round }
