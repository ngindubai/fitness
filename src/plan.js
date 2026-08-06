/**
 * Plan engine: turn a plan template + a start date into the prescription for
 * any given day, and turn a confirmed block into ordinary log entries.
 *
 * A "block" is one confirmable unit of the day — the lifting session, the
 * cardio piece, the steps target, or one meal slot. Confirming a block writes
 * a normal entry whose items carry a `planKey` ("2026-08-14:lift"), which is
 * how the tick survives reloads and how double-confirms are prevented.
 */

import { PLANS } from './data/plans.js'
import { parseWorkout } from './parse.js'

const DAY_MS = 86_400_000

const toUTC = (iso) => new Date(`${iso}T00:00:00Z`)

/** Whole days from plan start to date; negative = before the plan begins. */
function dayIndex(startDate, date) {
  return Math.round((toUTC(date) - toUTC(startDate)) / DAY_MS)
}

/** 0 = Monday … 6 = Sunday, matching the gymDays encoding. */
function weekdayOf(date) {
  return (toUTC(date).getUTCDay() + 6) % 7
}

function phaseForWeek(plan, week) {
  return plan.phases.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || plan.phases[plan.phases.length - 1]
}

/**
 * Which session runs on this gym day. "alternate" cycles A/B by counting gym
 * days since the plan started (so the pattern carries across weeks exactly as
 * the plan intends); "weekly" pins Mon=A, Wed=B, Fri=C.
 */
function sessionIndexFor(plan, phase, index, weekday) {
  const positionInWeek = plan.gymDays.indexOf(weekday)
  if (phase.rotation !== 'alternate') return positionInWeek % phase.sessions.length

  const fullWeeks = Math.floor(index / 7)
  const daysIntoWeek = index % 7
  const gymDaysThisWeek = plan.gymDays.filter((d) => d < daysIntoWeek).length
  const cumulative = fullWeeks * plan.gymDays.length + gymDaysThisWeek
  return cumulative % phase.sessions.length
}

/**
 * The full prescription for one date.
 *
 * @param {string} planId
 * @param {string} startDate ISO date the plan began (ideally a Monday)
 * @param {string} date ISO date being asked about
 * @returns {object|null} null when the plan id is unknown
 */
export function planForDate(planId, startDate, date) {
  const plan = PLANS[planId]
  if (!plan || !startDate) return null

  const index = dayIndex(startDate, date)
  const base = { planId: plan.id, planName: plan.name, startDate, weeks: plan.weeks }

  if (index < 0) {
    return { ...base, status: 'upcoming', daysUntil: -index, week: null, blocks: [] }
  }
  const week = Math.floor(index / 7) + 1
  if (week > plan.weeks) {
    return { ...base, status: 'complete', week: null, blocks: [] }
  }

  const weekday = weekdayOf(date)
  const phase = phaseForWeek(plan, week)
  const deload = plan.deloadWeeks.includes(week)
  const testWeek = week === plan.testWeek
  const isGymDay = plan.gymDays.includes(weekday)
  const blocks = []

  if (isGymDay) {
    const sessionIdx = sessionIndexFor(plan, phase, index, weekday)
    const session = testWeek ? plan.testSession : phase.sessions[sessionIdx]
    const sets = deload ? Math.max(1, Math.ceil(phase.scheme.sets / 2)) : phase.scheme.sets
    blocks.push({
      key: 'lift',
      kind: 'workout',
      title: session.title,
      detail: testWeek
        ? 'Log the numbers — they are the before/after.'
        : deload
          ? `Deload — ${sets} set${sets === 1 ? '' : 's'} of ${phase.scheme.reps}, same weights, half the work`
          : `${sets} × ${phase.scheme.reps} · ${phase.scheme.effort} · rest ${phase.scheme.rest}`,
      exercises: session.exercises.map((e) => ({
        ...e,
        sets: testWeek ? 1 : sets,
        reps: testWeek ? 'test' : phase.scheme.reps,
      })),
    })

    const cardio = Array.isArray(phase.cardio)
      ? phase.cardio[Math.min(plan.gymDays.indexOf(weekday), phase.cardio.length - 1)]
      : phase.cardio
    if (cardio) {
      blocks.push({
        key: 'cardio', kind: 'workout',
        title: cardio.title, detail: cardio.detail,
        logText: cardio.logText, optional: !!cardio.optional,
      })
    }
  } else if (phase.restCardio && (!phase.restCardio.weekend || weekday >= 5)) {
    blocks.push({
      key: 'cardio', kind: 'workout',
      title: phase.restCardio.title, detail: phase.restCardio.detail,
      logText: phase.restCardio.logText, optional: !!phase.restCardio.optional,
    })
  }

  blocks.push({
    key: 'steps', kind: 'workout',
    title: `${plan.stepsTarget.toLocaleString()} steps`,
    detail: plan.stepsNote,
    logText: `${plan.stepsTarget} steps`,
  })

  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const bank = plan.meals[slot]
    const meal = bank[index % bank.length]
    blocks.push({
      key: `meal:${slot}`, kind: 'meal', slot,
      title: meal.name,
      detail: `~${meal.kcal} kcal · ${meal.protein} g protein`,
      desc: meal.desc,
      meal,
    })
  }

  return {
    ...base,
    status: 'active',
    week,
    weekday,
    isGymDay,
    deload,
    testWeek,
    phase: { number: phase.number, name: phase.name, weeks: phase.weeks, focus: phase.focus },
    restNote: isGymDay ? null : plan.restNote,
    blocks,
  }
}

/**
 * Build the log-entry items for a confirmed block. Cardio and steps go
 * through the ordinary workout parser so they come out identical to typed
 * entries; lifting sessions and meals are constructed directly because the
 * template already knows exactly what they contain.
 */
export function itemsForBlock(plan, block) {
  if (block.kind === 'meal') {
    const meal = block.meal
    // The bank states kcal and protein. Split the remaining energy into carbs
    // and fat using the plan's daily macro ratio — an estimate, flagged as one.
    const restKcal = Math.max(0, meal.kcal - meal.protein * 4)
    const carbKcal = plan.macros.carbs * 4
    const fatKcal = plan.macros.fat * 9
    const carbShare = carbKcal / (carbKcal + fatKcal)
    return [{
      name: meal.name,
      raw: meal.name,
      grams: null,
      kcal: meal.kcal,
      protein: meal.protein,
      carbs: Math.round((restKcal * carbShare) / 4),
      fat: Math.round((restKcal * (1 - carbShare)) / 9),
      fibre: 0,
      sugar: 0,
      recognised: true,
      estimated: true,
      fromPlan: true,
    }]
  }

  if (block.key === 'lift') {
    // One structured strength item per prescribed exercise: ~3 min per set at
    // the standard lifting MET, tonnage unknown until weights are logged.
    return block.exercises.map((exercise) => ({
      raw: exercise.name,
      activityId: null,
      name: `${exercise.name} ${exercise.sets}×${exercise.reps}`,
      minutes: Math.max(3, exercise.sets * 3),
      distanceKm: null,
      met: 5.0,
      tags: ['strength'],
      recognised: true,
      fromPlan: true,
      exercise: {
        id: null,
        name: exercise.name,
        group: exercise.group || 'full',
        sets: exercise.sets,
        reps: null,
        weightKg: null,
        volume: null,
      },
    }))
  }

  // Cardio and steps: parse the canonical phrase.
  return parseWorkout(block.logText).map((item) => ({ ...item, fromPlan: true }))
}

/**
 * Everything a "Plan" overview screen needs: the template itself plus the
 * calendar the start date pins it to.
 */
export function planOverview(planId, startDate, today) {
  const plan = PLANS[planId]
  if (!plan) return null

  const addDays = (iso, days) => {
    const d = toUTC(iso)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const index = startDate ? dayIndex(startDate, today) : -1
  const currentWeek = index >= 0 ? Math.floor(index / 7) + 1 : null

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      owner: plan.owner,
      weeks: plan.weeks,
      kcal: plan.kcal,
      macros: plan.macros,
      stepsTarget: plan.stepsTarget,
      gymDays: plan.gymDays,
      deloadWeeks: plan.deloadWeeks,
      testWeek: plan.testWeek,
      rules: plan.rules,
      meals: plan.meals,
      phases: plan.phases.map((phase) => ({
        number: phase.number,
        name: phase.name,
        weeks: phase.weeks,
        focus: phase.focus,
        scheme: phase.scheme,
        rotation: phase.rotation,
        sessions: phase.sessions,
        cardio: (Array.isArray(phase.cardio) ? phase.cardio : [phase.cardio]).filter(Boolean),
        restCardio: phase.restCardio,
        ...(startDate ? {
          from: addDays(startDate, (phase.weeks[0] - 1) * 7),
          to: addDays(startDate, phase.weeks[1] * 7 - 1),
        } : {}),
      })),
    },
    startDate: startDate || null,
    endDate: startDate ? addDays(startDate, plan.weeks * 7 - 1) : null,
    currentWeek: currentWeek && currentWeek <= plan.weeks ? currentWeek : null,
  }
}
