/**
 * The numbers engine: energy expenditure, targets, and daily roll-ups.
 *
 * Every figure produced here is an estimate. Prediction equations for resting
 * metabolic rate land within about +/-10% for most people, and MET-based
 * exercise burn is looser still. That is fine for tracking a trend over weeks;
 * it is not fine for treating a single day's number as truth. The coaching
 * layer is written with that uncertainty in mind.
 */

import { activityKcal } from './parse.js'

/**
 * Baseline activity multipliers applied to BMR. These deliberately describe
 * life *outside* of logged training, because logged training is added on top.
 * Using a "very active" multiplier and then also adding your gym session is
 * how people end up eating 600 kcal more than they think they are.
 */
export const BASELINE_LEVELS = {
  desk: { label: 'Desk job, little walking', multiplier: 1.2 },
  light: { label: 'Mostly seated, some walking', multiplier: 1.3 },
  moderate: { label: 'On your feet a fair bit', multiplier: 1.45 },
  active: { label: 'Manual or highly active job', multiplier: 1.6 },
}

export const GOALS = {
  lose: { label: 'Lose fat', sign: -1 },
  maintain: { label: 'Maintain', sign: 0 },
  gain: { label: 'Build muscle', sign: 1 },
}

/** Energy content of one kilogram of body-fat tissue, in kcal. */
const KCAL_PER_KG = 7700

export const DEFAULT_PROFILE = {
  name: '',
  sex: 'male',
  age: 40,
  heightCm: 178,
  weightKg: 85,
  baseline: 'light',
  goal: 'lose',
  rateKgPerWeek: 0.5,
  timezone: 'Europe/London',
  proteinPerKg: null, // null = derive from goal
}

/**
 * Mifflin-St Jeor resting metabolic rate. Chosen over Harris-Benedict because
 * it was derived from a modern population and is the better predictor across
 * normal-weight, overweight and obese adults alike.
 *
 * @param {typeof DEFAULT_PROFILE} p
 * @returns {number} kcal/day
 */
export function bmr(p) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  if (p.sex === 'female') return Math.round(base - 161)
  if (p.sex === 'other') return Math.round(base - 78) // midpoint of the two constants
  return Math.round(base + 5)
}

/** Energy burned before any deliberate exercise is counted. */
export function baselineBurn(p) {
  const level = BASELINE_LEVELS[p.baseline] || BASELINE_LEVELS.light
  return Math.round(bmr(p) * level.multiplier)
}

/**
 * Daily calorie and macro targets.
 *
 * The deficit is capped two ways: at 25% of maintenance, and at an absolute
 * floor (1500 kcal for men, 1200 for women). Health bodies converge on
 * 0.5-1 kg per week as the ceiling for sustainable loss; faster than that and
 * you shed muscle alongside fat and rebound.
 *
 * @param {typeof DEFAULT_PROFILE} p
 * @param {number} exerciseKcal energy from today's logged training
 */
export function targetsFor(p, exerciseKcal = 0) {
  const base = baselineBurn(p)
  const maintenance = base + exerciseKcal
  const goal = GOALS[p.goal] ? p.goal : 'maintain'

  const rate = Math.abs(p.rateKgPerWeek || 0)
  let adjustment = 0
  if (goal === 'lose') adjustment = -(rate * KCAL_PER_KG) / 7
  if (goal === 'gain') adjustment = Math.min((rate * KCAL_PER_KG) / 7, 500)

  let calories = maintenance + adjustment
  const cappedByPercent = maintenance * 0.75
  const floor = p.sex === 'female' ? 1200 : 1500
  let capNote = null

  if (goal === 'lose') {
    if (calories < cappedByPercent) {
      calories = cappedByPercent
      capNote = 'Deficit capped at 25% of maintenance.'
    }
    if (calories < floor) {
      calories = floor
      capNote = `Target raised to the ${floor} kcal safety floor.`
    }
  }

  calories = Math.round(calories)

  // Protein: 1.6-2.2 g/kg is the evidence-backed range for people training.
  // The top of that range is where you want to be in a deficit, because that
  // is when lean mass is most at risk.
  const proteinPerKg =
    p.proteinPerKg || (goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6)
  const protein = Math.round(p.weightKg * proteinPerKg)

  // Fat floor of 0.6 g/kg protects hormone production and fat-soluble vitamin
  // absorption; below that a diet stops being merely unpleasant.
  const fat = Math.round(Math.max(p.weightKg * 0.6, (calories * 0.22) / 9))

  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  // 14 g fibre per 1000 kcal is the standard population recommendation.
  const fibre = Math.round((calories / 1000) * 14)

  return {
    calories,
    protein,
    carbs,
    fat,
    fibre,
    maintenance: Math.round(maintenance),
    baseline: base,
    exerciseKcal: Math.round(exerciseKcal),
    bmr: bmr(p),
    proteinPerKg,
    capNote,
    goal,
  }
}

const EMPTY_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0 }

/** Sum the nutrition across every food item logged in a set of meals. */
export function sumMeals(meals) {
  const totals = { ...EMPTY_TOTALS }
  let unrecognised = 0
  let alcoholKcal = 0
  const tags = new Map()

  for (const meal of meals) {
    for (const item of meal.items || []) {
      totals.kcal += item.kcal || 0
      totals.protein += item.protein || 0
      totals.carbs += item.carbs || 0
      totals.fat += item.fat || 0
      totals.fibre += item.fibre || 0
      totals.sugar += item.sugar || 0
      if (item.recognised === false) unrecognised += 1
      for (const tag of item.tags || []) {
        tags.set(tag, (tags.get(tag) || 0) + (item.kcal || 0))
        if (tag === 'alcohol') alcoholKcal += item.kcal || 0
      }
    }
  }

  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 10) / 10
  totals.kcal = Math.round(totals.kcal)
  return { totals, unrecognised, alcoholKcal: Math.round(alcoholKcal), tags }
}

/** Sum the energy and training-quality signals across logged workouts. */
export function sumWorkouts(workouts, weightKg) {
  let kcal = 0
  let minutes = 0
  let vigorousMinutes = 0
  let moderateMinutes = 0
  let strengthMinutes = 0
  let cardioMinutes = 0
  let distanceKm = 0

  for (const workout of workouts) {
    for (const item of workout.items || []) {
      const burn = item.kcal != null ? item.kcal : activityKcal(item, weightKg)
      kcal += burn
      minutes += item.minutes || 0
      distanceKm += item.distanceKm || 0
      const tags = item.tags || []
      if (tags.includes('strength')) strengthMinutes += item.minutes || 0
      if (tags.includes('cardio')) cardioMinutes += item.minutes || 0
      if (tags.includes('vigorous')) vigorousMinutes += item.minutes || 0
      else if (item.met >= 3) moderateMinutes += item.minutes || 0
    }
  }

  return {
    kcal: Math.round(kcal),
    minutes: Math.round(minutes),
    vigorousMinutes: Math.round(vigorousMinutes),
    moderateMinutes: Math.round(moderateMinutes),
    strengthMinutes: Math.round(strengthMinutes),
    cardioMinutes: Math.round(cardioMinutes),
    distanceKm: Math.round(distanceKm * 10) / 10,
    // WHO counts one vigorous minute as two moderate minutes.
    equivalentModerateMinutes: Math.round(moderateMinutes + vigorousMinutes * 2),
  }
}

/**
 * Build the complete picture of a single day.
 *
 * @param {object} args
 * @param {typeof DEFAULT_PROFILE} args.profile
 * @param {Array} args.meals
 * @param {Array} args.workouts
 * @param {string} args.date
 */
export function buildDay({ profile, meals = [], workouts = [], date }) {
  const nutrition = sumMeals(meals)
  const training = sumWorkouts(workouts, profile.weightKg)
  const targets = targetsFor(profile, training.kcal)

  const caloriesIn = nutrition.totals.kcal
  const caloriesOut = targets.baseline + training.kcal
  const net = caloriesIn - caloriesOut

  const proteinPct = targets.protein ? (nutrition.totals.protein / targets.protein) * 100 : 0
  const caloriePct = targets.calories ? (caloriesIn / targets.calories) * 100 : 0
  const fibrePct = targets.fibre ? (nutrition.totals.fibre / targets.fibre) * 100 : 0

  return {
    date,
    caloriesIn,
    caloriesOut,
    net,
    // Positive when you are in deficit, which reads more naturally than a
    // negative energy balance when the goal is fat loss.
    deficit: -net,
    projectedKgPerWeek: Math.round(((net * 7) / KCAL_PER_KG) * 100) / 100,
    nutrition: nutrition.totals,
    unrecognisedItems: nutrition.unrecognised,
    alcoholKcal: nutrition.alcoholKcal,
    tagKcal: Object.fromEntries(nutrition.tags),
    training,
    targets,
    adherence: {
      caloriePct: Math.round(caloriePct),
      proteinPct: Math.round(proteinPct),
      fibrePct: Math.round(fibrePct),
    },
    mealCount: meals.length,
    workoutCount: workouts.length,
    logged: meals.length > 0 || workouts.length > 0,
  }
}

/**
 * Weekly view. Weight change is driven by the cumulative balance, so a single
 * bad day matters far less than the seven-day average - and the summary should
 * say so rather than letting one blowout feel like failure.
 */
export function buildWeek(days) {
  const logged = days.filter((d) => d.logged)
  if (!logged.length) {
    return { days: days.length, loggedDays: 0, avgIn: 0, avgOut: 0, avgNet: 0,
      avgProtein: 0, trainingDays: 0, totalTrainingMinutes: 0, projectedKgPerWeek: 0,
      strengthDays: 0, alcoholDays: 0, equivalentModerateMinutes: 0 }
  }
  const sum = (fn) => logged.reduce((acc, d) => acc + fn(d), 0)
  const avgNet = sum((d) => d.net) / logged.length

  return {
    days: days.length,
    loggedDays: logged.length,
    avgIn: Math.round(sum((d) => d.caloriesIn) / logged.length),
    avgOut: Math.round(sum((d) => d.caloriesOut) / logged.length),
    avgNet: Math.round(avgNet),
    avgProtein: Math.round(sum((d) => d.nutrition.protein) / logged.length),
    avgFibre: Math.round(sum((d) => d.nutrition.fibre) / logged.length),
    trainingDays: logged.filter((d) => d.training.minutes > 0).length,
    strengthDays: logged.filter((d) => d.training.strengthMinutes > 0).length,
    alcoholDays: logged.filter((d) => d.alcoholKcal > 0).length,
    totalTrainingMinutes: sum((d) => d.training.minutes),
    equivalentModerateMinutes: sum((d) => d.training.equivalentModerateMinutes),
    totalDistanceKm: Math.round(sum((d) => d.training.distanceKm) * 10) / 10,
    projectedKgPerWeek: Math.round(((avgNet * 7) / KCAL_PER_KG) * 100) / 100,
  }
}

export { KCAL_PER_KG }
