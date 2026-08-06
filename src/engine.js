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
import { PLANS } from './data/plans.js'
import { itemMuscleEffort } from './muscles.js'

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

/**
 * How much of the day's training burn is added back onto the eating budget.
 * "all" makes the ring respond one-for-one to exercise; "none" keeps the
 * target fixed so training lands entirely as extra deficit; "half" is the
 * hedge for people who know exercise calories are estimates.
 */
export const EAT_BACK = {
  all: { label: 'Add all of it to the budget', factor: 1 },
  half: { label: 'Add half of it back', factor: 0.5 },
  none: { label: 'Fixed target — training is bonus deficit', factor: 0 },
}

/** Energy content of one kilogram of body-fat tissue, in kcal. */
const KCAL_PER_KG = 7700

export const CLIMATES = {
  hot: { label: 'Hot (Gulf summer, outdoor training in heat)' },
  temperate: { label: 'Temperate' },
}

export const DEFAULT_PROFILE = {
  name: '',
  sex: 'male',
  age: 37,
  heightCm: 178,
  weightKg: 115,
  baseline: 'light',
  goal: 'lose',
  rateKgPerWeek: 0.5,
  timezone: 'Asia/Dubai',
  climate: 'hot',
  proteinPerKg: null, // null = derive from goal
  planId: null,       // structured six-month plan, if following one
  planStart: null,    // ISO date the plan began (ideally a Monday)
  eatBack: 'all',     // how training burn extends the day's calorie budget
  onboarded: false,   // true once sex/age/height/weight were entered by hand
  planEdits: {},      // per-session plan customisations (removed/added exercises)
}

/**
 * WHO adult BMI classification (also used by the CDC). BMI has a real and
 * well-known blind spot — it cannot tell muscle from fat — so everywhere it
 * is shown, it is shown as context, never as a verdict.
 */
export const BMI_BANDS = [
  { id: 'underweight', label: 'Underweight', min: 0, max: 18.5 },
  { id: 'healthy', label: 'Healthy', min: 18.5, max: 25 },
  { id: 'overweight', label: 'Overweight', min: 25, max: 30 },
  { id: 'obese1', label: 'Obese I', min: 30, max: 35 },
  { id: 'obese2', label: 'Obese II', min: 35, max: 40 },
  { id: 'obese3', label: 'Obese III', min: 40, max: 60 },
]

/** @returns {{bmi:number, band:string, label:string, healthyKgMin:number, healthyKgMax:number}} */
export function bmiInfo(profile) {
  const heightM = profile.heightCm / 100
  const bmi = Math.round((profile.weightKg / (heightM * heightM)) * 10) / 10
  const band = BMI_BANDS.find((b) => bmi >= b.min && bmi < b.max) || BMI_BANDS[BMI_BANDS.length - 1]
  return {
    bmi,
    band: band.id,
    label: band.label,
    // The weight range that would land this height in the healthy band.
    healthyKgMin: Math.round(18.5 * heightM * heightM),
    healthyKgMax: Math.round(24.9 * heightM * heightM),
  }
}

/**
 * Heat adjustment for outdoor work in a hot climate.
 *
 * Thermoregulation in serious heat (Dubai summer is 38-45C) raises the energy
 * cost of the same pace - studies put it in the 5-13% range depending on
 * intensity and acclimatisation. 8% is a deliberately modest middle: enough to
 * stop the log short-changing genuinely hard conditions, small enough that it
 * cannot be used to justify a kebab.
 */
export const HEAT_MULTIPLIER = 1.08

export function climateAdjustedKcal(baseKcal, item, profile) {
  if (profile?.climate === 'hot' && item?.outdoor) {
    return Math.round(baseKcal * HEAT_MULTIPLIER)
  }
  return Math.round(baseKcal)
}

/**
 * Daily fluid target in ml. 35 ml/kg is the standard clinical baseline; a hot
 * climate adds a flat 500 ml, and training adds ~250 ml per half hour (capped,
 * because a three-hour golf round does not need three extra litres counted
 * here - you drink through it anyway).
 */
export function waterTargetMl(profile, trainingMinutes = 0) {
  const base = profile.weightKg * 35
  const climate = profile.climate === 'hot' ? 500 : 0
  const training = Math.min(1500, Math.round(trainingMinutes / 30) * 250)
  return Math.round((base + climate + training) / 250) * 250
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
  // Only the eaten-back share of training extends the budget; the rest of
  // the burn still shows up as deficit, it just cannot be eaten against.
  const eatBack = EAT_BACK[p.eatBack] || EAT_BACK.all
  const credit = Math.round(exerciseKcal * eatBack.factor)
  const maintenance = base + credit
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

  // Protein: 1.6-2.2 g/kg is the evidence-backed range for people training,
  // and the top of it is where to be in a deficit. But that per-kg figure is
  // meant to scale with lean tissue, so above BMI 30 it is applied to an
  // adjusted body weight (ideal + 40% of the excess) - the standard clinical
  // correction. Otherwise a heavier person gets handed an impossible number
  // and fails it every day for no physiological reason.
  const proteinPerKg =
    p.proteinPerKg || (goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6)
  const heightM = p.heightCm / 100
  const bmi = p.weightKg / (heightM * heightM)
  let proteinWeight = p.weightKg
  if (bmi > 30) {
    const idealKg = 25 * heightM * heightM
    proteinWeight = idealKg + 0.4 * (p.weightKg - idealKg)
  }
  const protein = Math.round(proteinWeight * proteinPerKg)

  // Fat floor of 0.6 g/kg protects hormone production and fat-soluble vitamin
  // absorption; below that a diet stops being merely unpleasant.
  const fat = Math.round(Math.max(p.weightKg * 0.6, (calories * 0.22) / 9))

  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  // A structured plan prescribes fixed daily numbers; when one is active it
  // overrides the derived targets — but the eaten-back training credit still
  // applies on top, or the ring would never respond to a workout.
  const plan = p.planId ? PLANS[p.planId] : null
  const finalCalories = plan ? plan.kcal + credit : calories
  const finalProtein = plan ? plan.macros.protein : protein
  const finalFat = plan ? plan.macros.fat : fat
  const finalCarbs = plan ? plan.macros.carbs : carbs

  // 14 g fibre per 1000 kcal is the standard population recommendation.
  const fibre = Math.round((finalCalories / 1000) * 14)

  return {
    calories: finalCalories,
    protein: finalProtein,
    carbs: finalCarbs,
    fat: finalFat,
    fibre,
    plan: plan ? { id: plan.id, name: plan.name } : null,
    maintenance: Math.round(maintenance),
    baseline: base,
    exerciseKcal: Math.round(exerciseKcal),
    exerciseCredit: credit,
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
  let alcoholUnits = 0
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
      alcoholUnits += item.units || 0
      for (const tag of item.tags || []) {
        tags.set(tag, (tags.get(tag) || 0) + (item.kcal || 0))
        if (tag === 'alcohol') alcoholKcal += item.kcal || 0
      }
    }
  }

  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 10) / 10
  totals.kcal = Math.round(totals.kcal)
  return {
    totals,
    unrecognised,
    alcoholKcal: Math.round(alcoholKcal),
    alcoholUnits: Math.round(alcoholUnits * 10) / 10,
    tags,
  }
}

/** Sum the energy and training-quality signals across logged workouts. */
export function sumWorkouts(workouts, weightKg) {
  let kcal = 0
  let minutes = 0
  let vigorousMinutes = 0
  let moderateMinutes = 0
  let strengthMinutes = 0
  let cardioMinutes = 0
  let outdoorMinutes = 0
  let distanceKm = 0
  let volumeKg = 0
  let sets = 0
  const volumeByGroup = {}
  const muscles = {}

  for (const workout of workouts) {
    for (const item of workout.items || []) {
      const burn = item.kcal != null ? item.kcal : activityKcal(item, weightKg)
      kcal += burn
      minutes += item.minutes || 0
      distanceKm += item.distanceKm || 0
      const tags = item.tags || []
      if (tags.includes('strength')) strengthMinutes += item.minutes || 0
      if (tags.includes('cardio')) cardioMinutes += item.minutes || 0
      if (item.outdoor) outdoorMinutes += item.minutes || 0
      if (tags.includes('vigorous')) vigorousMinutes += item.minutes || 0
      else if (item.met >= 3) moderateMinutes += item.minutes || 0

      if (item.exercise) {
        sets += item.exercise.sets || 0
        if (item.exercise.volume) {
          volumeKg += item.exercise.volume
          const group = item.exercise.group || 'full'
          volumeByGroup[group] = (volumeByGroup[group] || 0) + item.exercise.volume
        }
      }

      for (const [muscle, effort] of Object.entries(itemMuscleEffort(item))) {
        muscles[muscle] = (muscles[muscle] || 0) + effort
      }
    }
  }
  for (const key of Object.keys(muscles)) muscles[key] = Math.round(muscles[key] * 10) / 10

  return {
    kcal: Math.round(kcal),
    minutes: Math.round(minutes),
    vigorousMinutes: Math.round(vigorousMinutes),
    moderateMinutes: Math.round(moderateMinutes),
    strengthMinutes: Math.round(strengthMinutes),
    cardioMinutes: Math.round(cardioMinutes),
    outdoorMinutes: Math.round(outdoorMinutes),
    distanceKm: Math.round(distanceKm * 10) / 10,
    volumeKg: Math.round(volumeKg),
    sets,
    volumeByGroup,
    muscles,
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
 * @param {Array} [args.waters]  water entries with a `value` in ml
 * @param {string} args.date
 */
export function buildDay({ profile, meals = [], workouts = [], waters = [], date }) {
  const nutrition = sumMeals(meals)
  const training = sumWorkouts(workouts, profile.weightKg)
  const targets = targetsFor(profile, training.kcal)
  const waterMl = waters.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)
  const waterTarget = waterTargetMl(profile, training.minutes)

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
    alcoholUnits: nutrition.alcoholUnits,
    tagKcal: Object.fromEntries(nutrition.tags),
    training,
    targets: { ...targets, waterMl: waterTarget },
    waterMl,
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
    alcoholUnits: Math.round(sum((d) => d.alcoholUnits || 0) * 10) / 10,
    totalTrainingMinutes: sum((d) => d.training.minutes),
    equivalentModerateMinutes: sum((d) => d.training.equivalentModerateMinutes),
    totalDistanceKm: Math.round(sum((d) => d.training.distanceKm) * 10) / 10,
    projectedKgPerWeek: Math.round(((avgNet * 7) / KCAL_PER_KG) * 100) / 100,
  }
}

/**
 * Aggregate any run of built days into the numbers a summary screen needs.
 * Used for the weekly and monthly views; daily is just buildDay itself.
 *
 * @param {Array<ReturnType<typeof buildDay>>} days oldest first
 * @param {Array<{date:string, value:number}>} [weighIns]
 */
export function summarisePeriod(days, weighIns = []) {
  const logged = days.filter((d) => d.logged)
  const sum = (fn) => logged.reduce((acc, d) => acc + fn(d), 0)
  const count = logged.length

  const volumeByGroup = {}
  for (const day of logged) {
    for (const [group, volume] of Object.entries(day.training.volumeByGroup || {})) {
      volumeByGroup[group] = (volumeByGroup[group] || 0) + volume
    }
  }

  // Longest run of consecutive logged days within the window.
  let streak = 0
  let bestStreak = 0
  for (const day of days) {
    streak = day.logged ? streak + 1 : 0
    if (streak > bestStreak) bestStreak = streak
  }

  const weights = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const weightChange = weights.length >= 2
    ? Math.round((weights[weights.length - 1].value - weights[0].value) * 10) / 10
    : null

  const avgNet = count ? sum((d) => d.net) / count : 0

  return {
    days: days.map((d) => ({
      date: d.date,
      logged: d.logged,
      in: d.caloriesIn,
      out: d.caloriesOut,
      net: d.net,
      protein: d.nutrition.protein,
      trainingMinutes: d.training.minutes,
      strengthMinutes: d.training.strengthMinutes,
      volumeKg: d.training.volumeKg,
      waterMl: d.waterMl || 0,
      score: null, // filled by the caller when it has reviews to hand
    })),
    loggedDays: count,
    totalDays: days.length,
    avgIn: count ? Math.round(sum((d) => d.caloriesIn) / count) : 0,
    avgOut: count ? Math.round(sum((d) => d.caloriesOut) / count) : 0,
    avgNet: Math.round(avgNet),
    avgProtein: count ? Math.round(sum((d) => d.nutrition.protein) / count) : 0,
    avgFibre: count ? Math.round(sum((d) => d.nutrition.fibre) / count) : 0,
    avgWaterMl: count ? Math.round(sum((d) => d.waterMl || 0) / count) : 0,
    totalTrainingMinutes: sum((d) => d.training.minutes),
    trainingDays: logged.filter((d) => d.training.minutes > 0).length,
    strengthDays: logged.filter((d) => d.training.strengthMinutes > 0).length,
    totalVolumeKg: Math.round(sum((d) => d.training.volumeKg || 0)),
    totalSets: sum((d) => d.training.sets || 0),
    volumeByGroup,
    totalDistanceKm: Math.round(sum((d) => d.training.distanceKm) * 10) / 10,
    alcoholDays: logged.filter((d) => d.alcoholKcal > 0).length,
    alcoholUnits: Math.round(sum((d) => d.alcoholUnits || 0) * 10) / 10,
    daysOnTarget: logged.filter((d) => d.caloriesIn > 0 && d.caloriesIn <= d.targets.calories * 1.05).length,
    bestStreak,
    projectedKgPerWeek: count ? Math.round(((avgNet * 7) / KCAL_PER_KG) * 100) / 100 : 0,
    weightChange,
    weights,
  }
}

export { KCAL_PER_KG }
