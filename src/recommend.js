/**
 * Meal recommendation.
 *
 * The brief was "recommend meals once you learn what I like and what I eat", so
 * this is deliberately history-driven rather than a generic meal plan. A
 * suggestion is only useful if it is (a) something you would actually eat and
 * (b) something that fits the calories you have left today. A meal that scores
 * well on nutrition but that you will never cook is worth nothing.
 */

import { FOODS_BY_ID } from './data/foods.js'
import { MEAL_TEMPLATES, SLOTS } from './data/meals.js'

/** Compute macros for a template from its component foods. */
export function mealMacros(template) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0 }
  const missing = []
  for (const { foodId, grams } of template.components) {
    const food = FOODS_BY_ID.get(foodId)
    if (!food) {
      missing.push(foodId)
      continue
    }
    const scale = grams / 100
    totals.kcal += food.per100.kcal * scale
    totals.protein += food.per100.protein * scale
    totals.carbs += food.per100.carbs * scale
    totals.fat += food.per100.fat * scale
    totals.fibre += food.per100.fibre * scale
    totals.sugar += food.per100.sugar * scale
  }
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key])
  return { ...totals, missing }
}

/** Pre-compute once; the templates never change at runtime. */
const TEMPLATE_MACROS = new Map(MEAL_TEMPLATES.map((t) => [t.id, mealMacros(t)]))

export function templateWithMacros(template) {
  return {
    ...template,
    macros: TEMPLATE_MACROS.get(template.id),
    ingredients: template.components.map(({ foodId, grams }) => ({
      foodId,
      grams,
      name: FOODS_BY_ID.get(foodId)?.name || foodId,
    })),
  }
}

/**
 * Build a taste profile from logged history.
 *
 * @param {Array<{date:string, slot:string, items:Array}>} meals oldest first
 */
export function buildTasteProfile(meals) {
  const foodCounts = new Map()
  const tagCounts = new Map()
  const slotFoods = new Map(SLOTS.map((s) => [s, new Map()]))
  const recentFoods = new Map() // foodId -> most recent date seen
  let totalItems = 0

  for (const meal of meals) {
    for (const item of meal.items || []) {
      if (!item.foodId) continue
      totalItems += 1
      foodCounts.set(item.foodId, (foodCounts.get(item.foodId) || 0) + 1)
      recentFoods.set(item.foodId, meal.date)

      const slotMap = slotFoods.get(meal.slot)
      if (slotMap) slotMap.set(item.foodId, (slotMap.get(item.foodId) || 0) + 1)

      const food = FOODS_BY_ID.get(item.foodId)
      for (const tag of food?.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
  }

  const favourites = [...foodCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([foodId, count]) => ({
      foodId,
      count,
      name: FOODS_BY_ID.get(foodId)?.name || foodId,
    }))

  return {
    foodCounts,
    tagCounts,
    slotFoods,
    recentFoods,
    favourites,
    totalItems,
    /** Below this, we do not pretend to know your tastes yet. */
    confident: totalItems >= 25,
  }
}

/**
 * The meals you actually eat, most recent first — the raw material for a
 * one-tap repeat.
 *
 * Suggested meals answer "what could I eat?". This answers "what do I
 * actually eat?", which on most days is a much shorter list and the reason
 * logging feels like a chore. Repeats carry the stored items rather than the
 * typed text, so a portion corrected by hand last Tuesday stays corrected.
 *
 * @param {Array} mealEntries stored entries of kind 'meal', any order
 * @param {{slot?: string|null, limit?: number, excludeDate?: string|null}} [opts]
 */
export function recentMeals(mealEntries, { slot = null, limit = 12, excludeDate = null } = {}) {
  const seen = new Map()

  const ordered = [...mealEntries].sort((a, b) => {
    const left = `${a.date}T${a.createdAt || ''}`
    const right = `${b.date}T${b.createdAt || ''}`
    return left < right ? 1 : left > right ? -1 : 0
  })

  for (const entry of ordered) {
    const items = (entry.items || []).filter((item) => item && item.recognised !== false)
    if (!items.length) continue
    if (slot && entry.slot && entry.slot !== slot) continue
    if (excludeDate && entry.date === excludeDate) continue

    // Two meals are "the same" when they are the same foods at the same
    // weights; the wording used to log them is irrelevant.
    const signature = items
      .map((item) => `${item.foodId || item.name}@${Math.round(item.grams || 0)}`)
      .sort()
      .join('|')
    if (!signature) continue

    const existing = seen.get(signature)
    if (existing) {
      existing.count += 1
      continue
    }
    seen.set(signature, {
      signature,
      slot: entry.slot || null,
      date: entry.date,
      count: 1,
      title: items.map((item) => item.name).join(', ').slice(0, 90),
      kcal: Math.round(items.reduce((sum, item) => sum + (item.kcal || 0), 0)),
      protein: Math.round(items.reduce((sum, item) => sum + (item.protein || 0), 0)),
      // planKey ties an item to a plan block; copying it forward would mark
      // that block "done" on a day the plan was never followed.
      items: items.map(({ planKey, ...rest }) => rest),
    })
  }

  return [...seen.values()].slice(0, limit)
}

/** How strongly the user's history endorses this template. */
function tasteScore(template, taste) {
  if (!taste.totalItems) return 0.5 // neutral prior until we know anything

  const maxFoodCount = Math.max(1, ...taste.foodCounts.values())
  const slotMap = taste.slotFoods.get(template.slot) || new Map()

  let componentScore = 0
  for (const { foodId } of template.components) {
    const general = (taste.foodCounts.get(foodId) || 0) / maxFoodCount
    // Eating eggs at breakfast should not recommend eggs for dinner as strongly.
    const inSlot = slotMap.has(foodId) ? 0.3 : 0
    componentScore += Math.min(1, general + inSlot)
  }
  componentScore /= Math.max(1, template.components.length)

  const maxTagCount = Math.max(1, ...taste.tagCounts.values())
  let tagScore = 0
  const templateFoodTags = new Set()
  for (const { foodId } of template.components) {
    for (const tag of FOODS_BY_ID.get(foodId)?.tags || []) templateFoodTags.add(tag)
  }
  for (const tag of templateFoodTags) {
    tagScore += (taste.tagCounts.get(tag) || 0) / maxTagCount
  }
  tagScore /= Math.max(1, templateFoodTags.size)

  return 0.7 * componentScore + 0.3 * tagScore
}

/**
 * How well the meal fits the calories and protein still available today.
 * A dinner suggestion when you have 400 kcal left is a different problem from
 * the same suggestion with 1,200 left.
 */
function fitScore(macros, remaining, slot) {
  if (!remaining || remaining.kcal == null) return 0.5

  // Rough share of the day's remaining energy that each slot should take.
  const share = slot === 'snack' ? 0.18 : slot === 'breakfast' ? 0.28 : 0.42
  const idealKcal = Math.max(150, remaining.kcal * share)

  const ratio = macros.kcal / idealKcal
  // Penalise overshoot harder than undershoot - going over is what costs you.
  const kcalFit = ratio <= 1 ? Math.max(0, ratio) : Math.max(0, 1 - (ratio - 1) * 1.6)

  // Protein density matters most when there is protein still owed.
  const proteinNeed = Math.max(0, remaining.protein || 0)
  const proteinPerKcal = macros.kcal ? macros.protein / (macros.kcal / 100) : 0
  const densityFit = Math.min(1, proteinPerKcal / 12)
  const proteinWeight = proteinNeed > 40 ? 0.5 : proteinNeed > 15 ? 0.3 : 0.15

  return (1 - proteinWeight) * kcalFit + proteinWeight * densityFit
}

/** Penalise anything eaten in the last few days so suggestions stay varied. */
function noveltyScore(template, recentMealIds, taste, todayIso) {
  let score = 1
  const recentIndex = recentMealIds.indexOf(template.id)
  if (recentIndex >= 0) score -= 0.6 - recentIndex * 0.1

  const today = Date.parse(todayIso)
  let staleComponents = 0
  for (const { foodId } of template.components) {
    const last = taste.recentFoods.get(foodId)
    if (!last) continue
    const daysAgo = (today - Date.parse(last)) / 86_400_000
    if (daysAgo <= 1) staleComponents += 1
  }
  score -= (staleComponents / Math.max(1, template.components.length)) * 0.3

  return Math.max(0, Math.min(1, score))
}

/**
 * Recommend meals.
 *
 * @param {object} args
 * @param {object} args.profile
 * @param {object} args.remaining      {kcal, protein} left for the day
 * @param {string} [args.slot]         restrict to one slot
 * @param {Array} args.history         past meals, oldest first
 * @param {string[]} [args.recentMealIds] template ids suggested/eaten lately
 * @param {string} args.today          ISO date
 * @param {number} [args.limit]
 * @param {number} [args.maxEffortMinutes]
 */
export function recommendMeals({
  profile,
  remaining,
  slot,
  history = [],
  recentMealIds = [],
  today,
  limit = 4,
  maxEffortMinutes = null,
}) {
  const taste = buildTasteProfile(history)
  const goal = profile?.goal || 'maintain'

  const candidates = MEAL_TEMPLATES.filter((t) => {
    if (slot && t.slot !== slot) return false
    if (maxEffortMinutes != null && t.effortMinutes > maxEffortMinutes) return false
    return true
  })

  const scored = candidates.map((template) => {
    const macros = TEMPLATE_MACROS.get(template.id)
    const taste_ = tasteScore(template, taste)
    const fit = fitScore(macros, remaining, template.slot)
    const novelty = noveltyScore(template, recentMealIds, taste, today)

    // In a deficit, protein per calorie is the thing that keeps you full and
    // keeps your muscle, so weight it up explicitly.
    const proteinDensity = macros.kcal ? macros.protein / (macros.kcal / 100) : 0
    const goalBonus =
      goal === 'lose' ? Math.min(0.15, proteinDensity / 100)
      : goal === 'gain' ? Math.min(0.1, macros.kcal / 8000)
      : 0

    const score = 0.38 * taste_ + 0.34 * fit + 0.18 * novelty + goalBonus

    return {
      ...templateWithMacros(template),
      score: Math.round(score * 1000) / 1000,
      why: explain({ taste_, fit, novelty, macros, remaining, taste, template }),
    }
  })

  scored.sort((a, b) => b.score - a.score)

  // Avoid returning four variations of the same thing.
  const chosen = []
  const usedAnchors = new Set()
  for (const meal of scored) {
    const anchor = meal.components[0]?.foodId
    if (usedAnchors.has(anchor) && chosen.length < limit) continue
    chosen.push(meal)
    usedAnchors.add(anchor)
    if (chosen.length >= limit) break
  }
  if (chosen.length < limit) {
    for (const meal of scored) {
      if (chosen.length >= limit) break
      if (!chosen.includes(meal)) chosen.push(meal)
    }
  }

  return { meals: chosen, taste: { favourites: taste.favourites, confident: taste.confident } }
}

function explain({ taste_, fit, macros, remaining, taste, template }) {
  const reasons = []

  // The "we don't know your tastes yet" caveat belongs once on the screen, not
  // stamped on every card — the UI shows it from `taste.confident`.
  if (taste.confident && taste_ > 0.55) {
    const known = template.components
      .map(({ foodId }) => ({ foodId, count: taste.foodCounts.get(foodId) || 0 }))
      .filter((c) => c.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((c) => FOODS_BY_ID.get(c.foodId)?.name.toLowerCase())
      .filter(Boolean)
    if (known.length) reasons.push(`built around ${known.join(' and ')}, which you eat often`)
  }

  if (remaining?.kcal != null) {
    if (remaining.kcal <= 0) {
      // Repeating "over budget by N" for every option is noise when the budget
      // is already gone; say the useful thing once instead.
      reasons.push(`${macros.kcal} kcal — you are already at your limit today, so this is tomorrow's`)
    } else if (macros.kcal <= remaining.kcal) {
      reasons.push(`${macros.kcal} kcal fits inside the ${Math.round(remaining.kcal)} you have left`)
    } else {
      reasons.push(`${macros.kcal} kcal puts you over budget by ${Math.round(macros.kcal - remaining.kcal)}`)
    }
  }

  if (remaining?.protein > 20 && macros.protein >= 30) {
    reasons.push(`${macros.protein} g protein against the ${Math.round(remaining.protein)} g you still owe`)
  }

  return reasons
}

/** Suggest a full day of meals that lands close to target. */
export function suggestDay({ profile, targets, history = [], today }) {
  const plan = []
  const remaining = { kcal: targets.calories, protein: targets.protein }
  const used = []

  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const { meals } = recommendMeals({
      profile, remaining, slot, history, recentMealIds: used, today, limit: 1,
    })
    const meal = meals[0]
    if (!meal) continue
    plan.push(meal)
    used.push(meal.id)
    remaining.kcal -= meal.macros.kcal
    remaining.protein -= meal.macros.protein
  }

  const totals = plan.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.macros.kcal,
      protein: acc.protein + m.macros.protein,
      carbs: acc.carbs + m.macros.carbs,
      fat: acc.fat + m.macros.fat,
      fibre: acc.fibre + m.macros.fibre,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  )

  return { plan, totals, targets }
}

export { MEAL_TEMPLATES, SLOTS }
