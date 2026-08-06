/**
 * HTTP API, shared by the Cloudflare Worker and the Node server.
 *
 * Runtime-agnostic on purpose: it takes a Request and a context object and
 * returns a Response, using only web-standard APIs available in both.
 */

import { parseMeal, parseWorkout, activityKcal, reweighFoodItem } from './parse.js'
import { buildDay, buildWeek, targetsFor, DEFAULT_PROFILE, BASELINE_LEVELS, GOALS } from './engine.js'
import { reviewDay, reviewWeek } from './coach.js'
import { recommendMeals, suggestDay, buildTasteProfile } from './recommend.js'
import { FOODS, FOODS_BY_ID } from './data/foods.js'
import { ACTIVITIES } from './data/activities.js'
import { issueToken, verifyToken, checkPasscode, extractToken, sessionCookie, clearedCookie } from './auth.js'
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
  return { meals, workouts, weights }
}

/**
 * Attach food tags to parsed items so the coach can reason about food quality
 * without needing the food database itself.
 */
function decorateFoodItems(items) {
  return items.map((item) => ({
    ...item,
    tags: item.foodId ? FOODS_BY_ID.get(item.foodId)?.tags || [] : [],
  }))
}

function decorateWorkoutItems(items, weightKg) {
  return items.map((item) => ({ ...item, kcal: activityKcal(item, weightKg) }))
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
    const { meals, workouts } = partition(byDate.get(date) || [])
    days.push(buildDay({ profile, meals, workouts, date }))
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
    if (!checkPasscode(body?.passcode, ctx.passcode)) {
      return error(401, 'Wrong passcode.')
    }
    const token = await issueToken(ctx.secret)
    return json({ token }, { headers: { 'set-cookie': sessionCookie(token) } })
  }

  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, { headers: { 'set-cookie': clearedCookie } })
  }

  // ---------------------------------------------------------- auth boundary
  const token = extractToken(request)
  if (!(await verifyToken(token, ctx.secret))) {
    return error(401, 'Not signed in.')
  }

  const { store } = ctx
  const profile = await store.getProfile()
  const today = todayIn(profile.timezone)

  // ------------------------------------------------------------------ profile
  if (path === '/profile') {
    if (method === 'GET') {
      return json({
        profile,
        targets: targetsFor(profile, 0),
        options: { baselines: BASELINE_LEVELS, goals: GOALS },
        today,
      })
    }
    if (method === 'PUT') {
      const body = await readJson(request)
      const next = sanitiseProfile({ ...profile, ...body })
      const saved = await store.setProfile(next)
      return json({ profile: saved, targets: targetsFor(saved, 0) })
    }
  }

  // -------------------------------------------------------------- parse only
  if (path === '/parse' && method === 'POST') {
    const body = await readJson(request)
    const kind = body?.kind === 'workout' ? 'workout' : 'meal'
    if (kind === 'meal') {
      return json({ kind, items: decorateFoodItems(parseMeal(body?.text || '')) })
    }
    return json({ kind, items: decorateWorkoutItems(parseWorkout(body?.text || ''), profile.weightKg) })
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
      await store.addEntry(entry)
      // Keep the profile weight current so energy targets track reality.
      await store.setProfile({ ...profile, weightKg: value })
      return json({ entry }, { status: 201 })
    }

    if (kind !== 'meal' && kind !== 'workout') return error(400, 'kind must be meal, workout or weight.')

    const text = String(body?.text || '').trim()
    let items = Array.isArray(body?.items) && body.items.length ? body.items : null

    if (!items) {
      if (!text) return error(400, 'Nothing to log.')
      items = kind === 'meal' ? parseMeal(text) : parseWorkout(text)
    }
    items = kind === 'meal'
      ? decorateFoodItems(items)
      : decorateWorkoutItems(items, profile.weightKg)

    const entry = {
      id: newId(),
      date,
      kind,
      slot: kind === 'meal' ? (body?.slot || inferSlot()) : null,
      raw: text,
      items,
      value: null,
      createdAt: new Date().toISOString(),
    }
    await store.addEntry(entry)
    return json({ entry }, { status: 201 })
  }

  const entryMatch = path.match(/^\/entries\/([\w-]+)$/)
  if (entryMatch) {
    const id = entryMatch[1]
    if (method === 'DELETE') {
      const removed = await store.deleteEntry(id)
      return removed ? json({ ok: true }) : error(404, 'Entry not found.')
    }
    if (method === 'PATCH') {
      const body = await readJson(request)
      const existing = await store.getEntry(id)
      if (!existing) return error(404, 'Entry not found.')

      const patch = {}
      if (isValidDate(body?.date)) patch.date = body.date
      if (body?.slot) patch.slot = body.slot

      if (Array.isArray(body?.items)) {
        patch.items = existing.kind === 'meal'
          ? decorateFoodItems(body.items)
          : decorateWorkoutItems(body.items, profile.weightKg)
      } else if (typeof body?.text === 'string') {
        patch.raw = body.text
        patch.items = existing.kind === 'meal'
          ? decorateFoodItems(parseMeal(body.text))
          : decorateWorkoutItems(parseWorkout(body.text), profile.weightKg)
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
            : decorateWorkoutItems(items, profile.weightKg)
        }
      }

      const updated = await store.updateEntry(id, patch)
      return json({ entry: updated })
    }
  }

  // --------------------------------------------------------------------- day
  if (path === '/day' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    // Pull a fortnight so the coach can see streaks and recent context.
    const from = addDays(date, -13)
    const entries = await store.listEntries(from, date)
    const todaysEntries = entries.filter((e) => e.date === date)
    const { meals, workouts, weights } = partition(todaysEntries)

    const days = buildDayRange(profile, entries, from, date)
    const day = days[days.length - 1]
    const review = reviewDay(day, profile, days.slice(0, -1))

    return json({
      date,
      day,
      review,
      entries: { meals, workouts, weights },
      remaining: {
        kcal: Math.round(day.targets.calories - day.caloriesIn),
        protein: Math.round(day.targets.protein - day.nutrition.protein),
      },
      isToday: date === today,
    })
  }

  // -------------------------------------------------------------------- week
  if (path === '/week' && method === 'GET') {
    const end = isValidDate(url.searchParams.get('end')) ? url.searchParams.get('end') : today
    const start = addDays(end, -6)
    const entries = await store.listEntries(start, end)
    const days = buildDayRange(profile, entries, start, end)
    const week = buildWeek(days)
    return json({ start, end, week, days, review: reviewWeek(week, profile, days) })
  }

  // ----------------------------------------------------------------- history
  if (path === '/history' && method === 'GET') {
    const to = isValidDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today
    const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days')) || 30))
    const from = addDays(to, -(days - 1))
    const entries = await store.listEntries(from, to)
    const built = buildDayRange(profile, entries, from, to)
    const weights = entries
      .filter((e) => e.kind === 'weight')
      .map((e) => ({ date: e.date, value: e.value }))
    return json({ from, to, days: built, weights })
  }

  // ------------------------------------------------------------------ review
  if (path === '/review' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const useAi = url.searchParams.get('ai') === '1' && isAiConfigured(ctx)
    const force = url.searchParams.get('refresh') === '1'

    if (!force) {
      const cached = await store.getReview(date)
      // Only trust a cached review for a day that has already finished.
      if (cached && date < today && cached.ai === useAi) return json({ ...cached, cached: true })
    }

    const from = addDays(date, -13)
    const entries = await store.listEntries(from, date)
    const days = buildDayRange(profile, entries, from, date)
    const day = days[days.length - 1]
    const rules = reviewDay(day, profile, days.slice(0, -1))

    let narrative = null
    if (useAi && day.logged) {
      narrative = await aiReview({ day, review: rules, profile, ctx }).catch(() => null)
    }

    const payload = { date, day, review: rules, narrative, ai: useAi }
    if (date < today) await store.setReview(date, payload)
    return json(payload)
  }

  // --------------------------------------------------------------- recommend
  if (path === '/recommend' && method === 'GET') {
    const date = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today
    const slot = url.searchParams.get('slot') || null
    const maxEffort = url.searchParams.get('maxEffort') ? Number(url.searchParams.get('maxEffort')) : null

    // Ninety days of history is plenty to learn tastes from without making the
    // query heavy.
    const historyEntries = await store.listEntries(addDays(date, -90), date)
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
    const historyEntries = await store.listEntries(addDays(date, -90), date)
    const history = historyEntries.filter((e) => e.kind === 'meal')
    const targets = targetsFor(profile, 0)
    return json(suggestDay({ profile, targets, history, today: date }))
  }

  if (path === '/taste' && method === 'GET') {
    const entries = await store.listEntries(addDays(today, -90), today)
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

/** Guess a meal slot from the clock when the client does not say. */
function inferSlot(date = new Date()) {
  const hour = date.getUTCHours()
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

function sanitiseProfile(input) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }
  return {
    ...DEFAULT_PROFILE,
    name: String(input.name || '').slice(0, 60),
    sex: ['male', 'female', 'other'].includes(input.sex) ? input.sex : DEFAULT_PROFILE.sex,
    age: clamp(input.age, 13, 100, DEFAULT_PROFILE.age),
    heightCm: clamp(input.heightCm, 120, 230, DEFAULT_PROFILE.heightCm),
    weightKg: clamp(input.weightKg, 30, 400, DEFAULT_PROFILE.weightKg),
    baseline: input.baseline in BASELINE_LEVELS ? input.baseline : DEFAULT_PROFILE.baseline,
    goal: input.goal in GOALS ? input.goal : DEFAULT_PROFILE.goal,
    rateKgPerWeek: clamp(input.rateKgPerWeek, 0, 1.5, DEFAULT_PROFILE.rateKgPerWeek),
    timezone: String(input.timezone || DEFAULT_PROFILE.timezone).slice(0, 64),
    proteinPerKg: input.proteinPerKg ? clamp(input.proteinPerKg, 1.0, 3.5, null) : null,
  }
}
