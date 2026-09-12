/**
 * HTTP API, shared by the Cloudflare Worker and the Node server.
 *
 * Runtime-agnostic on purpose: it takes a Request and a context object and
 * returns a Response, using only web-standard APIs available in both.
 */

import { parseMeal, parseWorkout, activityKcal, reweighFoodItem, suggestFoods, suggestWorkouts } from './parse.js'
import { buildDay, buildWeek, summarisePeriod, targetsFor, climateAdjustedKcal, HEAT_MULTIPLIER, DEFAULT_PROFILE, BASELINE_LEVELS, GOALS, CLIMATES, EAT_BACK, bmiInfo, BMI_BANDS, goalDirectionFrom, bodyComposition } from './engine.js'
import { reviewDay, reviewWeek } from './coach.js'
import { auditDay } from './food-audit.js'
import { sanitiseCheckin, isEmptyCheckin, checkinDelta, MEASUREMENT_FIELDS, SCALES } from './checkin.js'
import { recommendMeals, suggestDay, buildTasteProfile, recentMeals } from './recommend.js'
import { FOODS, FOODS_BY_ID } from './data/foods.js'
import { ACTIVITIES, ACTIVITIES_BY_ID } from './data/activities.js'
import { issueToken, verifyToken, checkPasscode, extractToken, sessionCookie, clearedCookie, hashPasscode, verifyPasscodeHash } from './auth.js'
import { planForDate, itemsForBlock, planOverview } from './plan.js'
import { MUSCLES, muscleEffortFor, muscleRangeStats, recommendWorkout, recoveringMuscles, cardioMusclesFor, RECOVERY_HOURS } from './muscles.js'
import { EXERCISES, muscleTiers } from './data/exercises.js'
import { PLANS, PLAN_LIST } from './data/plans.js'
import { aiReview, aiMealIdeas, isAiConfigured } from './ai.js'

// ------------------------------------------------------------------- helpers

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  })

const error = (status, message) => json({ error: message }, { status })

/** Today's date in a given IANA timezone, as YYYY-MM-DD. */
export function todayIn(timezone = 'UTC') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The gym cardio menu: machines only, in the order a gym floor has them. */
const CARDIO_MACHINES = new Set([
  'treadmill', 'elliptical', 'rowing_machine', 'stationary_bike', 'spin_class',
  'assault_bike', 'stairs', 'ski_erg',
])

/**
 * Walking is the most-logged exercise there is and the one where conditions
 * change the answer most: the same hour costs 4.3 METs on the flat and 8.0
 * on a steep treadmill incline, and heat adds ~8% on top outdoors. So the
 * picker offers walking with those conditions as an explicit choice rather
 * than making people describe the weather in prose.
 *
 * Each option maps to a real activity id and the phrase the logger parses,
 * so a picked walk and a typed one produce identical entries.
 */
const WALK_OPTIONS = [
  { id: 'flat', label: 'Flat / level', phrase: 'brisk walk', activityId: 'walk_brisk' },
  { id: 'uphill', label: 'Intense uphill treadmill', phrase: 'uphill treadmill', activityId: 'walk_uphill_steep' },
  { id: 'warm', label: 'Outside · warm', phrase: 'brisk walk', activityId: 'walk_brisk', suffix: 'outside warm' },
  { id: 'cool', label: 'Outside · cool', phrase: 'brisk walk', activityId: 'walk_brisk', suffix: 'outside cool' },
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isValidDate = (value) => typeof value === 'string' && ISO_DATE.test(value)

function newId() {
  return crypto.randomUUID()
}

/** Split stored entries into the shapes the engine expects. */
function partition(entries) {
  const meals = entries.filter((e) => e.kind === 'meal')
  const workouts = entries.filter((e) => e.kind === 'workout')
  const weights = entries.filter((e) => e.kind === 'weight')
  const waters = entries.filter((e) => e.kind === 'water')
  return { meals, workouts, weights, waters }
}

/**
 * Attach food tags to parsed items so the coach can reason about food quality
 * without needing the food database itself.
 */
function decorateFoodItems(items) {
  return items.map((item) => ({
    ...item,
    // Pantry items carry their own tags from the parser; the static database
    // is only consulted for its own ids.
    tags: FOODS_BY_ID.get(item.foodId)?.tags || item.tags || [],
  }))
}

function decorateWorkoutItems(items, profile) {
  return items.map((item) => {
    const base = activityKcal(item, profile.weightKg)
    const kcal = climateAdjustedKcal(base, item, profile)
    return { ...item, kcal, heatAdjusted: kcal !== base }
  })
}

/** Build every day in a range, oldest first. */
function buildDayRange(profile, entries, from, to) {
  const byDate = new Map()
  for (const entry of entries) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, [])
    byDate.get(entry.date).push(entry)
  }

  const days = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const { meals, workouts, waters } = partition(byDate.get(date) || [])
    days.push(buildDay({ profile, meals, workouts, waters, date }))
  }
  return days
}

// -------------------------------------------------------------------- router

/**
 * @param {Request} request
 * @param {{store:object, secret:string, passcode:string, aiKey?:string}} ctx
 */
export async function handleApi(request, ctx) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '') || '/'
  const method = request.method.toUpperCase()

  if (method === 'OPTIONS') return new Response(null, { status: 204 })

  // ------------------------------------------------------------ public routes
  if (path === '/health') {
    return json({ ok: true, ai: isAiConfigured(ctx), foods: FOODS.length, activities: ACTIVITIES.length })
  }

  if (path === '/login' && method === 'POST') {
    if (!ctx.passcode) {
      return error(500, 'No passcode configured. Set the APP_PASSCODE secret before using the app.')
    }
    const body = await readJson(request)
    const submitted = String(body?.passcode || '')

    // The APP_PASSCODE secret is the founding account and owns all
    // pre-multi-user data. Everyone else lives in the users table.
    if (checkPasscode(submitted, ctx.passcode)) {
      const token = await issueToken(ctx.secret, 'owner')
      return json({ token }, { headers: { 'set-cookie': sessionCookie(token) } })
    }
    for (const user of await ctx.store.listUsers()) {
      if (await verifyPasscodeHash(submitted, user.salt, user.passcodeHash)) {
        const token = await issueToken(ctx.secret, user.id)
        return json({ token, name: user.name }, { headers: { 'set-cookie': sessionCookie(token) } })
      }
    }
    return error(401, 'Wrong passcode.')
  }

  if (path === '/signup' && method === 'POST') {
    const body = await readJson(request)
    const passcode = String(body?.passcode || '').trim()
    const name = String(body?.name || '').trim().slice(0, 40)

    if (passcode.length < 4 || passcode.length > 64) {
      return error(400, 'Pick a passcode of at least 4 characters.')
    }
    // The passcode IS the identity, so it has to be unique - including
    // against the founder's, or a new user could shadow that account.
    if (ctx.passcode && checkPasscode(passcode, ctx.passcode)) {
      return error(409, 'That passcode is taken. Pick another.')
    }
    const users = await ctx.store.listUsers()
    if (users.length >= 50) {
      return error(403, 'User limit reached.')
    }
    for (const user of users) {
      if (await verifyPasscodeHash(passcode, user.salt, user.passcodeHash)) {
        return error(409, 'That passcode is taken. Pick another.')
      }
    }

    const id = newId()
    const { salt, hash } = await hashPasscode(passcode)
    await ctx.store.createUser({ id, name, passcodeHash: hash, salt })
    // Seed the profile so the new user starts from sane defaults + their name.
    await ctx.store.setProfile(id, { ...DEFAULT_PROFILE, name })

    const token = await issueToken(ctx.secret, id)
    return json({ token, name }, { status: 201, headers: { 'set-cookie': sessionCookie(token) } })
  }

  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, { headers: { 'set-cookie': clearedCookie } })
  }

  // ---------------------------------------------------------- auth boundary
  const token = extractToken(request)
  const auth = await verifyToken(token, ctx.secret)
  if (!auth) {
    return error(401, 'Not signed in.')
  }
  const userId = auth.sub

  const { store } = ctx
  const profile = await store.getProfile(userId)
  const today = todayIn(profile.timezone)

  // A finished day's review is cached — but logging retroactively changes the
  // day, so any entry mutation on a past date must throw that cache away or
  // the coach keeps quoting yesterday's old deficit.
  const invalidateReview = async (date) => {
    if (date && date < today) await store.deleteReview(userId, date).catch(() => {})
  }

  // The user's scanned/custom products PLUS everyone else's scans, loaded
  // once per request on the routes that parse food text. Sharing is the
  // point of a household app: when one person scans a product, the next
  // person's "protein granola" just works. Own items come first so they win
  // ties, and names you already have are not duplicated by others' copies.
  let pantryCache = null
  const pantryFoods = async () => {
    if (pantryCache) return pantryCache
    const own = await store.listPantry(userId).catch(() => [])
    const shared = (await store.listSharedPantry?.(userId)?.catch?.(() => []) || [])
    const ownNames = new Set(own.map((item) => item.name.toLowerCase()))
    pantryCache = [
      ...own,
      ...shared
        .filter((item) => !ownNames.has(item.name.toLowerCase()))
        .map((item) => ({ ...item, shared: true })),
    ]
    return pantryCache
  }

  // ------------------------------------------------------------------ profile
  if (path === '/profile') {
    if (method === 'GET') {
      return json({
        profile,
        targets: targetsFor(profile, 0),
        bmi: bmiInfo(profile),
        bmiBands: BMI_BANDS,
        options: { baselines: BASELINE_LEVELS, goals: GOALS, climates: CLIMATES, plans: PLAN_LIST, eatBack: EAT_BACK },
        today,
      })
    }
    if (method === 'PUT') {
      const body = await readJson(request)
      const merged = { ...profile, ...body }
      // Rewriting the goal sentence re-reads which way the calories should
      // go. Merging alone would keep the old direction, because the stored
      // profile always carries one. An explicit direction still wins.
      if (typeof body?.goalText === 'string'
        && body.goalText !== profile.goalText
        && !(body?.goal in GOALS)) {
        merged.goal = goalDirectionFrom(body.goalText, profile.goal || DEFAULT_PROFILE.goal)
      }
      const next = sanitiseProfile(merged)
      const saved = await store.setProfile(userId, next)
      return json({ profile: saved, targets: targetsFor(saved, 0), bmi: bmiInfo(saved) })
    }
  }

  // -------------------------------------------------------------- parse only
  if (path === '/parse' && method === 'POST') {
    const body = await readJson(request)
    const kind = body?.kind === 'workout' ? 'workout' : 'meal'
    if (kind === 'meal') {
      const pantry = await pantryFoods()
      const items = decorateFoodItems(parseMeal(body?.text || '', pantry)).map((item) =>
        item.recognised ? item : { ...item, suggestions: suggestFoods(item.raw, 3, pantry) })
      return json({ kind, items })
    }
    const items = decorateWorkoutItems(parseWorkout(body?.text || ''), profile).map((item) =>
      item.recognised ? item : { ...item, suggestions: suggestWorkouts(item.raw) })
    return json({ kind, items })
  }

  // ----------------------------------------------------------------- entries
  if (path === '/entries' && method === 'POST') {
    const body = await readJson(request)
    const date = isValidDate(body?.date) ? body.date : today
    const kind = body?.kind

    if (kind === 'weight') {
      const value = Number(body.value)
      if (!Number.isFinite(value) || value <= 0 || value > 500) {
        return error(400, 'Weight must be a sensible number of kilograms.')
      }
      const entry = { id: newId(), date, kind: 'weight', slot: null, raw: null, items: [], value, createdAt: new Date().toISOString() }
      await store.addEntry(userId, entry)
      // Keep the profile weight current so energy targets track reality.
      await store.setProfile(userId, { ...profile, weightKg: value })
      await invalidateReview(date)
      return json({ entry }, { status: 201 })
    }

    if (kind === 'water') {
      const value = Number(body.value)
      if (!Number.isFinite(value) || value < 50 || value > 3000) {
        return error(400, 'Water should be between 50 and 3000 ml per entry.')
      }
      const entry = { id: newId(), date, kind: 'water', slot: null, raw: null, items: [], value, createdAt: new Date().toISOString() }
      await store.addEntry(userId, entry)
      await invalidateReview(date)
      return json({ entry }, { status: 201 })
    }

    if (kind !== 'meal' && kind !== 'workout') return error(400, 'kind must be meal, workout, weight or water.')

    const text = String(body?.text || '').trim()
    let items = Array.isArray(body?.items) && body.items.length ? body.items : null

    if (!items) {
      if (!text) return error(400, 'Nothing to log.')
      items = kind === 'meal' ? parseMeal(text, await pantryFoods()) : parseWorkout(text)
    }
    items = kind === 'meal'
      ? decorateFoodItems(items)
      : decorateWorkoutItems(items, profile)

    const entry = {
      id: newId(),
      date,
      kind,
      slot: kind === 'meal' ? (body?.slot || inferSlot(profile.timezone)) : null,
      raw: text,
      items,
      value: null,
      createdAt: new Date().toISOString(),
    }
    await store.addEntry(userId, entry)
    await invalidateReview(date)
    return json({ entry }, { status: 201 })
  }

  const entryMatch = path.match(/^\/entries\/([\w-]+)$/)
  if (entryMatch) {
    const id = entryMatch[1]
    if (method === 'DELETE') {
      const existing = await store.getEntry(userId, id)
      const removed = await store.deleteEntry(userId, id)
      if (removed) await invalidateReview(existing?.date)
      return removed ? json({ ok: true }) : error(404, 'Entry not found.')
    }
    if (method === 'PATCH') {
      const body = await readJson(request)
      const existing = await store.getEntry(userId, id)
      if (!existing) return error(404, 'Entry not found.')

      const patch = {}
      if (isValidDate(body?.date)) patch.date = body.date
      if (body?.slot) patch.slot = body.slot

      // Remove one item from an entry; removing the last item deletes it.
      if (typeof body?.removeIndex === 'number') {
        const items = existing.items.filter((_, index) => index !== body.removeIndex)
        if (!items.length) {
          await store.deleteEntry(userId, id)
          await invalidateReview(existing.date)
          return json({ entry: null, deleted: true })
        }
        const updated = await store.updateEntry(userId, id, { items })
        await invalidateReview(existing.date)
        return json({ entry: updated })
      }

      if (Array.isArray(body?.items)) {
        patch.items = existing.kind === 'meal'
          ? decorateFoodItems(body.items)
          : decorateWorkoutItems(body.items, profile)
      } else if (typeof body?.text === 'string') {
        patch.raw = body.text
        patch.items = existing.kind === 'meal'
          ? decorateFoodItems(parseMeal(body.text, await pantryFoods()))
          : decorateWorkoutItems(parseWorkout(body.text), profile)
      } else if (body?.reweigh && typeof body.reweigh.index === 'number') {
        // Adjust a single item's portion without re-parsing the whole entry.
        const items = [...existing.items]
        const index = body.reweigh.index
        if (items[index]) {
          items[index] = existing.kind === 'meal'
            ? { ...reweighFoodItem(items[index], Number(body.reweigh.grams)), tags: items[index].tags }
            : { ...items[index], minutes: Number(body.reweigh.minutes) || items[index].minutes }
          patch.items = existing.kind === 'meal'
            ? items
            : decorateWorkoutItems(items, profile)
        }
      }

      const updated = await store.updateEntry(userId, id, patch)
      await invalidateReview(existing.date)
      if (patch.date && patch.date !== existing.date) await invalidateReview(patch.date)
      return json({ entry: updated })
    }
  }

  // ---------------------------------------------------------------- the plan
  if (path === '/plan-day' && method === 'GET') {
    if (!profile.planId || !PLANS[profile.planId]) return json({ plan: null })
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const day = planForDate(profile.planId, profile.planStart || today, date, profile.planEdits)
    if (!day) return json({ plan: null })

    // A block is "done" when an entry item carries its plan key.
    const entries = await store.listEntries(userId, date, date)
    const done = {}
    for (const entry of entries) {
      for (const item of entry.items || []) {
        if (item.planKey) done[item.planKey] = entry.id
      }
    }
    day.blocks = day.blocks.map((block) => {
      const planKey = `${date}:${block.key}`
      return { ...block, planKey, entryId: done[planKey] || null }
    })
    return json({ plan: { id: profile.planId }, date, day })
  }

  if (path === '/plan-day/confirm' && method === 'POST') {
    if (!profile.planId || !PLANS[profile.planId]) return error(400, 'No plan is active on this profile.')
    const body = await readJson(request)
    const date = isValidDate(body?.date) ? body.date : today
    const key = String(body?.key || '')

    const day = planForDate(profile.planId, profile.planStart || today, date, profile.planEdits)
    if (!day || day.status !== 'active') return error(400, 'The plan is not active on that date.')
    const block = day.blocks.find((b) => b.key === key)
    if (!block) return error(404, 'No such block on that day.')

    const planKey = `${date}:${key}`
    const existing = await store.listEntries(userId, date, date)
    for (const entry of existing) {
      if ((entry.items || []).some((item) => item.planKey === planKey)) {
        return json({ entry, already: true })
      }
    }

    const plan = PLANS[profile.planId]
    let items = itemsForBlock(plan, block).map((item) => ({ ...item, planKey }))
    items = block.kind === 'meal' ? decorateFoodItems(items) : decorateWorkoutItems(items, profile)

    const entry = {
      id: newId(),
      date,
      kind: block.kind,
      slot: block.kind === 'meal' ? block.slot : null,
      raw: `Plan · ${block.title}`,
      items,
      value: null,
      createdAt: new Date().toISOString(),
    }
    await store.addEntry(userId, entry)
    await invalidateReview(date)
    return json({ entry }, { status: 201 })
  }

  if (path === '/plan-overview' && method === 'GET') {
    if (!profile.planId || !PLANS[profile.planId]) return json({ plan: null })
    return json(planOverview(profile.planId, profile.planStart, today, profile.planEdits))
  }

  // ----------------------------------------------------------------- muscles
  if (path === '/muscles' && method === 'GET') {
    const mode = url.searchParams.get('mode') === 'live' ? 'live' : 'range'

    if (mode === 'live') {
      // Recovery reads the last two days of entries; timestamps decide.
      const from = addDays(today, -2)
      const entries = await store.listEntries(userId, from, today)
      const workouts = entries.filter((e) => e.kind === 'workout')
      return json({
        mode: 'live',
        recoveryHours: RECOVERY_HOURS,
        recovering: recoveringMuscles(workouts),
        catalogue: MUSCLES,
      })
    }

    const to = isValidDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today
    const from = isValidDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(to, -6)
    if (from > to) return error(400, 'from must not be after to.')
    const entries = await store.listEntries(userId, from, to)
    const workouts = entries.filter((e) => e.kind === 'workout')
    const stats = muscleRangeStats(workouts)
    return json({
      mode: 'range',
      from,
      to,
      effort: muscleEffortFor(workouts),
      stats: stats.perMuscle,
      totals: stats.totals,
      workoutCount: workouts.length,
      recommendation: recommendWorkout(workouts),
      catalogue: MUSCLES,
    })
  }

  // A workout built from this week's gaps: least-trained muscles first,
  // menu exercises whose primary muscle fills them.
  if (path === '/recommend-workout' && method === 'GET') {
    const to = isValidDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today
    const from = isValidDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(to, -6)
    if (from > to) return error(400, 'from must not be after to.')
    const entries = await store.listEntries(userId, from, to)
    const workouts = entries.filter((e) => e.kind === 'workout')
    const recommendation = recommendWorkout(workouts)
    return json({ from, to, ...recommendation, catalogue: MUSCLES })
  }

  // The exercise menu: every lift with its muscles, plus the cardio machines.
  if (path === '/exercises' && method === 'GET') {
    // Net kcal for one ~3-minute working set at this user's weight:
    // (MET − 1 resting) × kg × hours. Personal, because calories are.
    const kcalPerSet = (met) => Math.max(1, Math.round((met - 1) * profile.weightKg * (3 / 60)))
    return json({
      exercises: EXERCISES.map((e) => ({
        id: e.id, name: e.name, group: e.group, muscles: e.muscles,
        tiers: muscleTiers(e), met: e.met, kcalPerSet: kcalPerSet(e.met),
      })),
      cardio: ACTIVITIES
        .filter((a) => CARDIO_MACHINES.has(a.id))
        .map((a) => {
          const muscles = cardioMusclesFor(a.id)
          return { id: a.id, name: a.name, met: a.met, muscles, tiers: muscles ? muscleTiers({ muscles }) : null }
        }),
      // Walking, with its conditions priced out so the difference is visible
      // before it is logged: 30 minutes uphill is worth nearly two flat ones.
      walking: {
        id: 'walk', name: 'Walking',
        muscles: cardioMusclesFor('walk'),
        options: WALK_OPTIONS.map((option) => {
          const activity = ACTIVITIES_BY_ID.get(option.activityId)
          const met = activity?.met || 4.3
          const base = Math.round((met - 1) * profile.weightKg * (30 / 60))
          const kcal30 = option.id === 'warm' ? Math.round(base * HEAT_MULTIPLIER) : base
          return { ...option, met, kcal30 }
        }),
      },
    })
  }

  // ------------------------------------------------------------------ pantry
  if (path === '/pantry' && method === 'GET') {
    return json({ items: await pantryFoods() })
  }

  if (path === '/pantry' && method === 'POST') {
    const body = await readJson(request)
    const name = String(body?.name || '').trim().slice(0, 80)
    if (name.length < 2) return error(400, 'Give the product a name.')

    const clamp = (value, max) => {
      const number = Number(value)
      return Number.isFinite(number) && number >= 0 ? Math.min(max, Math.round(number * 10) / 10) : 0
    }
    const per100 = {
      kcal: Math.round(clamp(body?.per100?.kcal, 950)),
      protein: clamp(body?.per100?.protein, 100),
      carbs: clamp(body?.per100?.carbs, 100),
      fat: clamp(body?.per100?.fat, 100),
      fibre: clamp(body?.per100?.fibre, 60),
      sugar: clamp(body?.per100?.sugar, 100),
    }
    if (per100.kcal === 0 && per100.protein === 0 && per100.carbs === 0 && per100.fat === 0) {
      return error(400, 'At least one nutrition figure is needed.')
    }
    // The label's own energy figure wins, but nonsense (macros implying triple
    // the calories) is rejected rather than stored silently.
    const macroKcal = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9
    if (per100.kcal > 0 && macroKcal > per100.kcal * 2.2 + 60) {
      return error(400, 'Those macros do not fit that calorie figure — check the numbers.')
    }

    const existing = await pantryFoods()
    if (existing.length >= 200) return error(403, 'Pantry limit reached (200 items).')

    const brand = String(body?.brand || '').trim().slice(0, 40)
    const servingG = Math.min(1000, Math.max(1, Math.round(Number(body?.servingG) || 100)))
    const aliases = [...new Set([
      name.toLowerCase(),
      brand ? `${brand.toLowerCase()} ${name.toLowerCase()}` : null,
    ].filter(Boolean))]

    const item = {
      id: `custom-${newId()}`,
      name: brand ? `${name} (${brand})` : name,
      aliases,
      per100,
      unit: { name: 'serving', grams: servingG },
      tags: ['pantry'],
      source: body?.source === 'scan' ? 'scan' : 'manual',
      createdAt: new Date().toISOString(),
    }
    await store.addPantryItem(userId, item)
    return json({ item }, { status: 201 })
  }

  const pantryMatch = path.match(/^\/pantry\/([\w-]+)$/)
  if (pantryMatch && method === 'DELETE') {
    const removed = await store.deletePantryItem(userId, pantryMatch[1])
    return removed ? json({ ok: true }) : error(404, 'Not in your pantry.')
  }

  // -------------------------------------------------------------- food audit
  if (path === '/food-audit' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const entries = await store.listEntries(userId, date, date)
    const { meals, workouts } = partition(entries)
    const day = buildDay({ profile, meals, workouts, date })
    return json({ date, ...auditDay(meals, day) })
  }

  // --------------------------------------------------------------------- day
  if (path === '/day' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    // A month of context: the coach reads streaks from it and the header shows
    // the logging streak, which caps at "30+".
    const from = addDays(date, -29)
    const entries = await store.listEntries(userId, from, date)
    const todaysEntries = entries.filter((e) => e.date === date)
    const { meals, workouts, weights, waters } = partition(todaysEntries)

    const days = buildDayRange(profile, entries, from, date)
    const day = days[days.length - 1]
    const review = reviewDay(day, profile, days.slice(0, -1))

    // Consecutive logged days ending at this one (or the day before, so an
    // unlogged morning does not read as a broken streak).
    let streak = 0
    for (let i = days.length - (day.logged ? 1 : 2); i >= 0; i -= 1) {
      if (days[i]?.logged) streak += 1
      else break
    }

    return json({
      date,
      day,
      review,
      entries: { meals, workouts, weights, waters },
      // What this person actually eats, for one-tap repeats on Today. Built
      // from the month of entries already loaded above — no extra read.
      recent: recentMeals(entries.filter((e) => e.kind === 'meal'), { limit: 12, excludeDate: date }),
      remaining: {
        kcal: Math.round(day.targets.calories - day.caloriesIn),
        protein: Math.round(day.targets.protein - day.nutrition.protein),
        waterMl: Math.max(0, (day.targets.waterMl || 0) - (day.waterMl || 0)),
      },
      streak: streak >= 30 ? '30+' : streak,
      isToday: date === today,
    })
  }

  // ----------------------------------------------------------------- summary
  if (path === '/summary' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const period = url.searchParams.get('period') === 'month' ? 'month' : 'week'

    let from
    let to
    if (period === 'month') {
      from = `${date.slice(0, 7)}-01`
      const [year, month] = date.slice(0, 7).split('-').map(Number)
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      to = `${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
    } else {
      from = addDays(date, -6)
      to = date
    }

    const entries = await store.listEntries(userId, from, to)
    const days = buildDayRange(profile, entries, from, to)
    const weighIns = entries
      .filter((e) => e.kind === 'weight')
      .map((e) => ({ date: e.date, value: e.value }))

    return json({ period, from, to, today, ...summarisePeriod(days, weighIns) })
  }

  // -------------------------------------------------------------------- week
  if (path === '/week' && method === 'GET') {
    const end = isValidDate(url.searchParams.get('end')) ? url.searchParams.get('end') : today
    const start = addDays(end, -6)
    const entries = await store.listEntries(userId, start, end)
    const days = buildDayRange(profile, entries, start, end)
    const week = buildWeek(days)
    return json({ start, end, week, days, review: reviewWeek(week, profile, days) })
  }

  // --------------------------------------------------------------- check-ins
  if (path === '/checkins' && method === 'GET') {
    const window = Math.min(730, Math.max(1, Number(url.searchParams.get('days')) || 365))
    const from = addDays(today, -(window - 1))
    const entries = await store.listEntries(userId, from, today)
    const checkins = entries
      .filter((e) => e.kind === 'checkin')
      .map(shapeCheckin)
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1)))
    return json({
      checkins,
      // What moved since last time — the reason to check in rather than weigh.
      delta: checkinDelta(checkins[0], checkins[1]),
      fields: MEASUREMENT_FIELDS,
      scales: SCALES,
      today,
    })
  }

  if (path === '/checkins' && method === 'POST') {
    const body = await readJson(request)
    const date = isValidDate(body?.date) ? body.date : today
    const checkin = sanitiseCheckin(body)
    // A weight that was typed but did not survive validation is a typo, not an
    // omission — 1134 for 113.4. Saying nothing would store the check-in
    // without the number the user thought they had entered.
    if (body?.weightKg !== undefined && body?.weightKg !== null && body?.weightKg !== ''
      && checkin.weightKg === null) {
      return error(400, 'That weight does not look right — it should be between 30 and 400 kg.')
    }
    if (isEmptyCheckin(checkin)) {
      return error(400, 'Nothing to save yet — a number, a word or a note is enough.')
    }
    const stamp = new Date().toISOString()
    const entry = {
      id: newId(), date, kind: 'checkin', slot: null,
      raw: checkin.notes || null, items: [checkin],
      value: checkin.weightKg ?? null, createdAt: stamp,
    }
    await store.addEntry(userId, entry)

    // A weight given at a check-in is a weigh-in like any other: it belongs in
    // the same history the charts read, and it updates the profile that every
    // energy target is computed from.
    if (checkin.weightKg !== null) {
      const recent = await store.listEntries(userId, addDays(date, -365), today)
      const weighIns = recent.filter((e) => e.kind === 'weight')
      // Don't stack an identical reading on a day that already has one.
      const duplicate = weighIns.some((e) => e.date === date && e.value === checkin.weightKg)
      if (!duplicate) {
        await store.addEntry(userId, {
          id: newId(), date, kind: 'weight', slot: null, raw: null, items: [],
          value: checkin.weightKg, createdAt: stamp,
        })
      }
      // Only the newest reading may drive the profile weight that every
      // calorie and hydration target is computed from. Back-filling a check-in
      // for last month must not rewrite what you weigh today.
      const newerExists = weighIns.some((e) => e.date > date)
      if (!newerExists) await store.setProfile(userId, { ...profile, weightKg: checkin.weightKg })
      await invalidateReview(date)
    }
    return json({ checkin: shapeCheckin(entry) }, { status: 201 })
  }

  const checkinMatch = path.match(/^\/checkins\/([\w-]+)$/)
  if (checkinMatch && method === 'DELETE') {
    const id = checkinMatch[1]
    // Look the entry up first. Without this the route is a back door: any
    // entry id would delete, so the Check-In tab's Delete button could quietly
    // destroy a meal.
    const entries = await store.listEntries(userId, addDays(today, -730), today)
    const entry = entries.find((e) => e.id === id)
    if (!entry || entry.kind !== 'checkin') return error(404, 'No such check-in.')

    await store.deleteEntry(userId, id)

    // A check-in that carried a weight also wrote a weigh-in. Deleting one and
    // keeping the other would leave the scales — and every calorie target
    // derived from profile.weightKg — quoting a reading the user just removed.
    if (entry.value !== null && entry.value !== undefined) {
      const twin = entries.find((e) => e.kind === 'weight'
        && e.date === entry.date && e.value === entry.value && e.createdAt === entry.createdAt)
      if (twin) await store.deleteEntry(userId, twin.id)
      const standing = entries
        .filter((e) => e.kind === 'weight' && e.id !== twin?.id)
        .sort((a, b) => (`${a.date}${a.createdAt}` < `${b.date}${b.createdAt}` ? 1 : -1))[0]
      if (standing) await store.setProfile(userId, { ...profile, weightKg: standing.value })
    }
    await invalidateReview(entry.date)
    return json({ ok: true })
  }

  // ----------------------------------------------------------------- history
  if (path === '/history' && method === 'GET') {
    const to = isValidDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today
    const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days')) || 30))
    const from = addDays(to, -(days - 1))
    const entries = await store.listEntries(userId, from, to)
    const built = buildDayRange(profile, entries, from, to)
    const weights = entries
      .filter((e) => e.kind === 'weight')
      .map((e) => ({ date: e.date, value: e.value }))
    // Measurements are taken irregularly: a check-in that records only weight
    // and a note must not erase the waist recorded a fortnight ago. Each
    // measurement carries forward from the most recent check-in that had it.
    const checkins = entries
      .filter((e) => e.kind === 'checkin')
      .map(shapeCheckin)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    const latestCheckin = checkins.length
      ? {
          ...checkins[0],
          measurements: checkins.reduceRight(
            (carried, c) => ({ ...carried, ...(c.measurements || {}) }), {}),
        }
      : null
    return json({
      from, to, days: built, weights,
      // Built from the same read rather than a second round trip.
      composition: bodyComposition({ profile, days: built, weighIns: weights, latestCheckin }),
    })
  }

  // ------------------------------------------------------------------ review
  if (path === '/review' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const useAi = url.searchParams.get('ai') === '1' && isAiConfigured(ctx)
    const force = url.searchParams.get('refresh') === '1'

    if (!force) {
      const cached = await store.getReview(userId, date)
      // Only trust a cached review for a day that has already finished.
      if (cached && date < today && cached.ai === useAi) return json({ ...cached, cached: true })
    }

    const from = addDays(date, -13)
    const entries = await store.listEntries(userId, from, date)
    const days = buildDayRange(profile, entries, from, date)
    const day = days[days.length - 1]
    const rules = reviewDay(day, profile, days.slice(0, -1))

    let narrative = null
    if (useAi && day.logged) {
      narrative = await aiReview({ day, review: rules, profile, ctx }).catch(() => null)
    }

    const payload = { date, day, review: rules, narrative, ai: useAi }
    if (date < today) await store.setReview(userId, date, payload)
    return json(payload)
  }

  // --------------------------------------------------------------- recommend
  if (path === '/recommend' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const slot = url.searchParams.get('slot') || null
    const maxEffort = url.searchParams.get('maxEffort') ? Number(url.searchParams.get('maxEffort')) : null

    // Ninety days of history is plenty to learn tastes from without making the
    // query heavy.
    const historyEntries = await store.listEntries(userId, addDays(date, -90), date)
    const history = historyEntries.filter((e) => e.kind === 'meal')

    const todaysEntries = historyEntries.filter((e) => e.date === date)
    const { meals, workouts } = partition(todaysEntries)
    const day = buildDay({ profile, meals, workouts, date })

    const remaining = {
      kcal: Math.max(0, day.targets.calories - day.caloriesIn),
      protein: Math.max(0, day.targets.protein - day.nutrition.protein),
    }

    const recentMealIds = history
      .slice(-12)
      .flatMap((m) => m.items.map((i) => i.foodId))
      .filter(Boolean)

    const result = recommendMeals({
      profile, remaining, slot, history, today: date,
      recentMealIds: [], maxEffortMinutes: maxEffort, limit: Number(url.searchParams.get('limit')) || 4,
    })

    let aiIdeas = null
    if (url.searchParams.get('ai') === '1' && isAiConfigured(ctx)) {
      aiIdeas = await aiMealIdeas({ profile, remaining, taste: result.taste, slot, ctx }).catch(() => null)
    }

    return json({ date, slot, remaining, ...result, aiIdeas, recentFoodIds: [...new Set(recentMealIds)].slice(0, 20) })
  }

  if (path === '/plan' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const historyEntries = await store.listEntries(userId, addDays(date, -90), date)
    const history = historyEntries.filter((e) => e.kind === 'meal')
    const targets = targetsFor(profile, 0)
    return json(suggestDay({ profile, targets, history, today: date }))
  }

  if (path === '/taste' && method === 'GET') {
    const entries = await store.listEntries(userId, addDays(today, -90), today)
    const taste = buildTasteProfile(entries.filter((e) => e.kind === 'meal'))
    return json({ favourites: taste.favourites, confident: taste.confident, totalItems: taste.totalItems })
  }

  // ------------------------------------------------------------- reference
  if (path === '/foods' && method === 'GET') {
    const query = (url.searchParams.get('q') || '').toLowerCase().trim()
    const matches = (query
      ? FOODS.filter((f) =>
          f.name.toLowerCase().includes(query) || f.aliases.some((a) => a.includes(query)))
      : FOODS
    ).slice(0, 40)
    return json({
      foods: matches.map((f) => ({
        id: f.id, name: f.name, per100: f.per100, unit: f.unit, tags: f.tags,
      })),
    })
  }

  if (path === '/activities' && method === 'GET') {
    return json({
      activities: ACTIVITIES.map((a) => ({ id: a.id, name: a.name, met: a.met, tags: a.tags })),
    })
  }

  return error(404, `No such endpoint: ${path}`)
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Flatten a stored check-in entry into the shape the client works with. */
function shapeCheckin(entry) {
  const payload = (entry.items && entry.items[0]) || {}
  return {
    id: entry.id,
    date: entry.date,
    createdAt: entry.createdAt,
    weightKg: payload.weightKg ?? null,
    measurements: payload.measurements || {},
    feeling: payload.feeling ?? null,
    energy: payload.energy ?? null,
    sleep: payload.sleep ?? null,
    training: payload.training || '',
    notes: payload.notes || '',
  }
}

/** Guess a meal slot from the clock in the user's own timezone. */
function inferSlot(timezone = 'UTC') {
  let hour
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    }).format(new Date()))
  } catch {
    hour = new Date().getUTCHours()
  }
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 22) return 'dinner'
  return 'snack'
}

function sanitiseProfile(input) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }
  // The goal is whatever the user wrote. The direction is what the calorie
  // maths needs, so it is read out of those words — and an explicit direction
  // still wins, because the reading is a guess and the user is not.
  const goalText = String(input.goalText || '').trim().slice(0, 140)
  const goal = input.goal in GOALS
    ? input.goal
    : goalDirectionFrom(goalText, DEFAULT_PROFILE.goal)
  return {
    ...DEFAULT_PROFILE,
    name: String(input.name || '').slice(0, 60),
    sex: ['male', 'female', 'other'].includes(input.sex) ? input.sex : DEFAULT_PROFILE.sex,
    age: clamp(input.age, 13, 100, DEFAULT_PROFILE.age),
    heightCm: clamp(input.heightCm, 120, 230, DEFAULT_PROFILE.heightCm),
    weightKg: clamp(input.weightKg, 30, 400, DEFAULT_PROFILE.weightKg),
    baseline: input.baseline in BASELINE_LEVELS ? input.baseline : DEFAULT_PROFILE.baseline,
    goal,
    goalText,
    rateKgPerWeek: clamp(input.rateKgPerWeek, 0, 1.5, DEFAULT_PROFILE.rateKgPerWeek),
    timezone: String(input.timezone || DEFAULT_PROFILE.timezone).slice(0, 64),
    climate: input.climate in CLIMATES ? input.climate : DEFAULT_PROFILE.climate,
    region: String(input.region || '').trim().slice(0, 60),
    proteinPerKg: input.proteinPerKg ? clamp(input.proteinPerKg, 1.0, 3.5, null) : null,
    planId: input.planId && PLANS[input.planId] ? input.planId : null,
    planStart: isValidDate(input.planStart) ? input.planStart : null,
    eatBack: input.eatBack in EAT_BACK ? input.eatBack : DEFAULT_PROFILE.eatBack,
    onboarded: input.onboarded === true,
    planEdits: sanitisePlanEdits(input.planEdits),
  }
}

/**
 * Per-session plan edits: bounded, name-only, nothing executable. Shape:
 * { "<phase>|<session title>": { removed: [names], added: [{name}] } }
 */
function sanitisePlanEdits(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  for (const [key, value] of Object.entries(input).slice(0, 40)) {
    if (key.length > 80 || !value || typeof value !== 'object') continue
    const removed = (Array.isArray(value.removed) ? value.removed : [])
      .filter((n) => typeof n === 'string' && n.trim().length >= 2)
      .map((n) => n.trim().slice(0, 60))
      .slice(0, 20)
    const added = (Array.isArray(value.added) ? value.added : [])
      .filter((a) => a && typeof a.name === 'string' && a.name.trim().length >= 2)
      .map((a) => ({ name: a.name.trim().slice(0, 60) }))
      .slice(0, 20)
    if (removed.length || added.length) out[key] = { removed, added }
  }
  return out
}
