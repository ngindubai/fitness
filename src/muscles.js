/**
 * Muscle effort accounting for the heat map.
 *
 * Effort is deliberately simple and comparable rather than physiological:
 * one working set = one unit of effort, split across the muscles the lift
 * loads (prime movers get the full share, assistors a fraction). Cardio
 * contributes one unit per ten minutes to the muscles the machine works,
 * scaled by intensity. The point is comparing weeks and spotting neglect,
 * not estimating fibre damage.
 *
 * Recovery is a flat rule the user chose: a muscle that received meaningful
 * effort is "in recovery" for 24 hours from when the session was logged.
 */

import { EXERCISES, EXERCISES_BY_ID, EXERCISE_ALIAS_INDEX } from './data/exercises.js'

export const MUSCLES = [
  { id: 'chest', name: 'Chest', side: 'front' },
  { id: 'front_delts', name: 'Front delts', side: 'front' },
  { id: 'side_delts', name: 'Side delts', side: 'both' },
  { id: 'rear_delts', name: 'Rear delts', side: 'back' },
  { id: 'traps', name: 'Traps', side: 'back' },
  { id: 'lats', name: 'Lats', side: 'back' },
  { id: 'mid_back', name: 'Mid back', side: 'back' },
  { id: 'lower_back', name: 'Lower back', side: 'back' },
  { id: 'biceps', name: 'Biceps', side: 'front' },
  { id: 'triceps', name: 'Triceps', side: 'back' },
  { id: 'forearms', name: 'Forearms', side: 'both' },
  { id: 'abs', name: 'Abs', side: 'front' },
  { id: 'obliques', name: 'Obliques', side: 'front' },
  { id: 'glutes', name: 'Glutes', side: 'back' },
  { id: 'quads', name: 'Quads', side: 'front' },
  { id: 'adductors', name: 'Inner thigh', side: 'front' },
  { id: 'hamstrings', name: 'Hamstrings', side: 'back' },
  { id: 'calves', name: 'Calves', side: 'back' },
]

export const MUSCLES_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]))

/**
 * What cardio works, per activity id (with prefix fallbacks below). Shares
 * are small on purpose: an hour's easy ride is real leg work but it is not
 * a squat session.
 */
const CARDIO_MUSCLES = {
  rowing_machine: { lats: 0.5, mid_back: 0.5, quads: 0.5, hamstrings: 0.5, biceps: 0.25 },
  assault_bike: { quads: 0.5, front_delts: 0.5, triceps: 0.25, hamstrings: 0.25 },
  skierg: { lats: 0.5, triceps: 0.5, abs: 0.5 },
  elliptical: { quads: 0.5, glutes: 0.5, hamstrings: 0.25 },
  stairs: { quads: 0.5, glutes: 0.5, calves: 0.5 },
  swim: { lats: 0.5, front_delts: 0.5, triceps: 0.5, mid_back: 0.25 },
  cycle: { quads: 0.5, glutes: 0.5, hamstrings: 0.25, calves: 0.25 },
  run: { quads: 0.5, hamstrings: 0.5, calves: 0.5, glutes: 0.5 },
  walk: { quads: 0.25, glutes: 0.25, calves: 0.5, hamstrings: 0.25 },
}

export function cardioMusclesFor(activityId) {
  if (!activityId) return null
  if (CARDIO_MUSCLES[activityId]) return CARDIO_MUSCLES[activityId]
  for (const [prefix, muscles] of Object.entries(CARDIO_MUSCLES)) {
    if (activityId.startsWith(prefix)) return muscles
  }
  if (/jog|treadmill|parkrun|marathon|trail/.test(activityId)) return CARDIO_MUSCLES.run
  if (/spin|bike|mtb/.test(activityId)) return CARDIO_MUSCLES.cycle
  if (/hik/.test(activityId)) return CARDIO_MUSCLES.walk
  return null
}

/** Muscle map for a strength item: by exercise id, else by name lookup. */
function strengthMusclesFor(item) {
  const byId = item.exercise?.id ? EXERCISES_BY_ID.get(item.exercise.id) : null
  if (byId) return byId.muscles
  // Plan-generated items carry a name but no id; match it against aliases.
  const name = (item.exercise?.name || item.name || '').toLowerCase()
  for (const { term, exercise } of EXERCISE_ALIAS_INDEX) {
    if (name.includes(term)) return exercise.muscles
  }
  return { quads: 0.25, chest: 0.25, lats: 0.25 } // unknown lift: spread thin
}

/**
 * Effort per muscle for one workout item.
 * @returns {Record<string, number>} muscle id -> effort units
 */
export function itemMuscleEffort(item) {
  const out = {}
  const round1 = () => {
    for (const key of Object.keys(out)) out[key] = Math.round(out[key] * 10) / 10
    return out
  }

  // A structured lift (identified exercise with sets) is the strength path.
  // The strength TAG alone is not enough: "rowing machine" carries it too.
  if (item.exercise) {
    const sets = item.exercise.sets || Math.max(1, Math.round((item.minutes || 9) / 3))
    for (const [muscle, share] of Object.entries(strengthMusclesFor(item))) {
      out[muscle] = (out[muscle] || 0) + sets * share
    }
    return round1()
  }

  const tags = item.tags || []
  let muscles = cardioMusclesFor(item.activityId)
  // An unstructured "45 min weights" session: real work with no exercise
  // list, so spread it thinly across the big movers.
  if (!muscles && tags.includes('strength')) {
    muscles = { quads: 0.25, glutes: 0.25, chest: 0.25, lats: 0.25, front_delts: 0.25 }
  }
  if (muscles && item.minutes) {
    // One unit per 10 minutes, nudged by intensity (met vs a moderate 5).
    const intensity = Math.min(1.6, Math.max(0.6, (item.met || 5) / 5))
    for (const [muscle, share] of Object.entries(muscles)) {
      out[muscle] = (out[muscle] || 0) + (item.minutes / 10) * share * intensity
    }
  }
  return round1()
}

/** Sum effort across many workout entries. */
export function muscleEffortFor(workoutEntries) {
  const totals = {}
  for (const entry of workoutEntries) {
    for (const item of entry.items || []) {
      for (const [muscle, effort] of Object.entries(itemMuscleEffort(item))) {
        totals[muscle] = (totals[muscle] || 0) + effort
      }
    }
  }
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 10) / 10
  return totals
}

export const RECOVERY_HOURS = 24
const MEANINGFUL = 0.5 // below this, a muscle only assisted; no recovery clock

/**
 * Which muscles are inside their 24-hour recovery window right now.
 *
 * @param {Array} workoutEntries entries with createdAt timestamps
 * @param {Date} [now]
 * @returns {Record<string, {hoursLeft:number, effort:number}>}
 */
export function recoveringMuscles(workoutEntries, now = new Date()) {
  const out = {}
  for (const entry of workoutEntries) {
    const logged = new Date(entry.createdAt || `${entry.date}T12:00:00Z`)
    const hoursSince = (now - logged) / 3_600_000
    if (hoursSince < 0 || hoursSince >= RECOVERY_HOURS) continue
    for (const item of entry.items || []) {
      for (const [muscle, effort] of Object.entries(itemMuscleEffort(item))) {
        if (effort < MEANINGFUL) continue
        const hoursLeft = Math.round((RECOVERY_HOURS - hoursSince) * 10) / 10
        const existing = out[muscle]
        out[muscle] = {
          hoursLeft: existing ? Math.max(existing.hoursLeft, hoursLeft) : hoursLeft,
          effort: Math.round(((existing?.effort || 0) + effort) * 10) / 10,
        }
      }
    }
  }
  return out
}

/**
 * Muscles with no meaningful work in a window where training DID happen —
 * the coach's "you keep skipping legs" evidence.
 */
export function neglectedMuscles(effortTotals, { threshold = 1 } = {}) {
  const trained = Object.values(effortTotals).some((effort) => effort >= threshold)
  if (!trained) return []
  return MUSCLES.filter((m) => (effortTotals[m.id] || 0) < threshold).map((m) => m.id)
}

/**
 * The hard numbers behind a date range, per muscle: how many reps and how
 * many distinct exercises actually hit it (any tier), alongside the weighted
 * effort. Reps are facts, so they are NOT tier-weighted — a set of 10 rows
 * is ten reps for the lats and ten for the biceps; the tier weighting lives
 * in `effort`. Cardio has no reps; it shows up as minutes.
 */
export function muscleRangeStats(workoutEntries) {
  const perMuscle = {}
  const bucket = (muscle) => (perMuscle[muscle] ||= {
    effort: 0, reps: 0, sets: 0, cardioMinutes: 0, exercises: new Set(),
  })
  const totals = { reps: 0, sets: 0, cardioMinutes: 0, exercises: new Set(), workouts: workoutEntries.length }

  for (const entry of workoutEntries) {
    for (const item of entry.items || []) {
      const efforts = itemMuscleEffort(item)

      if (item.exercise) {
        const sets = item.exercise.sets || Math.max(1, Math.round((item.minutes || 9) / 3))
        const reps = item.exercise.reps ? sets * item.exercise.reps : 0
        const name = item.exercise.name || item.name
        totals.sets += sets
        totals.reps += reps
        totals.exercises.add(name)
        const muscles = strengthMusclesFor(item)
        for (const muscle of Object.keys(muscles)) {
          const b = bucket(muscle)
          b.sets += sets
          b.reps += reps
          b.exercises.add(name)
        }
        for (const [muscle, effort] of Object.entries(efforts)) bucket(muscle).effort += effort
        continue
      }

      const muscles = cardioMusclesFor(item.activityId)
      if (muscles && item.minutes) {
        totals.cardioMinutes += item.minutes
        totals.exercises.add(item.name)
        for (const muscle of Object.keys(muscles)) {
          const b = bucket(muscle)
          b.cardioMinutes += item.minutes
          b.exercises.add(item.name)
        }
      }
      for (const [muscle, effort] of Object.entries(itemMuscleEffort(item))) bucket(muscle).effort += effort
    }
  }

  const shaped = {}
  for (const [muscle, b] of Object.entries(perMuscle)) {
    shaped[muscle] = {
      effort: Math.round(b.effort * 10) / 10,
      reps: b.reps,
      sets: b.sets,
      cardioMinutes: Math.round(b.cardioMinutes),
      exercises: [...b.exercises],
    }
  }
  return {
    perMuscle: shaped,
    totals: {
      reps: totals.reps,
      sets: totals.sets,
      cardioMinutes: Math.round(totals.cardioMinutes),
      exercises: totals.exercises.size,
      workouts: totals.workouts,
    },
  }
}

/**
 * Build a workout that targets whatever the window neglected. Muscles are
 * ranked by how little effort they received; exercises are chosen from the
 * menu so that every pick's PRIMARY muscle is one of the gaps, preferring
 * movements whose secondary muscles also cover other gaps (compound bias).
 *
 * @param {Array} workoutEntries entries from the look-back window
 * @param {{count?: number}} [opts]
 * @returns {{targets: string[], exercises: Array}}
 */
export function recommendWorkout(workoutEntries, { count = 5 } = {}) {
  const effort = muscleEffortFor(workoutEntries)
  // Need: 1 at zero effort, fading toward 0 as a muscle approaches "enough"
  // for a week (~6 effort units ≈ two solid sessions).
  const need = (muscle) => Math.max(0, 1 - (effort[muscle] || 0) / 6)
  const ranked = MUSCLES.map((m) => m.id).sort((a, b) => need(b) - need(a))

  const chosen = []
  const covered = new Set()
  for (const target of ranked) {
    if (chosen.length >= count) break
    if (need(target) <= 0.34) break // the rest of the body had a fine week
    if (covered.has(target)) continue

    let best = null
    let bestScore = 0
    for (const exercise of EXERCISES) {
      if (chosen.some((c) => c.id === exercise.id)) continue
      if ((exercise.muscles[target] || 0) !== 1) continue // must be the prime mover
      let score = 0
      for (const [muscle, share] of Object.entries(exercise.muscles)) {
        score += share * need(muscle) * (covered.has(muscle) ? 0.3 : 1)
      }
      if (score > bestScore) { best = exercise; bestScore = score }
    }
    if (!best) continue

    const reps = best.met >= 8 ? 15 : best.group === 'core' ? 12 : 10
    chosen.push({
      id: best.id,
      name: best.name,
      group: best.group,
      sets: 3,
      reps,
      met: best.met,
      muscles: best.muscles,
    })
    for (const [muscle, share] of Object.entries(best.muscles)) {
      if (share >= 0.5) covered.add(muscle)
    }
  }

  return {
    targets: ranked.filter((m) => need(m) > 0.34), // every gap, neediest first
    exercises: chosen,
  }
}
