/**
 * Free-text parsing for meal and workout entries.
 *
 * The whole point of this app is that logging takes ten seconds on a phone, so
 * the input is a single text box. "2 eggs, 3 rashers bacon and a black coffee"
 * has to come out the other side as structured, weighed food items.
 */

import { ALIAS_INDEX, FOODS_BY_ID, unitsFor } from './data/foods.js'
import { ACTIVITY_ALIAS_INDEX, ACTIVITIES_BY_ID, metForSpeed } from './data/activities.js'
import { EXERCISE_ALIAS_INDEX } from './data/exercises.js'

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

/**
 * Standard container volumes in ml, for drinks only.
 *
 * Without this every container word resolves to the food's own default
 * serving, so "a can of Punk IPA" would be measured as a 568 ml pint - 70%
 * more than the 330 ml actually drunk. A bottle is deliberately absent here
 * because it is the one container whose size depends on the drink: 750 ml of
 * wine, 330 ml of beer. That is resolved from the food's own tags below.
 */
const CONTAINER_ML = {
  pint: 568, pints: 568,
  halfpint: 284, half: 284,
  can: 330, cans: 330, tin: 330, tins: 330,
  schooner: 425,
  bottle: null, bottles: null, // food-dependent
}

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
 * @param {Array} [extras] user's own pantry foods, shaped like static foods.
 *   They are checked first and win ties, because "protein bar" should mean
 *   THEIR protein bar once they have scanned one.
 * @returns {{food: import('./data/foods.js').Food, score: number} | null}
 */
export function matchFood(phrase, extras) {
  const cleaned = normalise(phrase)
  if (!cleaned) return null

  let best = null
  if (extras?.length) {
    for (const food of extras) {
      for (const term of new Set([food.name.toLowerCase(), ...(food.aliases || [])])) {
        const score = scoreMatch(cleaned, term)
        if (score > 0 && (!best || score > best.score)) best = { food, score }
      }
    }
    if (best && best.score === 1) return best
  }
  for (const { term, food } of ALIAS_INDEX) {
    const score = scoreMatch(cleaned, term)
    // Strictly greater: on a tie the pantry item already in `best` stays.
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
export function parseFoodPhrase(phrase, extras) {
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

  // Quantities do not have to lead: "white bread 2 slices", "toast two
  // slices". Look anywhere for a count followed by a known unit word.
  if (quantity === null && explicitGrams === null) {
    const anywhere = /\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter|couple|few)\s+(?:of\s+)?([a-z]+)\b/g
    let candidate
    while ((candidate = anywhere.exec(working))) {
      const word = candidate[2]
      if (PORTION_UNITS.has(word) || word in FIXED_UNIT_GRAMS) {
        quantity = /^\d/.test(candidate[1]) ? parseFloat(candidate[1]) : NUMBER_WORDS[candidate[1]] ?? 1
        unit = word
        working = working.replace(candidate[0], ' ')
        break
      }
    }
  }

  // Multiplier notation: "chicken burger x2", "flat white x 3".
  if (quantity === null && explicitGrams === null) {
    const times = working.match(/(?:^|\s)x\s*(\d+(?:\.\d+)?)\b/)
    if (times) {
      quantity = parseFloat(times[1])
      working = working.replace(times[0], ' ')
    }
  }

  // A trailing bare number reads as a count: "white bread 2", "eggs 3".
  // Capped at 20 so dish names with numbers in them ("chicken 65") cannot
  // silently become twenty portions of something - and skipped entirely when
  // the number is part of the drink's own name, or "guinness 0.0" would log
  // as zero pints of Guinness.
  if (quantity === null && explicitGrams === null) {
    const trailing = working.match(/\s(\d+(?:\.\d+)?)\s*$/)
    const value = trailing ? parseFloat(trailing[1]) : null
    if (trailing && value > 0 && value <= 20 && !namesTheNumber(working, trailing[1])) {
      quantity = value
      working = working.replace(trailing[0], ' ')
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

  // Or leading without "of" — but only when the phrase as a whole is NOT
  // already a food ("fillet steak" is a steak, not a fillet of steak).
  if (quantity === null && explicitGrams === null && !matchFood(working, extras)) {
    const lead = working.match(/^\s*([a-z]+)\s+(.+)$/)
    if (lead && (PORTION_UNITS.has(lead[1]) || lead[1] in FIXED_UNIT_GRAMS) && matchFood(lead[2], extras)) {
      quantity = 1
      unit = lead[1]
      working = lead[2]
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
  let match = matchFood(working, extras)
  if (!match && unit) match = matchFood(`${unit} ${working}`, extras)

  if (!match) {
    return {
      raw,
      foodId: null,
      name: raw,
      grams: explicitGrams ?? 0,
      kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0, freeSugar: 0,
      tags: [],
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
    const containerMl = containerVolume(unit, food)
    if (unit && unit in FIXED_UNIT_GRAMS) grams = count * FIXED_UNIT_GRAMS[unit]
    else if (containerMl) grams = count * containerMl
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
    // Only the added/juice share counts against the NHS free-sugars guide;
    // the fruit and milk sugars in `sugar` are not what the advice is about.
    freeSugar: round((food.per100.freeSugar ?? food.per100.sugar) * scale),
    // UK alcohol units, so the week can be measured against the 14-unit
    // guideline rather than only against calories.
    units: unitsFor(food.id, grams),
    // Carried here rather than bolted on by the API layer, so anything that
    // parses a meal - including tests and the engine - can reason about
    // alcohol and food quality without a second lookup.
    tags: food.tags,
    recognised: true,
    confidence: round(score, 2),
  }
}

/**
 * True when the trailing number belongs to the food's own name rather than
 * being a count - "Guinness 0.0", "Punk AF 0.5". Checked against the matched
 * food's aliases so it stays data-driven.
 */
function namesTheNumber(phrase, digits) {
  const match = matchFood(phrase)
  if (!match) return false
  const terms = [match.food.name.toLowerCase(), ...match.food.aliases]
  return terms.some((term) => term.includes(digits))
}

/**
 * The real volume of a named container, for drinks. Returns null when the
 * word is not a container, the food is not a drink, or the food's own
 * serving is already the right answer.
 */
function containerVolume(unit, food) {
  if (!unit || !food.tags.includes('drink')) return null
  if (!(unit in CONTAINER_ML)) return null
  const ml = CONTAINER_ML[unit]
  if (ml) return ml
  // "bottle": 750 ml of wine, 330 ml of anything else.
  return food.tags.includes('wine') ? 750 : 330
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
export function parseMeal(text, extras) {
  return splitItems(text)
    .map((phrase) => parseFoodPhrase(phrase, extras))
    .filter((item) => item.raw.length > 0)
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
      sugar: round(item.sugar * factor), freeSugar: round((item.freeSugar || 0) * factor) }
  }
  const scale = grams / 100
  return {
    ...item,
    grams: round(grams, 0),
    portion: describePortion(grams, food),
    units: unitsFor(food.id, grams),
    kcal: round(food.per100.kcal * scale, 0),
    protein: round(food.per100.protein * scale),
    carbs: round(food.per100.carbs * scale),
    fat: round(food.per100.fat * scale),
    fibre: round(food.per100.fibre * scale),
    sugar: round(food.per100.sugar * scale),
    freeSugar: round((food.per100.freeSugar ?? food.per100.sugar) * scale),
  }
}

// ----------------------------------------------------------- workout parsing

const INTENSITY_WORDS = {
  easy: 0.85, gentle: 0.85, light: 0.85, steady: 1, moderate: 1,
  hard: 1.15, intense: 1.15, vigorous: 1.15, brutal: 1.25, allout: 1.25,
}

/**
 * Where the session happened and in what weather, when the log says so.
 *
 * The heat adjustment normally keys off the profile's climate, which is a
 * blunt instrument: a Dubai resident on a treadmill is not thermoregulating,
 * and the same resident out at 6am in January is not either. Saying "outside
 * warm" or "outside cool" overrides the assumption for that one entry, and
 * "treadmill"/"indoor" says the weather is irrelevant.
 *
 * @returns {{conditions: 'warm'|'cool'|null, outdoor: boolean|null, matched: string}|null}
 */
function extractConditions(text) {
  const outsideWarm = text.match(/\b(?:outside|outdoors?|out)\s+(?:in\s+the\s+)?(?:warm|heat|hot|sun|humid)\b/)
  if (outsideWarm) return { conditions: 'warm', outdoor: true, matched: outsideWarm[0] }
  const outsideCool = text.match(/\b(?:outside|outdoors?|out)\s+(?:in\s+the\s+)?(?:cool|cold|cooler|shade|evening|early)\b/)
  if (outsideCool) return { conditions: 'cool', outdoor: true, matched: outsideCool[0] }
  const indoor = text.match(/\b(?:indoors?|inside|air conditioned|aircon|gym floor)\b/)
  if (indoor) return { conditions: 'cool', outdoor: false, matched: indoor[0] }
  const outside = text.match(/\b(?:outside|outdoors)\b/)
  if (outside) return { conditions: null, outdoor: true, matched: outside[0] }
  return null
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

/**
 * Set/rep notation: "3x8", "3 × 8", "5 sets of 5", "4 sets x 10 reps".
 * Reps capped at 100 so interval notation like "5x400m" never reads as a lift.
 */
function extractSetsReps(text) {
  const x = text.match(/\b(\d{1,2})\s*(?:x|×)\s*(\d{1,3})\b/)
  if (x && Number(x[2]) <= 100) {
    return { sets: Number(x[1]), reps: Number(x[2]), matched: x[0] }
  }
  const worded = text.match(/\b(\d{1,2})\s*sets?\s*(?:of|x|×)?\s*(\d{1,3})\s*(?:reps?)?\b/)
  if (worded && Number(worded[2]) <= 100) {
    return { sets: Number(worded[1]), reps: Number(worded[2]), matched: worded[0] }
  }
  return null
}

/**
 * The load on the bar: "80kg", "@ 80", "at 140", "185 lbs".
 * The "at" alternative needs its own word boundary, or it eats the trailing
 * "at" of "squat" and leaves "squ" behind for the exercise matcher.
 */
function extractLoad(text) {
  const kg = text.match(/(?:@\s*|\bat\s+)?(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/)
  if (kg) return { kg: parseFloat(kg[1]), matched: kg[0] }
  const lb = text.match(/(?:@\s*|\bat\s+)?(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/)
  if (lb) return { kg: Math.round(parseFloat(lb[1]) * 0.4536 * 10) / 10, matched: lb[0] }
  const bare = text.match(/(?:@|\bat)\s+(\d+(?:\.\d+)?)\b/)
  if (bare) return { kg: parseFloat(bare[1]), matched: bare[0] }
  return null
}

function matchExercise(phrase) {
  let best = null
  for (const { term, exercise } of EXERCISE_ALIAS_INDEX) {
    const score = scoreMatch(phrase, term)
    if (score > 0 && (!best || score > best.score)) {
      best = { exercise, score }
      if (score === 1) break
    }
  }
  return best && best.score >= 0.5 ? best : null
}

/**
 * Roughly three minutes per working set including rest — the standard
 * assumption for hypertrophy-range training. Energy is time x MET; the tonnage
 * (sets x reps x load) is tracked because progressive overload, not calories,
 * is what strength work is for. Each exercise carries its own compendium MET
 * class (see data/exercises.js) — heavy barbell compounds cost more per
 * minute than curls; LIFTING_MET is only the fallback for unrecognised lifts.
 */
const MINUTES_PER_SET = 3
const LIFTING_MET = 5.0

/**
 * A lift with structure: "bench 3x8 80kg" -> the exercise, its volume, and an
 * estimated time cost. Returns null when the phrase is not set/rep shaped.
 * @returns {import('./parse.js').ParsedWorkoutItem | null}
 */
function parseStrengthPhrase(raw, working) {
  const setsReps = extractSetsReps(working)
  let remainder = setsReps ? working.replace(setsReps.matched, ' ') : working
  const load = extractLoad(remainder)
  if (load) remainder = remainder.replace(load.matched, ' ')

  const matched = matchExercise(remainder)
  // Without set/rep notation this is not a structured lift — let the ordinary
  // activity path handle "30 min weights". But a bare known lift name with a
  // load ("deadlifts at 140") still counts.
  if (!setsReps && !(matched && load)) return null
  if (!matched && !setsReps) return null

  const sets = setsReps?.sets ?? 3
  const reps = setsReps?.reps ?? null
  const minutes = Math.max(MINUTES_PER_SET, sets * MINUTES_PER_SET)
  const volume = load && reps ? Math.round(sets * reps * load.kg) : null

  const name = matched ? matched.exercise.name : 'Weights'
  const detail = [
    setsReps ? `${sets}×${reps}` : null,
    load ? `@ ${load.kg} kg` : null,
  ].filter(Boolean).join(' ')

  return {
    raw,
    activityId: matched ? `ex_${matched.exercise.id}` : 'weights_light',
    name: detail ? `${name} ${detail}` : name,
    minutes,
    distanceKm: null,
    met: matched?.exercise.met ?? LIFTING_MET,
    tags: ['strength'],
    recognised: true,
    exercise: {
      id: matched?.exercise.id ?? null,
      name,
      group: matched?.exercise.group ?? 'full',
      sets,
      reps,
      weightKg: load?.kg ?? null,
      volume,
    },
  }
}

/**
 * Outdoor cardio matters in a hot climate: the engine applies a heat
 * adjustment to it. Anything on a machine or explicitly indoors is exempt.
 */
const OUTDOOR_IDS = new Set([
  'walk_slow', 'walk_moderate', 'walk_brisk', 'walk_very_brisk', 'hiking',
  'jog', 'run_5mph', 'run_6mph', 'run_7mph', 'run_8mph', 'run_9mph', 'run_10mph',
  'trail_run', 'parkrun', 'marathon',
  'cycle_leisure', 'cycle_light', 'cycle_moderate', 'cycle_vigorous', 'cycle_racing', 'mtb',
  'golf', 'football', 'football_comp',
])

function isOutdoor(activityId, raw) {
  if (!OUTDOOR_IDS.has(activityId)) return false
  return !/treadmill|indoor|inside|gym|machine/.test(raw)
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

  // Set/rep notation means a structured lift, which the generic activity
  // matcher would either miss entirely or flatten into "weights, 45 min".
  const lift = parseStrengthPhrase(raw, working)
  if (lift) return lift

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
      // Steps are assumed outdoor unless said otherwise - that is what a step
      // count usually is, and in a hot climate the difference matters.
      outdoor: !/treadmill|indoor|inside|mall/.test(working),
      recognised: true,
    }
  }

  const conditions = extractConditions(working)
  if (conditions) working = working.replace(conditions.matched, ' ')

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

  // Uphill walking is priced by gradient, not pace: recomputing it from
  // speed would quietly downgrade a brutal incline session to a stroll.
  const gradeDriven = activity.id.startsWith('walk_uphill')

  if (distance && minutes && mode && !gradeDriven) {
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
    // An explicit "outside warm" / "indoor" in the log beats the guess.
    outdoor: conditions?.outdoor ?? isOutdoor(activity.id, raw),
    conditions: conditions?.conditions ?? null,
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

// ------------------------------------------------------- fuzzy suggestions

/**
 * Small-edit distance, capped: we only care whether two words are within a
 * couple of typos of each other, so bail out early on length gaps.
 */
function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  const prev = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0]
    prev[0] = i
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost)
      diag = prev[j]
      prev[j] = next
      if (next < rowMin) rowMin = next
    }
    if (rowMin > cap) return cap + 1
  }
  return prev[b.length]
}

/** How alike two single words are, 0..1, tolerant of a typo or two. */
function wordSimilarity(a, b) {
  if (a === b) return 1
  if (a.startsWith(b) || b.startsWith(a)) return 0.85
  const distance = editDistance(a, b)
  const longest = Math.max(a.length, b.length)
  if (distance > Math.min(3, Math.floor(longest / 3) + 1)) return 0
  return 1 - distance / longest
}

/**
 * Fuzzy score between a typed phrase and a candidate term: the average, over
 * the term's words, of the best-matching typed word. "chiken brest" scores
 * high against "chicken breast"; "shwarma" against "shawarma".
 */
function fuzzyScore(phraseTokens, term) {
  const termTokens = term.split(/\s+/).filter((w) => w.length > 1)
  if (!termTokens.length) return 0
  let total = 0
  for (const termWord of termTokens) {
    let best = 0
    for (const typed of phraseTokens) {
      const similarity = wordSimilarity(typed, termWord)
      if (similarity > best) best = similarity
    }
    total += best
  }
  return total / termTokens.length
}

function suggestFrom(indexEntries, phrase, limit, getId, getName) {
  const tokens = tokenise(phrase).filter((w) => w.length > 2 && !/^\d/.test(w))
  if (!tokens.length) return []

  const best = new Map() // id -> {score, name}
  for (const entry of indexEntries) {
    const score = fuzzyScore(tokens, entry.term)
    if (score < 0.62) continue
    const id = getId(entry)
    const existing = best.get(id)
    if (!existing || score > existing.score) best.set(id, { score, name: getName(entry) })
  }
  return [...best.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id, { name }]) => ({ id, name }))
}

/** Closest foods to an unrecognised phrase — the "did you mean" list. */
export function suggestFoods(phrase, limit = 3, extras) {
  const index = extras?.length
    ? [
        ...extras.flatMap((food) =>
          [food.name.toLowerCase(), ...(food.aliases || [])].map((term) => ({ term, food }))),
        ...ALIAS_INDEX,
      ]
    : ALIAS_INDEX
  return suggestFrom(index, phrase, limit, (e) => e.food.id, (e) => e.food.name)
}

/** Closest activities and lifts to an unrecognised workout phrase. */
export function suggestWorkouts(phrase, limit = 3) {
  const activities = suggestFrom(ACTIVITY_ALIAS_INDEX, phrase, limit, (e) => e.activity.id, (e) => e.activity.name)
  const lifts = suggestFrom(EXERCISE_ALIAS_INDEX, phrase, limit, (e) => e.exercise.id, (e) => e.exercise.name)
  const merged = [...lifts, ...activities]
  const seen = new Set()
  return merged.filter((s) => !seen.has(s.name) && seen.add(s.name)).slice(0, limit)
}

export { normalise, splitItems, round }
