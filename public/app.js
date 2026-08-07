/**
 * Front end. Vanilla ES modules, no build step — what you read here is what
 * runs in the browser.
 */

/**
 * The movement guide is an enhancement, not a dependency: if its modules
 * fail to load (flaky network, mid-deploy cache), the core app still boots.
 */
let findMovement = () => null
let mountAnimation = null
let demoForExercise = () => null
const guideReady = Promise.all([import('./movements.js'), import('./anim.js'), import('./demos.js')])
  .then(([movements, anim, demos]) => {
    findMovement = movements.findMovement
    mountAnimation = anim.mountAnimation
    demoForExercise = demos.demoForExercise
  })
  .catch(() => {})

/**
 * A missing element must never crash the boot script — a service worker can
 * briefly pair an older index.html with newer code during a deploy, and one
 * null.addEventListener at the top level used to mean a blank white page.
 */
const missingWarned = new Set()
function $(id) {
  const el = document.getElementById(id)
  if (el) return el
  if (!missingWarned.has(id)) {
    missingWarned.add(id)
    console.warn(`Element #${id} is missing from this page version — its feature is disabled.`)
  }
  return document.createElement('input')
}

const state = {
  token: localStorage.getItem('ff_token') || null,
  date: null,
  today: null,
  kind: 'meal',
  slot: null,
  mealSlot: '',
  profile: null,
  parsed: null,
  view: 'today',
  statsPeriod: 'week',
  statsDate: null,          // anchor date for the stats view
  calMonth: null,           // 'YYYY-MM' shown in the calendars
  calMarks: {},             // date -> {net, logged} for calendar dots
  dayCache: null,           // last /api/day payload, reused by copy-for-coach
  lastLoggedId: null,       // entry to flash + auto-expand after saving
  expanded: new Set(),
}

// ------------------------------------------------------------------- utils

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  })
  // A 401 on /login or /signup is a wrong passcode, not an expired session -
  // let the real error message through for those.
  if (response.status === 401 && path !== '/login' && path !== '/signup') {
    signOut()
    throw new Error('Session expired. Sign in again.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

function toast(message, isError = false) {
  document.querySelector('.toast')?.remove()
  const el = document.createElement('div')
  el.className = `toast${isError ? ' error' : ''}`
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), isError ? 5000 : 2400)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function shiftDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function fmtDate(iso, opts) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...opts })
}

function litres(ml) { return `${(ml / 1000).toFixed(1)} L` }

// ------------------------------------------------------------------- theme

function applyTheme(next) {
  if (next === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = next
  if (next === 'auto') localStorage.removeItem('ff_theme')
  else localStorage.setItem('ff_theme', next)
}

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    // Cycle: whatever is showing -> the other one. "Auto" returns via a long
    // press being overkill; explicit is what people expect from a toggle.
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    applyTheme(current === 'dark' ? 'light' : 'dark')
  })
})

// -------------------------------------------------------------------- auth

let signupMode = false

function setSignupMode(on) {
  signupMode = on
  $('signup-name').classList.toggle('hidden', !on)
  $('login-submit').textContent = on ? 'Create & enter' : 'Unlock'
  $('login-switch').textContent = on
    ? 'Already have a passcode? Sign in'
    : 'New here? Create your passcode'
  $('login-error').textContent = ''
}

$('login-switch').addEventListener('click', () => {
  setSignupMode(!signupMode)
  ;(signupMode ? $('signup-name') : $('passcode')).focus()
})

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  $('login-error').textContent = ''
  try {
    const { token } = await api(signupMode ? '/signup' : '/login', {
      method: 'POST',
      body: JSON.stringify({
        passcode: $('passcode').value,
        ...(signupMode ? { name: $('signup-name').value } : {}),
      }),
    })
    state.token = token
    state.justSignedUp = signupMode // fresh accounts get blank onboarding fields
    localStorage.setItem('ff_token', token)
    $('passcode').value = ''
    $('signup-name').value = ''
    setSignupMode(false)   // next visitor to this screen is signing in
    await boot()
  } catch (error) {
    $('login-error').textContent = error.message
  }
})

function signOut() {
  state.token = null
  state.profile = null
  state.dayCache = null
  state.calMarks = {}
  localStorage.removeItem('ff_token')
  setSignupMode(false)
  $('app').classList.add('hidden')
  $('onboard').classList.add('hidden')
  $('login').classList.remove('hidden')
}

$('logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {})
  signOut()
})

// -------------------------------------------------------------- navigation

const VIEWS = ['today', 'plan', 'coach', 'body', 'stats', 'meals', 'pantry', 'you']

document.querySelectorAll('nav.tabs button, .side-nav button').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view))
})

function showView(view) {
  state.view = view
  for (const name of VIEWS) $(`view-${name}`).classList.toggle('hidden', name !== view)
  document.querySelectorAll('nav.tabs button, .side-nav button').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.view === view))
  })
  if (view === 'plan') { loadPlanOverview(); loadPlanSession() }
  if (view === 'coach') loadReview()
  if (view === 'stats') loadStats()
  if (view === 'body') loadBody()
  if (view === 'meals') loadRecommendations()
  if (view === 'pantry') { loadPantry(); loadIngredients() }
  if (view === 'you') renderBmi()
}

// ------------------------------------------------------------ date + strips

function setDate(date) {
  if (date > state.today) return
  state.date = date
  state.statsDate = date
  state.expanded = new Set()
  loadDay()
  renderWeekStrip()
  syncCalendars()
  if (state.view === 'coach') loadReview()
  if (state.view === 'stats') loadStats()
}

$('prev-day').addEventListener('click', () => setDate(shiftDate(state.date, -1)))
$('next-day').addEventListener('click', () => setDate(shiftDate(state.date, 1)))

function labelForDate(iso) {
  if (iso === state.today) return 'Today'
  if (iso === shiftDate(state.today, -1)) return 'Yesterday'
  return fmtDate(iso, { weekday: 'long' })
}

function renderWeekStrip() {
  const strip = $('week-strip')
  if (!strip) return
  // Week containing the selected date, Monday first.
  const selected = new Date(`${state.date}T00:00:00Z`)
  const dow = (selected.getUTCDay() + 6) % 7
  const monday = shiftDate(state.date, -dow)

  strip.innerHTML = ''
  for (let i = 0; i < 7; i += 1) {
    const date = shiftDate(monday, i)
    const mark = state.calMarks[date]
    const button = document.createElement('button')
    button.className = [
      date === state.date ? 'selected' : '',
      date > state.today ? 'future' : '',
      mark?.logged ? 'has-log' : '',
    ].join(' ')
    button.innerHTML = `<span>${fmtDate(date, { weekday: 'narrow' })}</span><b>${Number(date.slice(8))}</b><span class="dot"></span>`
    button.addEventListener('click', () => setDate(date))
    strip.appendChild(button)
  }
}

// --------------------------------------------------------------- calendars

async function loadCalMarks(monthISO) {
  try {
    const summary = await api(`/summary?period=month&date=${monthISO}-15`)
    for (const day of summary.days) {
      state.calMarks[day.date] = { logged: day.logged, net: day.net }
    }
  } catch { /* dots are decoration; the calendar still works without them */ }
}

function renderCalendar(container, monthISO) {
  const [year, month] = monthISO.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // Monday first

  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  container.innerHTML = `
    <div class="cal">
      <div class="cal-head">
        <span class="cal-title">${title}</span>
        <span class="cal-nav">
          <button class="icon-btn" data-cal="-1" aria-label="Previous month"><svg class="ico"><use href="#i-chev-l"/></svg></button>
          <button class="icon-btn" data-cal="1" aria-label="Next month"><svg class="ico"><use href="#i-chev-r"/></svg></button>
        </span>
      </div>
      <div class="cal-grid">
        ${dows.map((d) => `<span class="dow">${d}</span>`).join('')}
        ${'<span class="day blank"></span>'.repeat(lead)}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${monthISO}-${String(i + 1).padStart(2, '0')}`
          const mark = state.calMarks[date]
          const classes = ['day']
          if (date === state.date) classes.push('selected')
          if (date === state.today) classes.push('is-today')
          if (date > state.today) classes.push('future')
          if (mark?.logged) classes.push(mark.net > 0 ? 'surplus' : mark.net < 0 ? 'deficit' : 'logged-plain')
          return `<button class="${classes.join(' ')}" data-date="${date}">${i + 1}<span class="d-dot"></span></button>`
        }).join('')}
      </div>
    </div>`

  container.querySelectorAll('[data-cal]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation()
      const delta = Number(button.dataset.cal)
      const next = new Date(Date.UTC(year, month - 1 + delta, 1))
      state.calMonth = next.toISOString().slice(0, 7)
      await loadCalMarks(state.calMonth)
      syncCalendars()
    })
  })
  container.querySelectorAll('[data-date]').forEach((button) => {
    button.addEventListener('click', () => {
      setDate(button.dataset.date)
      $('cal-sheet').classList.add('hidden')
    })
  })
}

function syncCalendars() {
  const month = state.calMonth || state.date.slice(0, 7)
  const side = $('side-cal')
  if (side) renderCalendar(side, month)
  const sheet = $('sheet-cal')
  if (sheet && !$('cal-sheet').classList.contains('hidden')) renderCalendar(sheet, month)
}

$('open-cal').addEventListener('click', () => {
  $('cal-sheet').classList.remove('hidden')
  renderCalendar($('sheet-cal'), state.calMonth || state.date.slice(0, 7))
})
$('cal-close').addEventListener('click', () => $('cal-sheet').classList.add('hidden'))
$('cal-sheet').addEventListener('click', (event) => {
  if (event.target === $('cal-sheet')) $('cal-sheet').classList.add('hidden')
})

// ------------------------------------------------------------- entry input

$('kind-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  state.kind = button.dataset.kind
  document.querySelectorAll('#kind-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))

  const isMeal = state.kind === 'meal'
  const isWeight = state.kind === 'weight'
  $('slot-seg').classList.toggle('hidden', !isMeal)
  $('entry-text').placeholder = isWeight
    ? '114.2'
    : isMeal
      ? '2 eggs, 3 rashers bacon, wholemeal toast and a black coffee'
      : 'bench 3×8 80kg, lat pulldown 4×12 70kg, then 20 min treadmill'
  $('entry-text').inputMode = isWeight ? 'decimal' : 'text'
  $('logger-hint').textContent = isWeight
    ? 'Just the number, in kilograms. This also updates the weight your targets are based on.'
    : isMeal
      ? 'Type it how you\'d say it — "200g chicken", "2 slices toast", "large pizza".'
      : 'Lifts take sets and reps: "bench 3x8 80kg". Cardio takes distance and time: "ran 5k in 26 min".'
  clearPreview()
})

$('slot-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  const already = button.getAttribute('aria-pressed') === 'true'
  state.slot = already ? null : button.dataset.slot
  document.querySelectorAll('#slot-seg button').forEach((b) => b.setAttribute('aria-pressed', String(!already && b === button)))
})

let parseTimer
$('entry-text').addEventListener('input', () => {
  clearTimeout(parseTimer)
  if (state.kind === 'weight' || !$('entry-text').value.trim()) return clearPreview()
  parseTimer = setTimeout(previewParse, 400)
})

async function previewParse() {
  const text = $('entry-text').value.trim()
  if (!text) return clearPreview()
  try {
    const { items } = await api('/parse', {
      method: 'POST',
      body: JSON.stringify({ kind: state.kind, text }),
    })
    state.parsed = items
    renderPreview(items)
  } catch { clearPreview() }
}

function clearPreview() {
  state.parsed = null
  $('preview').innerHTML = ''
}

function renderPreview(items) {
  const container = $('preview')
  container.innerHTML = ''

  for (const [index, item] of items.entries()) {
    const row = document.createElement('div')
    row.className = `preview-item${item.recognised ? '' : ' unknown'}`

    const left = document.createElement('div')
    let chips = null
    if (!item.recognised) {
      left.innerHTML = `<div>${escapeHtml(item.raw)}</div><div class="sub">Not recognised — this won't be counted</div>`
      if (item.suggestions?.length) {
        chips = document.createElement('div')
        chips.className = 'didyoumean'
        chips.innerHTML = '<span class="lead">Did you mean</span>'
        for (const suggestion of item.suggestions) {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.textContent = suggestion.name
          chip.addEventListener('click', () => {
            // Swap the unrecognised phrase for the suggestion, keeping any
            // leading quantity ("2 shwarma" -> "2 Chicken shawarma (wrap)").
            const quantity = item.raw.match(/^[\d.]+\s*/)?.[0] || ''
            const cleanName = suggestion.name.replace(/\s*\(.*?\)\s*$/, '')
            $('entry-text').value = $('entry-text').value.replace(item.raw, quantity + cleanName)
            previewParse()
          })
          chips.appendChild(chip)
        }
      }
    } else if (state.kind === 'meal') {
      const portion = item.portion ? ` · about ${item.portion.count} ${escapeHtml(item.portion.unit)}` : ''
      const units = item.units ? ` · ${item.units} units` : ''
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal · ${item.protein} g protein${portion}${units}</div>`
    } else if (item.exercise) {
      const vol = item.exercise.volume ? ` · ${item.exercise.volume.toLocaleString()} kg volume` : ''
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">~${item.minutes} min · ${item.kcal} kcal${vol}</div>`
    } else {
      const extras = [item.distanceKm ? `${item.distanceKm} km` : null, item.heatAdjusted ? 'heat adjusted' : null].filter(Boolean)
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal${extras.length ? ' · ' + extras.join(' · ') : ''}</div>`
    }
    row.appendChild(left)
    if (chips) row.appendChild(chips)

    if (item.recognised) {
      const input = document.createElement('input')
      input.type = 'number'
      input.inputMode = 'numeric'
      input.min = '0'
      input.value = state.kind === 'meal' ? item.grams : item.minutes
      input.setAttribute('aria-label', state.kind === 'meal' ? 'Grams' : 'Minutes')
      input.addEventListener('change', () => adjust(index, Number(input.value)))
      row.appendChild(input)
    }
    container.appendChild(row)
  }

  if (state.kind === 'meal' && items.length) {
    const total = items.reduce((sum, item) => sum + (item.kcal || 0), 0)
    const note = document.createElement('div')
    note.className = 'hint'
    note.textContent = `${Math.round(total)} kcal total. Tap a number to correct the portion.`
    container.appendChild(note)
  }
}

/** Local rescale so corrections feel instant; the server recomputes on save. */
function adjust(index, amount) {
  const item = state.parsed?.[index]
  if (!item || !Number.isFinite(amount) || amount < 0) return
  if (state.kind === 'meal') {
    const factor = item.grams > 0 ? amount / item.grams : 0
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar']) {
      item[key] = Math.round((item[key] || 0) * factor * 10) / 10
    }
    item.kcal = Math.round(item.kcal)
    item.grams = amount
    item.portion = null
  } else {
    const factor = item.minutes > 0 ? amount / item.minutes : 0
    item.kcal = Math.round((item.kcal || 0) * factor)
    item.minutes = amount
  }
  renderPreview(state.parsed)
}

$('clear-entry').addEventListener('click', () => {
  $('entry-text').value = ''
  clearPreview()
})

$('save-entry').addEventListener('click', async () => {
  const text = $('entry-text').value.trim()
  if (!text) return toast('Nothing to log.', true)
  const button = $('save-entry')
  button.disabled = true
  try {
    let saved
    if (state.kind === 'weight') {
      saved = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({ kind: 'weight', date: state.date, value: Number(text) }),
      })
    } else {
      saved = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
          kind: state.kind,
          date: state.date,
          slot: state.slot || undefined,
          text,
          items: state.parsed || undefined,
        }),
      })
    }
    state.lastLoggedId = saved.entry?.id || null
    if (state.lastLoggedId) state.expanded.add(state.lastLoggedId)
    toast('Logged.')
    $('entry-text').value = ''
    clearPreview()
    await loadDay()
    delete state.calMarks[state.date]
    await loadCalMarks(state.date.slice(0, 7))
    renderWeekStrip()
    syncCalendars()
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.disabled = false
  }
})

// ----------------------------------------------------------------- the day

async function loadDay() {
  const data = await api(`/day?date=${state.date}`)
  state.dayCache = data

  const name = state.profile?.name ? state.profile.name.split(' ')[0] : ''
  $('greeting').textContent = state.date === state.today && name
    ? `${labelForDate(state.date)}, ${name}`
    : labelForDate(state.date)
  $('date-label').textContent = fmtDate(state.date, { day: 'numeric', month: 'long', year: 'numeric' })
  $('next-day').disabled = state.date >= state.today
  const streak = `${data.streak} day${data.streak === 1 ? '' : 's'}`
  $('streak-n').textContent = data.streak
  const sideStreak = $('side-streak')
  if (sideStreak) sideStreak.textContent = streak
  const sideToday = $('side-today')
  if (sideToday) sideToday.textContent = fmtDate(state.today, { weekday: 'long', day: 'numeric', month: 'long' })

  const { day } = data

  // Hero ring: how much of the calorie budget is used.
  const used = day.targets.calories ? Math.min(1.35, day.caloriesIn / day.targets.calories) : 0
  const circumference = 2 * Math.PI * 52
  const ring = $('ring-fill')
  ring.style.strokeDashoffset = String(circumference * (1 - Math.min(1, used)))
  ring.style.stroke = used > 1.05 ? 'var(--bad)' : used > 0.92 ? 'var(--warn)' : 'var(--accent)'

  const left = Math.round(day.targets.calories - day.caloriesIn)
  const credit = day.targets.exerciseCredit || 0
  $('ring-big').textContent = Math.abs(left).toLocaleString()
  $('ring-sub').textContent = left >= 0
    ? credit > 0 ? `kcal left · +${credit.toLocaleString()} trained` : 'kcal left'
    : 'kcal over'

  $('kcal-in').textContent = Math.round(day.caloriesIn).toLocaleString()
  $('kcal-out').textContent = Math.round(day.caloriesOut).toLocaleString()
  $('net-label').textContent = day.deficit >= 0 ? 'Deficit' : 'Surplus'
  $('net-figure').textContent = Math.abs(Math.round(day.net)).toLocaleString()
  $('net-figure').style.color = day.caloriesIn === 0 ? 'var(--muted)' : day.deficit >= 0 ? 'var(--good)' : 'var(--bad)'

  renderBars(day)
  renderWater(day)
  renderEntries(data.entries)
  state.lastLoggedId = null
  loadPlanDay().catch(() => {})
}

// ---------------------------------------------------------------- the plan

async function loadPlanDay() {
  const card = $('plan-card')
  if (!state.profile?.planId) { card.classList.add('hidden'); return }
  const data = await api(`/plan-day?date=${state.date}`)
  if (!data.plan || !data.day) { card.classList.add('hidden'); return }
  renderPlanCard(data.day)
  card.classList.remove('hidden')
}

function renderPlanCard(day) {
  const note = $('plan-card-note')
  const blocks = $('plan-blocks')
  blocks.innerHTML = ''
  note.classList.add('hidden')

  if (day.status === 'upcoming') {
    $('plan-card-title').textContent = day.planName
    $('plan-card-week').textContent = ''
    note.textContent = `Starts in ${day.daysUntil} day${day.daysUntil === 1 ? '' : 's'}. The first session is waiting.`
    note.classList.remove('hidden')
    return
  }
  if (day.status === 'complete') {
    $('plan-card-title').textContent = day.planName
    $('plan-card-week').textContent = 'Done'
    note.textContent = 'The six months are complete. Keep the sessions you liked — that was always the point.'
    note.classList.remove('hidden')
    return
  }

  $('plan-card-title').textContent = day.phase
    ? `${day.planName} · ${day.phase.name}`
    : day.planName
  $('plan-card-week').textContent = [
    `Week ${day.week}/${day.weeks}`,
    day.deload ? 'Deload' : null,
    day.testWeek ? 'Test week' : null,
  ].filter(Boolean).join(' · ')

  if (day.restNote) {
    note.textContent = day.restNote
    note.classList.remove('hidden')
  }

  for (const block of day.blocks) {
    blocks.appendChild(renderPlanBlock(block))
  }
}

function renderPlanBlock(block) {
  const wrap = document.createElement('div')
  wrap.className = `plan-block${block.entryId ? ' done' : ''}${block.optional ? ' optional' : ''}`

  const left = document.createElement('div')
  left.className = 'plan-block-body'
  const label = block.kind === 'meal'
    ? `<span class="plan-slot">${escapeHtml(block.slot)}</span>`
    : block.key === 'lift' ? '<span class="plan-slot">gym</span>'
      : block.key === 'steps' ? '<span class="plan-slot">steps</span>'
        : `<span class="plan-slot">cardio${block.optional ? ' · optional' : ''}</span>`
  left.innerHTML = `
    ${label}
    <div class="plan-title">${escapeHtml(block.title)}</div>
    ${block.detail ? `<div class="plan-detail">${escapeHtml(block.detail)}</div>` : ''}
    ${block.desc ? `<div class="plan-detail faint">${escapeHtml(block.desc)}</div>` : ''}
    ${block.exercises ? `<ul class="plan-ex">${block.exercises.map((e) => `
      <li><span>${escapeHtml(e.name)}</span><span class="plan-ex-spec">${e.sets} × ${escapeHtml(String(e.reps))}</span>${e.note ? `<span class="plan-ex-note">${escapeHtml(e.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}`

  // Any exercise or cardio line with a movement guide opens it on tap.
  if (block.exercises) {
    left.querySelectorAll('.plan-ex li').forEach((li, index) => attachGuide(li, block.exercises[index].name))
  } else if (block.kind === 'workout' && block.key !== 'steps') {
    attachGuide(left.querySelector('.plan-title'), block.title)
  }

  const action = document.createElement('button')
  action.className = `btn small plan-confirm${block.entryId ? ' confirmed' : ''}`
  action.innerHTML = block.entryId
    ? '<svg class="ico"><use href="#i-check"/></svg> Logged'
    : block.kind === 'meal' ? 'Ate this' : 'Did it'
  action.addEventListener('click', async () => {
    action.disabled = true
    try {
      if (block.entryId) {
        await api(`/entries/${block.entryId}`, { method: 'DELETE' })
        toast('Unlogged.')
      } else {
        await api('/plan-day/confirm', {
          method: 'POST',
          body: JSON.stringify({ date: state.date, key: block.key }),
        })
        toast(block.kind === 'meal' ? `${block.title} logged.` : 'Logged. Good.')
      }
      await loadDay()
      delete state.calMarks[state.date]
      await loadCalMarks(state.date.slice(0, 7))
      renderWeekStrip()
      syncCalendars()
    } catch (error) {
      toast(error.message, true)
    } finally {
      action.disabled = false
    }
  })

  wrap.appendChild(left)
  wrap.appendChild(action)
  return wrap
}

// ---------------------------------------------------------- food audit

const AUDIT_ICONS = { cut: '✂', swap: '⇄', keep: '★', note: '·' }

$('analyse-day').addEventListener('click', async () => {
  $('audit-sheet').classList.remove('hidden')
  $('audit-date').textContent = labelForDate(state.date)
  $('audit-headline').textContent = 'Reading the day…'
  $('audit-findings').innerHTML = ''
  $('audit-potential').textContent = ''
  try {
    const data = await api(`/food-audit?date=${state.date}`)
    $('audit-headline').textContent = data.headline
    const fatRows = data.findings.filter((f) => f.kind === 'fat')
    const fatBlock = fatRows.length
      ? `<h3 class="audit-section">High in fat${data.fatTotal ? ` · ${data.fatTotal} g of fat today` : ''}</h3>` +
        fatRows.map((f) => `
          <div class="finding audit-fat">
            <span class="audit-ico">◆</span>
            <div><b>${escapeHtml(f.item)}</b>
              <div class="audit-why">${escapeHtml(f.why)}</div></div>
            <span class="audit-save fat">${f.fatG} g</span>
          </div>`).join('')
      : ''
    const renderFinding = (f) => {
      if (f.kind === 'swap') {
        return `<div class="finding audit-${f.kind}">
          <span class="audit-ico">${AUDIT_ICONS[f.kind]}</span>
          <div><b>${escapeHtml(f.item)}</b> (${f.itemKcal} kcal)
            ${f.swapTo ? `→ <b>${escapeHtml(f.swapTo)}</b>` : ''}
            <div class="audit-why">${escapeHtml(f.why)}</div></div>
          ${f.saveKcal ? `<span class="audit-save">−${f.saveKcal}</span>` : ''}
        </div>`
      }
      if (f.kind === 'cut') {
        return `<div class="finding audit-cut">
          <span class="audit-ico">${AUDIT_ICONS.cut}</span>
          <div><b>${escapeHtml(f.item)}</b> — cut it
            <div class="audit-why">${escapeHtml(f.why)}</div></div>
          <span class="audit-save">−${f.saveKcal}</span>
        </div>`
      }
      if (f.kind === 'keep') {
        return `<div class="finding good audit-keep">
          <span class="audit-ico">${AUDIT_ICONS.keep}</span>
          <div><b>${escapeHtml(f.item)}</b> — keep it
            <div class="audit-why">${escapeHtml(f.why)}</div></div>
        </div>`
      }
      return `<div class="finding note audit-note">${escapeHtml(f.why)}</div>`
    }
    // Order: what to change, then the fat ledger, then praise and patterns.
    const actionable = data.findings.filter((f) => f.kind === 'swap' || f.kind === 'cut').map(renderFinding).join('')
    const rest = data.findings.filter((f) => f.kind === 'keep' || f.kind === 'note').map(renderFinding).join('')
    $('audit-findings').innerHTML = (actionable + fatBlock + rest)
      || '<p class="empty">Log some food first — then there is something to analyse.</p>'
    if (data.potential) {
      $('audit-potential').textContent =
        `Take the lot and today lands at ${data.potential.wouldBe.toLocaleString()} kcal ` +
        `(target ${data.potential.target.toLocaleString()}) — ` +
        (data.potential.onTarget ? 'inside your target.' : 'closer, but still over.')
    }
  } catch (error) {
    $('audit-headline').textContent = error.message
  }
})

$('audit-close').addEventListener('click', () => $('audit-sheet').classList.add('hidden'))
$('audit-sheet').addEventListener('click', (event) => {
  if (event.target === $('audit-sheet')) $('audit-sheet').classList.add('hidden')
})

// --------------------------------------------------------- movement guide

let moveAnim = null

function openMovement(movement) {
  if (!movement || !mountAnimation) return
  $('move-name').textContent = movement.name
  $('move-muscles').textContent = movement.muscles

  moveAnim?.destroy()
  $('move-anim').innerHTML = ''
  moveAnim = mountAnimation($('move-anim'), { ...movement.anim, name: movement.name })

  $('move-body').innerHTML = `
    <div class="move-feel"><b>Where you should feel it.</b> ${escapeHtml(movement.feel)}</div>
    <h3>Set up</h3>
    <p class="move-text">${escapeHtml(movement.setup)}</p>
    <h3>How to do it</h3>
    <ol class="move-list">${movement.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <h3>Where it goes wrong</h3>
    <ul class="move-list wrong">${movement.wrong.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
    <div class="move-cue">${escapeHtml(movement.cue)}</div>`

  $('move-sheet').classList.remove('hidden')
  document.querySelector('.move-panel').scrollTop = 0
}

function closeMovement() {
  moveAnim?.destroy()
  moveAnim = null
  $('move-sheet').classList.add('hidden')
}

$('move-close').addEventListener('click', closeMovement)
$('move-sheet').addEventListener('click', (event) => {
  if (event.target === $('move-sheet')) closeMovement()
})

/** Make an element open the guide for `name` when a guide exists for it. */
function attachGuide(element, name) {
  const movement = findMovement(name)
  if (!movement) return false
  element.classList.add('has-guide')
  element.setAttribute('role', 'button')
  element.setAttribute('tabindex', '0')
  const open = () => openMovement(movement)
  element.addEventListener('click', open)
  element.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
  return true
}

async function loadPlanOverview() {
  const container = $('plan-overview')
  container.innerHTML = '<p class="spinner">Loading…</p>'
  await guideReady
  try {
    if (!state.profile?.planId) {
      container.innerHTML = `<div class="card"><h2>No plan attached</h2>
        <p class="hint">Pick a plan under You → Training plan and the full six months appears here,
        day by day, with confirm buttons on the Today screen.</p></div>`
      return
    }
    const data = await api('/plan-overview')
    if (!data.plan) {
      container.innerHTML = '<div class="card"><p class="empty">No plan attached to this profile.</p></div>'
      return
    }
    renderPlanOverview(container, data)
  } catch (error) {
    container.innerHTML = `<div class="card"><p class="empty">${escapeHtml(error.message)}</p></div>`
  }
}

function renderPlanOverview(container, { plan, startDate, endDate, currentWeek }) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const gymLabel = plan.gymDays.map((d) => dayNames[d]).join(' / ')

  const phaseCards = plan.phases.map((phase) => {
    const isNow = currentWeek && currentWeek >= phase.weeks[0] && currentWeek <= phase.weeks[1]
    const dates = phase.from ? `<span class="plan-phase-dates">${fmtDate(phase.from, { day: 'numeric', month: 'short' })} – ${fmtDate(phase.to, { day: 'numeric', month: 'short' })}</span>` : ''
    return `
      <div class="plan-phase${isNow ? ' now' : ''}">
        <div class="plan-phase-head">
          <span class="plan-phase-n serif">0${phase.number}</span>
          <div>
            <div class="plan-phase-name">${escapeHtml(phase.name)}${isNow ? ' <span class="tag-now">You are here</span>' : ''}</div>
            <div class="plan-phase-weeks">Weeks ${phase.weeks[0]}–${phase.weeks[1]} ${dates}</div>
          </div>
        </div>
        <p class="plan-detail">${escapeHtml(phase.focus)}</p>
        <p class="plan-detail faint">${phase.scheme.sets} sets × ${escapeHtml(phase.scheme.reps)} · ${escapeHtml(phase.scheme.effort)} · rest ${escapeHtml(phase.scheme.rest)}</p>
        <div class="plan-sessions">
          ${phase.sessions.map((s) => `
            <div class="plan-session" data-skey="${phase.number}|${escapeHtml(s.title)}">
              <div class="plan-session-title">${escapeHtml(s.title)}</div>
              <ul>${s.exercises.map((e) => `
                <li data-ex="${escapeHtml(e.name)}">
                  <span class="pex">${escapeHtml(e.name)}${e.addedByUser ? ' <em class="added-tag">yours</em>' : ''}</span>
                  <button type="button" class="px-del" aria-label="Remove ${escapeHtml(e.name)} from this session">✕</button>
                </li>`).join('')}</ul>
              <button type="button" class="px-add">+ Add from the menu</button>
            </div>`).join('')}
        </div>
        ${phase.cardio.length ? `<p class="plan-detail"><b>Cardio:</b> ${phase.cardio.map((c) => escapeHtml(c.title)).join(' · ')}</p>` : ''}
      </div>`
  }).join('')

  const mealCols = ['breakfast', 'lunch', 'dinner', 'snack'].map((slot) => `
    <div class="plan-session">
      <div class="plan-session-title">${slot[0].toUpperCase()}${slot.slice(1)}</div>
      <ul>${plan.meals[slot].map((m) => `<li>${escapeHtml(m.name)} <span class="plan-ex-spec">${m.kcal} kcal · ${m.protein}g P</span></li>`).join('')}</ul>
    </div>`).join('')

  container.innerHTML = `
    <div class="card">
      <h2 class="serif" style="font-size:1.5rem">${escapeHtml(plan.name)}</h2>
      <p class="plan-detail">${plan.weeks} weeks · gym ${gymLabel} · ${plan.stepsTarget.toLocaleString()} steps a day ·
        ${plan.kcal.toLocaleString()} kcal · ${plan.macros.protein} g protein / ${plan.macros.carbs} g carbs / ${plan.macros.fat} g fat</p>
      ${startDate ? `<p class="plan-detail faint">${fmtDate(startDate, { day: 'numeric', month: 'long', year: 'numeric' })} → ${fmtDate(endDate, { day: 'numeric', month: 'long', year: 'numeric' })}${currentWeek ? ` · week ${currentWeek} of ${plan.weeks}` : ''} · deloads on weeks ${plan.deloadWeeks.join(', ')} · test week ${plan.testWeek}</p>` : ''}
    </div>
    ${phaseCards}
    <div class="card" id="movement-guide-card">
      <h2>The movements</h2>
      <p class="hint">Tap any movement for the animated form guide — here, in the sessions above,
        or on the Today card. Watch it a few times before your first set.</p>
      <div class="move-grid" id="move-grid"></div>
    </div>
    <div class="card">
      <h2>The meal bank</h2>
      <p class="hint">Each day the plan deals you one from each column — swap within a column freely, the numbers stay honest.</p>
      <div class="plan-sessions">${mealCols}</div>
    </div>
    <div class="card">
      <h2>House rules</h2>
      ${plan.rules.map((r) => `<div class="finding note">${escapeHtml(r)}</div>`).join('')}
    </div>`

  // Every exercise line in the phase cards opens its movement guide, and the
  // edit buttons make the plan yours: ✕ removes a lift from that session for
  // good, "+ Add" pulls one in from the exercise menu.
  container.querySelectorAll('.plan-phase .plan-session li .pex').forEach((span) =>
    attachGuide(span, span.textContent))
  container.querySelectorAll('.plan-phase .plan-session .px-del').forEach((button) => {
    button.addEventListener('click', () => {
      const li = button.closest('li')
      const skey = button.closest('.plan-session').dataset.skey
      const name = li.dataset.ex
      savePlanEdit(skey, (edit) => {
        const lower = name.toLowerCase()
        if (edit.added.some((a) => a.name.toLowerCase() === lower)) {
          edit.added = edit.added.filter((a) => a.name.toLowerCase() !== lower)
        } else if (!edit.removed.some((n) => n.toLowerCase() === lower)) {
          edit.removed.push(name)
        }
      })
    })
  })
  container.querySelectorAll('.plan-phase .plan-session .px-add').forEach((button) => {
    button.addEventListener('click', () =>
      openExercisePicker(`plan-edit:${button.closest('.plan-session').dataset.skey}`))
  })

  // Thumbnail grid of every distinct movement this plan uses.
  const seen = new Map()
  for (const phase of plan.phases) {
    for (const session of phase.sessions) {
      for (const exercise of session.exercises) {
        const movement = findMovement(exercise.name)
        if (movement) seen.set(movement.id, movement)
      }
    }
    for (const c of phase.cardio) {
      const movement = findMovement(c.title)
      if (movement) seen.set(movement.id, movement)
    }
    if (phase.restCardio) {
      const movement = findMovement(phase.restCardio.title)
      if (movement) seen.set(movement.id, movement)
    }
  }
  const grid = container.querySelector('#move-grid')
  if (!mountAnimation) {
    container.querySelector('#movement-guide-card')?.classList.add('hidden')
    return
  }
  for (const movement of seen.values()) {
    const tile = document.createElement('button')
    tile.className = 'move-tile'
    tile.type = 'button'
    const thumb = document.createElement('div')
    thumb.className = 'move-thumb'
    mountAnimation(thumb, { ...movement.anim, name: movement.name, thumb: movement.anim.poses.length - 1 }, { static: true })
    tile.appendChild(thumb)
    const label = document.createElement('span')
    label.textContent = movement.name
    tile.appendChild(label)
    tile.addEventListener('click', () => openMovement(movement))
    grid.appendChild(tile)
  }
}

function renderBars(day) {
  const rows = [
    { label: 'Protein', value: day.nutrition.protein, target: day.targets.protein, unit: 'g' },
    { label: 'Carbs', value: day.nutrition.carbs, target: day.targets.carbs, unit: 'g' },
    { label: 'Fat', value: day.nutrition.fat, target: day.targets.fat, unit: 'g' },
    { label: 'Fibre', value: day.nutrition.fibre, target: day.targets.fibre, unit: 'g' },
  ]
  $('bars').innerHTML = rows.map((row) => {
    const pct = row.target ? (row.value / row.target) * 100 : 0
    const tone = row.label === 'Fat'
      ? (pct > 115 ? 'bad' : pct > 100 ? 'warn' : 'good')
      : (pct >= 90 ? 'good' : pct >= 60 ? 'warn' : 'bad')
    return `
      <div class="bar-row">
        <span class="label">${row.label}</span>
        <span class="bar-track"><span class="bar-fill ${tone}" style="width:${Math.min(100, Math.max(0, pct))}%"></span></span>
        <span class="value">${Math.round(row.value)}${row.unit} / ${Math.round(row.target)}${row.unit}</span>
      </div>`
  }).join('')
}

function renderWater(day) {
  const target = day.targets.waterMl || 0
  const pct = target ? Math.min(100, (day.waterMl / target) * 100) : 0
  $('water-fill').style.width = `${pct}%`
  $('water-label').textContent = `${litres(day.waterMl)} / ${litres(target)}`
  const sideWater = $('side-water')
  if (sideWater) sideWater.textContent = litres(day.waterMl)
}

document.querySelectorAll('.water-actions [data-ml]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await api('/entries', {
        method: 'POST',
        body: JSON.stringify({ kind: 'water', date: state.date, value: Number(button.dataset.ml) }),
      })
      await loadDay()
    } catch (error) { toast(error.message, true) }
  })
})

$('water-undo').addEventListener('click', async () => {
  const waters = state.dayCache?.entries?.waters || []
  const last = waters[waters.length - 1]
  if (!last) return toast('No water logged today.', true)
  await api(`/entries/${last.id}`, { method: 'DELETE' })
  await loadDay()
})

// ---------------------------------------------------------------- log list

function renderEntries({ meals, workouts, weights }) {
  const container = $('entries')
  container.innerHTML = ''

  const all = [
    ...meals.map((entry) => ({ entry, kind: 'meal' })),
    ...workouts.map((entry) => ({ entry, kind: 'workout' })),
    ...weights.map((entry) => ({ entry, kind: 'weight' })),
  ].sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt))

  if (!all.length) {
    container.innerHTML = '<p class="empty">Nothing logged yet. The blank page is the enemy.</p>'
    return
  }

  for (const { entry, kind } of all) {
    container.appendChild(renderEntry(entry, kind))
  }
}

function renderEntry(entry, kind) {
  const wrap = document.createElement('div')
  wrap.className = 'entry'
  if (entry.id === state.lastLoggedId) wrap.classList.add('flash')

  const kcal = (entry.items || []).reduce((sum, item) => sum + (item.kcal || 0), 0)
  const names = (entry.items || []).map((item) => item.exercise ? item.exercise.name : item.name)
  const title = kind === 'weight' ? `Weigh-in — ${entry.value} kg` : (names.join(', ') || entry.raw)
  const minutes = (entry.items || []).reduce((sum, item) => sum + (item.minutes || 0), 0)
  const volume = (entry.items || []).reduce((sum, item) => sum + (item.exercise?.volume || 0), 0)
  const heat = (entry.items || []).some((item) => item.heatAdjusted)

  const sub = kind === 'meal'
    ? (entry.slot || 'meal')
    : kind === 'workout'
      ? `${minutes} min${volume ? ` · ${volume.toLocaleString()} kg volume` : ''}${heat ? ' · heat adjusted' : ''}`
      : ''

  const row = document.createElement('button')
  row.className = 'entry-row'
  row.innerHTML = `
    <span>
      <span class="title">${escapeHtml(title)}</span>
      ${sub ? `<span class="sub" style="display:block">${escapeHtml(sub)}</span>` : ''}
    </span>
    <span class="kcal">${kind === 'weight' ? '' : `${kind === 'workout' ? '−' : ''}${Math.round(kcal).toLocaleString()}`}</span>
    <span class="del" role="button" aria-label="Delete entry" tabindex="0"><svg class="ico"><use href="#i-x"/></svg></span>`

  row.querySelector('.del').addEventListener('click', async (event) => {
    event.stopPropagation()
    await api(`/entries/${entry.id}`, { method: 'DELETE' })
    await loadDay()
  })

  if (kind !== 'weight' && (entry.items || []).length) {
    row.addEventListener('click', () => {
      if (state.expanded.has(entry.id)) state.expanded.delete(entry.id)
      else state.expanded.add(entry.id)
      const existing = wrap.querySelector('.entry-detail')
      if (existing) existing.remove()
      else wrap.appendChild(renderEntryDetail(entry, kind))
    })
  }

  wrap.appendChild(row)
  if (state.expanded.has(entry.id) && kind !== 'weight' && (entry.items || []).length) {
    wrap.appendChild(renderEntryDetail(entry, kind))
  }
  return wrap
}

/** The per-item breakdown: verify, correct, or remove each parsed item. */
function renderEntryDetail(entry, kind) {
  const detail = document.createElement('div')
  detail.className = 'entry-detail'

  entry.items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'detail-item'

    if (kind === 'meal' && item.fromPlan) {
      // Plan meals are fixed recipes; there is no gram figure to adjust.
      row.innerHTML = `
        <span>${escapeHtml(item.name)}<span class="meta" style="display:block">${item.kcal} kcal · ${item.protein}g P · from the plan</span></span>
        <span></span><span class="meta"></span>`
    } else if (kind === 'meal') {
      const portion = item.portion ? ` · ~${item.portion.count} ${item.portion.unit}` : ''
      const units = item.units ? ` · ${item.units} units` : ''
      row.innerHTML = `
        <span>${escapeHtml(item.name)}<span class="meta" style="display:block">${item.kcal} kcal · ${item.protein}g P${portion}${units}</span></span>
        <input type="number" inputmode="numeric" min="0" value="${item.grams}" aria-label="Grams">
        <span class="meta">g</span>`
    } else if (item.exercise) {
      const ex = item.exercise
      const spec = [ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null, ex.weightKg ? `@ ${ex.weightKg} kg` : null].filter(Boolean).join(' ')
      row.innerHTML = `
        <span>${escapeHtml(ex.name)}<span class="meta" style="display:block">${spec}${ex.volume ? ` · ${ex.volume.toLocaleString()} kg volume` : ''} · ${item.kcal} kcal</span></span>
        <span></span><span class="meta">${item.minutes} min</span>`
    } else {
      row.innerHTML = `
        <span>${escapeHtml(item.name)}<span class="meta" style="display:block">${item.kcal} kcal${item.heatAdjusted ? ' · heat adjusted' : ''}</span></span>
        <input type="number" inputmode="numeric" min="1" value="${item.minutes}" aria-label="Minutes">
        <span class="meta">min</span>`
    }

    const input = row.querySelector('input')
    if (input) {
      input.addEventListener('change', async () => {
        const value = Number(input.value)
        if (!Number.isFinite(value) || value <= 0) return
        await api(`/entries/${entry.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ reweigh: kind === 'meal' ? { index, grams: value } : { index, minutes: value } }),
        })
        await loadDay()
      })
    }

    const remove = document.createElement('button')
    remove.className = 'mini'
    remove.setAttribute('aria-label', 'Remove item')
    remove.innerHTML = '<svg class="ico"><use href="#i-x"/></svg>'
    remove.addEventListener('click', async () => {
      await api(`/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ removeIndex: index }) })
      await loadDay()
    })
    row.appendChild(remove)

    detail.appendChild(row)
  })

  return detail
}

// ------------------------------------------------------------------- coach

$('refresh-review').addEventListener('click', () => loadReview(true))

async function loadReview(force = false) {
  $('findings').innerHTML = '<p class="spinner">Working it out…</p>'
  try {
    const data = await api(`/review?date=${state.date}&ai=1${force ? '&refresh=1' : ''}`)
    const { review, narrative } = data

    $('score').textContent = review.score
    const circumference = 2 * Math.PI * 38
    const ring = $('score-ring')
    ring.style.strokeDashoffset = String(circumference * (1 - review.score / 100))
    ring.style.stroke = review.score >= 70 ? 'var(--good)' : review.score >= 45 ? 'var(--warn)' : 'var(--bad)'

    $('verdict-label').textContent = review.verdict
    $('verdict-sub').textContent = review.headline

    if (narrative) {
      $('narrative').textContent = narrative
      $('narrative').classList.remove('hidden')
    } else {
      $('narrative').classList.add('hidden')
    }
    $('findings').innerHTML = review.findings
      .map((f) => `<div class="finding ${f.severity}">${escapeHtml(f.text)}</div>`).join('')
  } catch (error) {
    $('findings').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }

  try {
    const { week, review } = await api(`/week?end=${state.date}`)
    $('week-stats').innerHTML = [
      [week.avgIn.toLocaleString(), 'Avg in · kcal'],
      [week.avgOut.toLocaleString(), 'Avg out · kcal'],
      [`${week.projectedKgPerWeek > 0 ? '+' : ''}${week.projectedKgPerWeek}`, 'Trend · kg/wk'],
      [`${week.trainingDays}/${week.loggedDays}`, 'Training days'],
    ].map(([n, k]) => `<div class="stat"><div class="n">${n}</div><div class="k">${k}</div></div>`).join('')
    $('week-findings').innerHTML = review.findings
      .map((f) => `<div class="finding ${f.severity}">${escapeHtml(f.text)}</div>`).join('')
  } catch { /* secondary panel */ }
}

// ------------------------------------------------------- copy day for coach

$('copy-coach').addEventListener('click', async () => {
  try {
    const [dayData, reviewData] = await Promise.all([
      state.dayCache && state.dayCache.date === state.date ? state.dayCache : api(`/day?date=${state.date}`),
      api(`/review?date=${state.date}`),
    ])
    const text = coachText(dayData, reviewData)
    await navigator.clipboard.writeText(text)
    toast('Copied. Paste it to your coach.')
  } catch (error) {
    toast(`Could not copy: ${error.message}`, true)
  }
})

function coachText(dayData, reviewData) {
  const { day, entries } = dayData
  const p = state.profile || {}
  const lines = []
  lines.push(`FITNESS LOG — ${fmtDate(day.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`)
  lines.push(`Profile: ${p.age}y, ${p.weightKg}kg, goal ${day.targets.goal} @${p.rateKgPerWeek}kg/wk${p.climate === 'hot' ? ', hot climate' : ''}`)
  lines.push(`Energy: in ${Math.round(day.caloriesIn)} / target ${day.targets.calories} · out ${Math.round(day.caloriesOut)} · ${day.deficit >= 0 ? 'deficit' : 'surplus'} ${Math.abs(Math.round(day.net))}`)
  lines.push(`Macros: P ${Math.round(day.nutrition.protein)}/${day.targets.protein}g · C ${Math.round(day.nutrition.carbs)}g · F ${Math.round(day.nutrition.fat)}g · fibre ${Math.round(day.nutrition.fibre)}/${day.targets.fibre}g`)
  lines.push(`Water: ${litres(day.waterMl || 0)} of ${litres(day.targets.waterMl || 0)}`)
  if (day.alcoholUnits) lines.push(`Alcohol: ${day.alcoholUnits} units (${Math.round(day.alcoholKcal)} kcal)`)
  lines.push('')
  lines.push('Meals:')
  for (const meal of entries.meals) {
    const items = meal.items.map((i) => `${i.name} ${i.grams}g`).join(', ')
    const kcal = Math.round(meal.items.reduce((s, i) => s + (i.kcal || 0), 0))
    lines.push(`- [${meal.slot || 'meal'}] ${items} (${kcal} kcal)`)
  }
  if (!entries.meals.length) lines.push('- none logged')
  lines.push('Training:')
  for (const workout of entries.workouts) {
    for (const item of workout.items) {
      const ex = item.exercise
      const spec = ex ? ` ${ex.sets}×${ex.reps ?? '?'}${ex.weightKg ? ` @${ex.weightKg}kg` : ''}${ex.volume ? ` (vol ${ex.volume}kg)` : ''}` : ''
      lines.push(`- ${ex ? ex.name : item.name}${spec} · ${item.minutes}min · ${item.kcal}kcal${item.heatAdjusted ? ' [heat]' : ''}`)
    }
  }
  if (!entries.workouts.length) lines.push('- none logged')
  lines.push('')
  lines.push(`App verdict: ${reviewData.review.verdict} ${reviewData.review.score}/100`)
  for (const f of reviewData.review.findings.slice(0, 6)) lines.push(`- [${f.severity}] ${f.text}`)
  return lines.join('\n')
}

// ------------------------------------------------------------------- stats

$('stats-period').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  state.statsPeriod = button.dataset.period
  document.querySelectorAll('#stats-period button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
  loadStats()
})

$('stats-prev').addEventListener('click', () => shiftStats(-1))
$('stats-next').addEventListener('click', () => shiftStats(1))

function shiftStats(direction) {
  const anchor = state.statsDate || state.date
  if (state.statsPeriod === 'day') state.statsDate = shiftDate(anchor, direction)
  else if (state.statsPeriod === 'week') state.statsDate = shiftDate(anchor, direction * 7)
  else {
    const [year, month] = anchor.slice(0, 7).split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1 + direction, 1))
    state.statsDate = next.toISOString().slice(0, 10)
  }
  if (state.statsDate > state.today) state.statsDate = state.today
  loadStats()
}

async function loadStats() {
  const body = $('stats-body')
  body.innerHTML = '<p class="spinner">Loading…</p>'
  const anchor = state.statsDate || state.date
  try {
    if (state.statsPeriod === 'day') {
      const data = anchor === state.date && state.dayCache ? state.dayCache : await api(`/day?date=${anchor}`)
      $('stats-range').textContent = fmtDate(anchor, { weekday: 'short', day: 'numeric', month: 'short' })
      renderDayStats(body, data)
    } else {
      const summary = await api(`/summary?period=${state.statsPeriod}&date=${anchor}`)
      $('stats-range').textContent = state.statsPeriod === 'month'
        ? fmtDate(summary.from, { month: 'long', year: 'numeric' })
        : `${fmtDate(summary.from, { day: 'numeric', month: 'short' })} – ${fmtDate(summary.to, { day: 'numeric', month: 'short' })}`
      if (state.statsPeriod === 'week') renderWeekStats(body, summary)
      else renderMonthStats(body, summary)
    }
  } catch (error) {
    body.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }
}

function statGrid(pairs) {
  return `<div class="stat-grid">${pairs.map(([n, k]) =>
    `<div class="stat"><div class="n">${n}</div><div class="k">${k}</div></div>`).join('')}</div>`
}

function renderDayStats(body, data) {
  const { day, review } = data
  const training = (data.entries.workouts || []).flatMap((w) => w.items)
  body.innerHTML = `
    ${statGrid([
      [Math.round(day.caloriesIn).toLocaleString(), 'kcal in'],
      [Math.round(day.caloriesOut).toLocaleString(), 'kcal out'],
      [`${day.deficit >= 0 ? '−' : '+'}${Math.abs(Math.round(day.net)).toLocaleString()}`, day.deficit >= 0 ? 'deficit' : 'surplus'],
      [review?.score ?? '—', 'day score'],
      [`${Math.round(day.nutrition.protein)}<small>/${day.targets.protein}g</small>`, 'protein'],
      [`${Math.round(day.nutrition.fibre)}<small>/${day.targets.fibre}g</small>`, 'fibre'],
      [litres(day.waterMl || 0), 'water'],
      [`${day.training.minutes}<small> min</small>`, 'training'],
    ])}
    ${training.length ? `<h2 style="margin-top:6px">Training detail</h2>` : ''}
    ${training.map((item) => {
      const ex = item.exercise
      const spec = ex ? [ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : '', ex.weightKg ? `@ ${ex.weightKg} kg` : '', ex.volume ? `${ex.volume.toLocaleString()} kg vol` : ''].filter(Boolean).join(' · ') : `${item.minutes} min`
      return `<div class="finding note">${escapeHtml(ex ? ex.name : item.name)} — ${spec} · ${item.kcal} kcal</div>`
    }).join('')}`
}

function renderWeekStats(body, summary) {
  const volumeRows = Object.entries(summary.volumeByGroup)
  const maxVolume = Math.max(1, ...volumeRows.map(([, v]) => v))
  body.innerHTML = `
    <svg class="chart" viewBox="0 0 300 130" preserveAspectRatio="none" role="img" aria-label="Daily balance this week">
      ${weekBars(summary.days)}
    </svg>
    <p class="chart-note">Below the line = deficit. Above = surplus.</p>
    ${statGrid([
      [summary.avgIn.toLocaleString(), 'avg in · kcal'],
      [summary.avgOut.toLocaleString(), 'avg out · kcal'],
      [`${summary.projectedKgPerWeek > 0 ? '+' : ''}${summary.projectedKgPerWeek}`, 'trend · kg/wk'],
      [`${summary.daysOnTarget}/${summary.loggedDays}`, 'days on target'],
      [`${summary.trainingDays}<small>/${summary.loggedDays}</small>`, 'training days'],
      [summary.totalVolumeKg ? summary.totalVolumeKg.toLocaleString() : '0', 'volume · kg'],
      [litres(summary.avgWaterMl), 'avg water'],
      [`${summary.alcoholUnits || 0}<small>/14</small>`, 'alcohol units'],
    ])}
    ${volumeRows.length ? `<h2>Volume by pattern</h2><div class="group-bars">${volumeRows.map(([group, volume]) => `
      <div class="bar-row">
        <span class="label">${group}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(volume / maxVolume) * 100}%"></span></span>
        <span class="value">${volume.toLocaleString()} kg</span>
      </div>`).join('')}</div>` : ''}`
}

function weekBars(days) {
  const max = Math.max(600, ...days.map((d) => Math.abs(d.net)))
  const width = 300 / days.length
  const mid = 62
  const bars = days.map((day, index) => {
    if (!day.logged) return `<rect x="${index * width + 4}" y="${mid - 1}" width="${width - 8}" height="2" rx="1" fill="var(--surface-3)"/>`
    const height = Math.max(2, (Math.abs(day.net) / max) * 52)
    const y = day.net > 0 ? mid - height : mid
    const colour = day.net > 0 ? 'var(--bad)' : 'var(--good)'
    return `<rect x="${index * width + 4}" y="${y}" width="${width - 8}" height="${height}" rx="3" fill="${colour}"/>
            <text x="${index * width + width / 2}" y="126" font-size="8.5" fill="var(--faint)" text-anchor="middle">${Number(day.date.slice(8))}</text>`
  }).join('')
  return `${bars}<line x1="0" y1="${mid}" x2="300" y2="${mid}" stroke="var(--border-strong)" stroke-width="1"/>`
}

function renderMonthStats(body, summary) {
  const first = summary.from
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const strongest = Math.max(400, ...summary.days.map((d) => Math.abs(d.net)))

  const cells = summary.days.map((day) => {
    if (day.date > state.today) return `<span class="hm-cell">${Number(day.date.slice(8))}</span>`
    if (!day.logged) return `<span class="hm-cell">${Number(day.date.slice(8))}</span>`
    const strong = Math.abs(day.net) > strongest * 0.55 ? ' strong' : ''
    const cls = day.net > 0 ? `surplus${strong}` : `deficit${strong}`
    const todayCls = day.date === state.today ? ' today-cell' : ''
    return `<span class="hm-cell ${cls}${todayCls}" title="${day.date}: ${day.net > 0 ? '+' : ''}${Math.round(day.net)} kcal">${Number(day.date.slice(8))}</span>`
  }).join('')

  const weightLine = summary.weights.length >= 2 ? weightChart(summary.weights) : ''

  body.innerHTML = `
    <div class="heatmap">
      ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="hm-head">${d}</span>`).join('')}
      ${'<span class="hm-cell blank"></span>'.repeat(lead)}
      ${cells}
    </div>
    ${statGrid([
      [`${summary.loggedDays}<small>/${summary.totalDays}</small>`, 'days logged'],
      [summary.avgIn.toLocaleString(), 'avg in · kcal'],
      [`${summary.avgNet > 0 ? '+' : ''}${summary.avgNet}`, 'avg net · kcal'],
      [summary.weightChange === null ? '—' : `${summary.weightChange > 0 ? '+' : ''}${summary.weightChange}<small> kg</small>`, 'weight change'],
      [summary.trainingDays, 'training days'],
      [summary.totalVolumeKg ? summary.totalVolumeKg.toLocaleString() : '0', 'volume · kg'],
      [`${summary.bestStreak}<small> days</small>`, 'best streak'],
      [`${summary.alcoholUnits || 0}<small> units</small>`, `alcohol · ${summary.alcoholDays} days`],
    ])}
    ${weightLine ? `<h2>Weight</h2>${weightLine}` : '<p class="hint">Log weigh-ins to see the weight trend here.</p>'}`
}

function weightChart(weights) {
  const values = weights.map((w) => w.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(0.5, max - min)
  const points = weights.map((w, index) => {
    const x = weights.length === 1 ? 150 : (index / (weights.length - 1)) * 292 + 4
    const y = 110 - ((w.value - min) / span) * 92
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = weights[weights.length - 1]
  return `<svg class="chart" viewBox="0 0 300 130" preserveAspectRatio="none" role="img" aria-label="Weight trend">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="296" y="122" font-size="9" fill="var(--muted)" text-anchor="end">${last.value} kg</text>
  </svg>`
}

// ------------------------------------------------------------------- meals

$('meal-slot-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  state.mealSlot = button.dataset.mealslot
  document.querySelectorAll('#meal-slot-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
  loadRecommendations()
})

async function loadRecommendations() {
  $('recommendations').innerHTML = '<p class="spinner">Thinking…</p>'
  try {
    const query = new URLSearchParams({ date: state.date, ai: '1' })
    if (state.mealSlot) query.set('slot', state.mealSlot)
    const data = await api(`/recommend?${query}`)

    const cards = data.meals.map((meal) => `
      <div class="meal">
        <div class="name">${escapeHtml(meal.name)}</div>
        <div class="macros">${meal.macros.kcal} kcal · ${meal.macros.protein}g P · ${meal.macros.carbs}g C · ${meal.macros.fat}g F · ${meal.effortMinutes} min</div>
        ${meal.why.length ? `<div class="why">${escapeHtml(meal.why.join('; '))}</div>` : ''}
        <div class="ingredients">${meal.ingredients.map((i) => `${escapeHtml(i.name)} ${i.grams}g`).join(' · ')}</div>
        <button class="btn small" data-log-meal="${meal.id}">Log this</button>
      </div>`).join('')

    const aiCards = (data.aiIdeas || []).map((idea) => `
      <div class="meal">
        <div class="name">${escapeHtml(idea.name)}</div>
        <div class="macros">~${idea.estimatedKcal} kcal · ~${idea.estimatedProtein}g protein · suggested</div>
        <div class="why">${escapeHtml(idea.why)}</div>
      </div>`).join('')

    $('recommendations').innerHTML = cards + aiCards +
      `<p class="hint">About ${Math.round(data.remaining.kcal)} kcal and ${Math.round(data.remaining.protein)} g protein left today.</p>`

    $('recommendations').querySelectorAll('[data-log-meal]').forEach((button) => {
      button.addEventListener('click', () => logSuggestedMeal(data.meals, button.dataset.logMeal))
    })

    $('favourites').innerHTML = data.taste.favourites.length
      ? data.taste.favourites.map((f) => `<span class="chip">${escapeHtml(f.name)} ×${f.count}</span>`).join('')
      : '<span class="chip">Nothing learned yet</span>'
    $('taste-hint').textContent = data.taste.confident
      ? 'Suggestions are weighted towards these.'
      : 'Log a few more meals and suggestions start matching what you actually eat.'
  } catch (error) {
    $('recommendations').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }
}

// -------------------------------------------------------------------- body

state.bodyMode = 'live'

document.querySelectorAll('#body-period button').forEach((button) => {
  button.addEventListener('click', () => {
    state.bodyMode = button.dataset.bodymode
    document.querySelectorAll('#body-period button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === button)))
    $('body-custom').classList.toggle('hidden', state.bodyMode !== 'custom')
    if (state.bodyMode !== 'custom') loadBody()
  })
})

for (const id of ['body-from', 'body-to']) {
  $(id).addEventListener('change', () => {
    if ($('body-from').value && $('body-to').value) loadBody()
  })
}

function bodyRange() {
  const today = state.today
  if (state.bodyMode === 'week') return { from: shiftDate(today, -6), to: today }
  if (state.bodyMode === 'month') return { from: shiftDate(today, -29), to: today }
  if (state.bodyMode === 'year') return { from: shiftDate(today, -364), to: today }
  return { from: $('body-from').value, to: $('body-to').value }
}

async function loadBody() {
  const detail = $('body-detail')
  detail.innerHTML = ''
  try {
    const { renderBodyMap } = await import('/body.js')

    if (state.bodyMode === 'live') {
      const data = await api('/muscles?mode=live')
      const names = Object.fromEntries(data.catalogue.map((m) => [m.id, m.name]))
      const recovering = data.recovering
      const count = Object.keys(recovering).length
      $('body-caption').textContent = count
        ? `${count} muscle${count === 1 ? ' is' : 's are'} inside the 24-hour recovery window. Red means recently worked — train something pale.`
        : 'Everything is recovered. No excuses left.'

      renderBodyMap($('body-map'), (muscle) => {
        const rec = recovering[muscle]
        if (!rec) return { fill: 'var(--good)', opacity: 0.18, title: `${names[muscle]} — recovered` }
        const freshness = rec.hoursLeft / data.recoveryHours // 1 = just trained
        return {
          fill: 'var(--bad)',
          opacity: 0.25 + 0.6 * freshness,
          title: `${names[muscle]} — ${rec.hoursLeft} h of recovery left`,
        }
      })

      const rows = Object.entries(recovering).sort((a, b) => b[1].hoursLeft - a[1].hoursLeft)
      detail.innerHTML = rows.length
        ? rows.map(([muscle, rec]) => `
            <div class="bar-row">
              <span class="label">${escapeHtml(names[muscle])}</span>
              <span class="bar-track"><span class="bar-fill bad" style="width:${Math.round((rec.hoursLeft / data.recoveryHours) * 100)}%"></span></span>
              <span class="value">${rec.hoursLeft} h left</span>
            </div>`).join('')
        : ''
      return
    }

    const { from, to } = bodyRange()
    if (!from || !to) {
      $('body-caption').textContent = 'Pick both dates.'
      return
    }
    const data = await api(`/muscles?from=${from}&to=${to}`)
    const names = Object.fromEntries(data.catalogue.map((m) => [m.id, m.name]))
    const efforts = data.effort
    const max = Math.max(1, ...Object.values(efforts))
    const worked = Object.keys(efforts).length

    // The headline is the actual work done, not a workout count.
    const t = data.totals || {}
    const rangeLabel = `${fmtDate(from, { day: 'numeric', month: 'short' })} – ${fmtDate(to, { day: 'numeric', month: 'short' })}`
    $('body-caption').textContent = data.workoutCount
      ? `${rangeLabel}: ${t.exercises || 0} exercise${t.exercises === 1 ? '' : 's'}, ` +
        `${(t.reps || 0).toLocaleString()} reps in ${(t.sets || 0).toLocaleString()} sets` +
        `${t.cardioMinutes ? ` plus ${t.cardioMinutes} min of cardio` : ''}, across ${data.workoutCount} session${data.workoutCount === 1 ? '' : 's'}.`
      : 'No training logged in this range.'

    renderBodyMap($('body-map'), (muscle) => {
      const effort = efforts[muscle] || 0
      if (!effort) return { fill: 'var(--faint)', opacity: 0.12, title: `${names[muscle]} — nothing` }
      const s = data.stats?.[muscle]
      const detailTip = s
        ? `${s.reps ? `${s.reps} reps` : ''}${s.cardioMinutes ? `${s.reps ? ' + ' : ''}${s.cardioMinutes} min cardio` : ''} · ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}`
        : `${effort} effort units`
      return {
        fill: 'var(--accent)',
        opacity: 0.2 + 0.7 * (effort / max),
        title: `${names[muscle]} — ${detailTip}`,
      }
    })

    const rows = Object.entries(efforts).sort((a, b) => b[1] - a[1])
    const muscleRows = rows.map(([muscle, effort]) => {
      const s = data.stats?.[muscle] || { reps: 0, sets: 0, cardioMinutes: 0, exercises: [] }
      const what = [
        s.reps ? `${s.reps.toLocaleString()} reps` : null,
        s.cardioMinutes ? `${s.cardioMinutes} min` : null,
      ].filter(Boolean).join(' + ') || '—'
      return `
        <div class="bar-row muscle-stat" title="${escapeHtml(s.exercises.join(', '))}">
          <span class="label">${escapeHtml(names[muscle])}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round((effort / max) * 100)}%"></span></span>
          <span class="value">${what} · ${s.exercises.length} ex</span>
        </div>`
    }).join('')

    // Tomorrow's fix: what this range neglected, and what would repair it.
    const rec = data.recommendation
    const recBlock = rec?.exercises?.length
      ? `<h2 style="margin-top:14px">Tomorrow's workout — what's lacking</h2>
         <p class="hint">Least-trained in this range: ${rec.targets.slice(0, 6).map((m) => names[m] || m).join(', ')}.</p>
         ${rec.exercises.map((e) => `
           <div class="finding note rec-ex" data-exid="${e.id}">
             <b>${escapeHtml(e.name)}</b> — ${e.sets}×${e.reps}
             <span class="rec-muscles">${Object.entries(e.muscles).filter(([, s]) => s === 1).map(([m]) => names[m] || m).join(', ')}</span>
           </div>`).join('')}
         <button class="btn small" id="body-rec-to-plan" type="button">Open this workout in Plan</button>`
      : (data.workoutCount ? '<p class="hint">Nothing is badly lacking — this range covered the body well.</p>' : '')

    detail.innerHTML = rows.length
      ? `<h2>Work by muscle</h2>${muscleRows}` +
        (worked < 17 ? `<p class="hint">Untrained in this range: ${data.catalogue.filter((m) => !efforts[m.id]).map((m) => m.name).join(', ')}.</p>` : '') +
        recBlock
      : recBlock
    $('body-rec-to-plan')?.addEventListener('click', () => {
      state.sessionOverride = { title: "Recommended — what's lacking", exercises: rec.exercises }
      showView('plan')
    })
  } catch (error) {
    $('body-caption').textContent = error.message
  }
}

// -------------------------------------------------------- exercise picker

let exerciseMenu = null // {exercises, cardio} from the API, cached
let pickedExercise = null

// Where a picked exercise goes: the Today logger ('log'), the Plan-screen
// session card ('session'), or a persistent plan edit ('plan-edit:<key>').
let pickerMode = 'log'

async function ensureExerciseMenu() {
  if (!exerciseMenu) exerciseMenu = await api('/exercises').catch(() => null)
  return exerciseMenu
}

async function openExercisePicker(mode = 'log') {
  pickerMode = mode
  $('exercise-sheet').classList.remove('hidden')
  $('exercise-config').classList.add('hidden')
  $('exercise-list').classList.remove('hidden')
  $('exercise-search').value = ''
  await guideReady // demos need the animation engine
  const first = !exerciseMenu
  if (!(await ensureExerciseMenu())) return
  if (first) {
    const groups = ['all', 'legs', 'push', 'pull', 'core', 'full', 'cardio']
    $('exercise-groups').innerHTML = groups.map((g) =>
      `<button data-exgroup="${g}" aria-pressed="${g === 'all'}">${g[0].toUpperCase()}${g.slice(1)}</button>`).join('')
    $('exercise-groups').addEventListener('click', (event) => {
      const button = event.target.closest('button')
      if (!button) return
      document.querySelectorAll('#exercise-groups button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === button)))
      renderExerciseList()
    })
    $('exercise-search').addEventListener('input', renderExerciseList)
  }
  renderExerciseList()
}

$('browse-exercises').addEventListener('click', () => openExercisePicker('log'))

$('exercise-close').addEventListener('click', () => $('exercise-sheet').classList.add('hidden'))
$('exercise-sheet').addEventListener('click', (event) => {
  if (event.target === $('exercise-sheet')) $('exercise-sheet').classList.add('hidden')
})

function renderExerciseList() {
  if (!exerciseMenu) return
  const group = document.querySelector('#exercise-groups button[aria-pressed="true"]')?.dataset.exgroup || 'all'
  const query = $('exercise-search').value.trim().toLowerCase()
  const list = $('exercise-list')
  list.innerHTML = ''

  const rows = group === 'cardio'
    ? exerciseMenu.cardio.map((c) => ({ ...c, kind: 'cardio' }))
    : exerciseMenu.exercises
        .filter((e) => group === 'all' || e.group === group)
        .map((e) => ({ ...e, kind: 'strength' }))
        .concat(group === 'all' ? exerciseMenu.cardio.map((c) => ({ ...c, kind: 'cardio' })) : [])

  const filtered = rows.filter((r) => !query || r.name.toLowerCase().includes(query))
  for (const row of filtered) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'exercise-item'
    const sub = row.kind === 'cardio'
      ? 'cardio machine'
      : Object.keys(row.muscles || {}).slice(0, 3).map((m) => m.replace('_', ' ')).join(', ')
    button.innerHTML = `<span>${escapeHtml(row.name)}</span><span class="meta">${escapeHtml(sub)}</span>`
    button.addEventListener('click', () => pickExercise(row))
    list.appendChild(button)
  }
  if (!filtered.length) list.innerHTML = '<p class="empty">Nothing matches.</p>'
}

let pickedDemo = null

function pickExercise(row) {
  pickedExercise = row
  $('exercise-list').classList.add('hidden')
  $('exercise-config').classList.remove('hidden')
  $('picked-name').textContent = row.name

  // Animated form demo: the authored guide when one exists, the pattern
  // demo otherwise. Every menu entry has one or the other.
  pickedDemo?.destroy()
  pickedDemo = null
  const demoBox = $('picked-demo')
  demoBox.innerHTML = ''
  const demo = demoForExercise(row)
  if (demo && mountAnimation) {
    const spec = demo.movement ? { ...demo.movement.anim, name: demo.movement.name } : demo.spec
    pickedDemo = mountAnimation(demoBox, spec)
    if (demo.movement) {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'demo-guide-link'
      link.textContent = 'Open the full form guide'
      link.addEventListener('click', () => openMovement(demo.movement))
      demoBox.appendChild(link)
    }
  }

  const burn = $('picked-burn')
  burn.textContent = row.kind === 'cardio'
    ? (row.met && state.profile ? `~${Math.max(1, Math.round((row.met - 1) * state.profile.weightKg * (20 / 60)))} kcal per 20 min for you` : '')
    : (row.kcalPerSet ? `~${row.kcalPerSet} kcal per set for you (MET ${row.met})` : '')

  const tiers = row.tiers
  $('picked-muscles').innerHTML = tiers
    ? [['Primary', tiers.primary], ['Secondary', tiers.secondary], ['Also works', tiers.tertiary]]
        .filter(([, list]) => list && list.length)
        .map(([label, list]) =>
          `<div class="tier-row"><span class="tier-label">${label}</span>` +
          `${list.map((m) => `<span class="tier-muscle">${escapeHtml(m.replace(/_/g, ' '))}</span>`).join('')}</div>`)
        .join('')
    : ''
  $('picked-strength').classList.toggle('hidden', row.kind === 'cardio')
  $('picked-cardio').classList.toggle('hidden', row.kind !== 'cardio')
}

$('picked-back').addEventListener('click', () => {
  pickedDemo?.destroy()
  pickedDemo = null
  $('exercise-config').classList.add('hidden')
  $('exercise-list').classList.remove('hidden')
})

$('pk-effort').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  document.querySelectorAll('#pk-effort button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b === button)))
})

/**
 * The picker writes plain text into the logger — the same words you could
 * have typed — so one parsing pipeline handles menu picks and free text
 * alike, and the preview shows exactly what will be stored.
 */
$('picked-add').addEventListener('click', async () => {
  if (!pickedExercise) return
  const cleanName = pickedExercise.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const sets = Math.max(1, Number($('pk-sets').value) || 3)
  const reps = Math.max(1, Number($('pk-reps').value) || 10)
  const weight = Number($('pk-weight').value)

  // Session mode: the pick becomes a row in the Plan screen's live session.
  if (pickerMode === 'session' && pickedExercise.kind !== 'cardio') {
    sessionRows.push({ name: pickedExercise.name, sets, reps, weightKg: weight || null, logged: false })
    renderSessionRows()
    $('exercise-sheet').classList.add('hidden')
    toast(`${pickedExercise.name} added to the session.`)
    return
  }

  // Plan-edit mode: the pick is stored on the plan session permanently.
  if (pickerMode.startsWith('plan-edit:') && pickedExercise.kind !== 'cardio') {
    const skey = pickerMode.slice('plan-edit:'.length)
    await savePlanEdit(skey, (edit) => {
      const lower = pickedExercise.name.toLowerCase()
      if (edit.removed.some((n) => n.toLowerCase() === lower)) {
        edit.removed = edit.removed.filter((n) => n.toLowerCase() !== lower)
      } else if (!edit.added.some((a) => a.name.toLowerCase() === lower)) {
        edit.added.push({ name: pickedExercise.name })
      }
    })
    $('exercise-sheet').classList.add('hidden')
    toast(`${pickedExercise.name} added to the plan.`)
    return
  }

  let phrase
  if (pickedExercise.kind === 'cardio') {
    const minutes = Math.max(1, Number($('pk-minutes').value) || 20)
    const effort = document.querySelector('#pk-effort button[aria-pressed="true"]')?.dataset.effort || ''
    phrase = `${cleanName} ${minutes} min${effort ? ` ${effort}` : ''}`
  } else {
    phrase = `${cleanName} ${sets}x${reps}${weight ? ` ${weight}kg` : ''}`
  }

  if (state.kind !== 'workout') {
    state.kind = 'workout'
    document.querySelectorAll('#kind-seg button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.kind === 'workout')))
    $('slot-seg').classList.add('hidden')
  }
  const box = $('entry-text')
  const existing = box.value.trim()
  box.value = existing ? `${existing.replace(/,\s*$/, '')}, ${phrase}` : phrase
  $('exercise-sheet').classList.add('hidden')
  toast(`${pickedExercise.name} added — Log it when the set list is complete.`)
  previewParse()
})

// ------------------------------------------- Plan screen: live session card

let sessionRows = [] // [{name, sets, reps, weightKg, logged}]

async function loadPlanSession() {
  // A recommendation carried over (from Body or the recommend button) wins.
  if (state.sessionOverride) {
    $('session-title').textContent = state.sessionOverride.title
    $('session-sub').textContent = 'Built from what your week has been missing. Tweak it, then log as you go.'
    sessionRows = state.sessionOverride.exercises.map((e) => ({
      name: e.name, sets: e.sets || 3, reps: parseInt(e.reps, 10) || 10, weightKg: null, logged: false,
    }))
    state.sessionOverride = null
    renderSessionRows()
    return
  }
  try {
    const data = await api(`/plan-day?date=${state.today}`)
    const lift = data?.day?.blocks?.find((b) => b.key === 'lift')
    if (lift?.exercises?.length) {
      $('session-title').textContent = lift.title
      $('session-sub').textContent =
        `${data.day.planName} · week ${data.day.week}. Enter your reps and weight, log each lift as you rack it.`
      sessionRows = lift.exercises.map((e) => ({
        name: e.name, sets: e.sets || 3, reps: parseInt(e.reps, 10) || 10, weightKg: null,
        logged: !!lift.entryId,
      }))
    } else {
      $('session-title').textContent = 'Today’s session'
      $('session-sub').textContent = data?.plan
        ? 'Rest day on the plan. Build a session from the menu, or ask for a recommendation.'
        : 'No plan attached. Build a session from the menu, or ask for a recommendation.'
      sessionRows = []
    }
  } catch {
    sessionRows = []
  }
  renderSessionRows()
}

function renderSessionRows() {
  const box = $('session-rows')
  if (!sessionRows.length) {
    box.innerHTML = '<p class="empty">Nothing queued. Add exercises or hit Recommend.</p>'
    return
  }
  box.innerHTML = ''
  sessionRows.forEach((row, index) => {
    const div = document.createElement('div')
    div.className = `session-row${row.logged ? ' done' : ''}`
    div.innerHTML = `
      <button type="button" class="session-name" title="Show me how">${escapeHtml(row.name)}</button>
      <input type="number" class="s-sets" min="1" max="10" value="${row.sets}" inputmode="numeric" aria-label="Sets">
      <span class="s-x">×</span>
      <input type="number" class="s-reps" min="1" max="100" value="${row.reps}" inputmode="numeric" aria-label="Reps">
      <input type="number" class="s-kg" min="0" max="500" step="0.5" inputmode="decimal" placeholder="kg"
        ${row.weightKg ? `value="${row.weightKg}"` : ''} aria-label="Weight in kg">
      <button type="button" class="btn small s-log"${row.logged ? ' disabled' : ''}>${row.logged ? 'Logged ✓' : 'Log'}</button>
      <button type="button" class="s-del" aria-label="Remove ${escapeHtml(row.name)}">✕</button>`
    div.querySelector('.s-sets').addEventListener('change', (e) => { row.sets = Math.max(1, Number(e.target.value) || row.sets) })
    div.querySelector('.s-reps').addEventListener('change', (e) => { row.reps = Math.max(1, Number(e.target.value) || row.reps) })
    div.querySelector('.s-kg').addEventListener('change', (e) => { row.weightKg = Number(e.target.value) || null })
    div.querySelector('.s-log').addEventListener('click', () => logSessionRow(index))
    div.querySelector('.s-del').addEventListener('click', () => { sessionRows.splice(index, 1); renderSessionRows() })
    div.querySelector('.session-name').addEventListener('click', () => openGuideOrDemo(row.name))
    box.appendChild(div)
  })
}

function sessionPhrase(row) {
  return `${row.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()} ${row.sets}x${row.reps}${row.weightKg ? ` ${row.weightKg}kg` : ''}`
}

async function logSessionRow(index) {
  const row = sessionRows[index]
  try {
    await api('/entries', {
      method: 'POST',
      body: JSON.stringify({ kind: 'workout', date: state.today, text: sessionPhrase(row) }),
    })
    row.logged = true
    renderSessionRows()
    toast(`${row.name} logged. Next.`)
    if (state.date === state.today) loadDay()
  } catch (error) { toast(error.message, true) }
}

$('session-log-all').addEventListener('click', async () => {
  const remaining = sessionRows.filter((r) => !r.logged)
  if (!remaining.length) { toast('Everything is already logged.'); return }
  try {
    await api('/entries', {
      method: 'POST',
      body: JSON.stringify({ kind: 'workout', date: state.today, text: remaining.map(sessionPhrase).join(', ') }),
    })
    sessionRows.forEach((r) => { r.logged = true })
    renderSessionRows()
    toast(`${remaining.length} lift${remaining.length === 1 ? '' : 's'} logged.`)
    if (state.date === state.today) loadDay()
  } catch (error) { toast(error.message, true) }
})

$('session-add').addEventListener('click', () => openExercisePicker('session'))

$('session-recommend').addEventListener('click', async () => {
  try {
    const rec = await api('/recommend-workout')
    if (!rec.exercises.length) { toast('Nothing is lacking this week — train what you enjoy.'); return }
    state.sessionOverride = { title: 'Recommended — what’s lacking', exercises: rec.exercises }
    await loadPlanSession()
  } catch (error) { toast(error.message, true) }
})

/** Form help for a name: the authored guide, else the pattern demo. */
async function openGuideOrDemo(name) {
  await guideReady
  const movement = findMovement(name)
  if (movement) { openMovement(movement); return }
  const menu = await ensureExerciseMenu()
  const row = menu?.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase())
    || menu?.exercises.find((e) => name.toLowerCase().includes(e.name.toLowerCase()))
  const demo = row && demoForExercise(row)
  if (!demo) return
  if (demo.movement) { openMovement(demo.movement); return }
  $('move-name').textContent = row.name
  $('move-muscles').textContent = Object.entries(row.muscles || {})
    .filter(([, share]) => share === 1).map(([m]) => m.replace(/_/g, ' ')).join(', ')
  moveAnim?.destroy()
  $('move-anim').innerHTML = ''
  moveAnim = mountAnimation($('move-anim'), { ...demo.spec, name: row.name })
  $('move-body').innerHTML = ''
  $('move-sheet').classList.remove('hidden')
}

/** Mutate one session's plan edit and persist it to the profile. */
async function savePlanEdit(skey, mutate) {
  const edits = JSON.parse(JSON.stringify(state.profile?.planEdits || {}))
  const edit = (edits[skey] ||= { removed: [], added: [] })
  mutate(edit)
  if (!edit.removed.length && !edit.added.length) delete edits[skey]
  try {
    const { profile } = await api('/profile', { method: 'PUT', body: JSON.stringify({ planEdits: edits }) })
    state.profile = profile
    await loadPlanOverview()
    await loadPlanSession()
  } catch (error) { toast(error.message, true) }
}

// ------------------------------------------------------------------ pantry

async function loadPantry() {
  try {
    const { items } = await api('/pantry')
    const list = $('pantry-list')
    if (!items.length) {
      list.innerHTML = '<p class="empty">Nothing scanned yet.</p>'
      return
    }
    list.innerHTML = ''
    for (const item of items) {
      const row = document.createElement('div')
      row.className = 'ing-row'
      row.innerHTML = `
        <span class="ing-name">${escapeHtml(item.name)}
          <span class="meta" style="display:block">${item.per100.kcal} kcal · ${item.per100.protein}g P ·
            ${item.per100.carbs}g C · ${item.per100.fat}g F per 100 g · 1 serving ≈ ${item.unit.grams} g
            ${item.source === 'scan' ? ' · scanned' : ''}</span>
        </span>`
      const add = document.createElement('button')
      add.className = 'btn small'
      add.textContent = 'Add'
      add.addEventListener('click', () => addIngredientToLogger(item))
      const del = document.createElement('button')
      del.className = 'btn small ghost'
      del.setAttribute('aria-label', `Remove ${item.name}`)
      del.innerHTML = '<svg class="ico" style="width:13px;height:13px"><use href="#i-x"/></svg>'
      del.addEventListener('click', async () => {
        await api(`/pantry/${item.id}`, { method: 'DELETE' })
        loadPantry()
      })
      row.appendChild(add)
      row.appendChild(del)
      list.appendChild(row)
    }
  } catch (error) {
    $('pantry-list').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }
}

// --------------------------------------------------------------- label scan

const scanStatus = (text) => {
  const el = $('scan-status')
  el.textContent = text
  el.classList.toggle('hidden', !text)
}

/**
 * Read a photographed label entirely on-device: the OCR engine is vendored
 * WebAssembly served from this site, so nothing leaves the phone.
 */
async function scanLabel(file) {
  scanStatus('Loading the reader (first time takes a few seconds)…')
  try {
    const tesseract = await import('/vendor/tesseract/tesseract.esm.min.js')
    const createWorker = tesseract.createWorker || tesseract.default?.createWorker
    if (!createWorker) throw new Error('OCR engine failed to load')
    const worker = await createWorker('eng', 1, {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/',
      langPath: '/vendor/tesseract',
      logger: (m) => {
        if (m.status === 'recognizing text') scanStatus(`Reading the label… ${Math.round(m.progress * 100)}%`)
      },
    })
    // PSM 4 (single column of variable-width lines) keeps each table row
    // together as one line, which is what the parser wants from a label grid.
    await worker.setParameters({ tessedit_pageseg_mode: '4' })
    scanStatus('Reading the label…')
    const image = await preprocessLabel(file)
    const { data } = await worker.recognize(image)
    await worker.terminate()

    const { parseNutritionLabel } = await import('/label-parse.js')
    const parsed = parseNutritionLabel(data.text)
    if (parsed.fields === 0) {
      scanStatus('Could not find nutrition figures in that photo. Get closer, keep the panel flat and well-lit, and try again — or type it in.')
      openScanForm(null, [])
      return
    }
    scanStatus(`Read ${parsed.fields} of 6 figures. Check them against the label before saving.`)
    openScanForm(parsed, parsed.notes)
  } catch (error) {
    scanStatus(`Scanning failed: ${error.message}. You can type the numbers in instead.`)
    openScanForm(null, [])
  }
}

/**
 * Resize + grayscale + contrast stretch: cheap, and OCR loves it. The OCR
 * engine needs characters ~30px tall, so small images are scaled UP as well
 * as huge phone photos scaled down — both land near 2000px on the long side.
 */
async function preprocessLabel(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, 2000 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = image.data
  let min = 255
  let max = 0
  for (let i = 0; i < px.length; i += 4) {
    const grey = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    px[i] = grey
    if (grey < min) min = grey
    if (grey > max) max = grey
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < px.length; i += 4) {
    const stretched = ((px[i] - min) / range) * 255
    px[i] = px[i + 1] = px[i + 2] = stretched
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function openScanForm(parsed, notes) {
  $('scan-form').classList.remove('hidden')
  $('sc-name').value = ''
  $('sc-brand').value = ''
  $('sc-kcal').value = parsed?.per100.kcal ?? ''
  $('sc-protein').value = parsed?.per100.protein ?? ''
  $('sc-carbs').value = parsed?.per100.carbs ?? ''
  $('sc-fat').value = parsed?.per100.fat ?? ''
  $('sc-fibre').value = parsed?.per100.fibre ?? ''
  $('sc-sugar').value = parsed?.per100.sugar ?? ''
  $('sc-serving').value = parsed?.servingG ?? ''
  $('scan-notes').innerHTML = (notes || [])
    .map((n) => `<div class="finding warn">${escapeHtml(n)}</div>`).join('')
  $('sc-name').focus()
  state.scanSource = parsed ? 'scan' : 'manual'
}

$('scan-input').addEventListener('change', () => {
  const file = $('scan-input').files?.[0]
  if (file) scanLabel(file)
  $('scan-input').value = ''
})

$('manual-add').addEventListener('click', () => {
  scanStatus('')
  openScanForm(null, [])
})

$('scan-cancel').addEventListener('click', () => {
  $('scan-form').classList.add('hidden')
  scanStatus('')
})

$('scan-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    const { item } = await api('/pantry', {
      method: 'POST',
      body: JSON.stringify({
        name: $('sc-name').value,
        brand: $('sc-brand').value,
        servingG: Number($('sc-serving').value) || 100,
        source: state.scanSource,
        per100: {
          kcal: Number($('sc-kcal').value) || 0,
          protein: Number($('sc-protein').value) || 0,
          carbs: Number($('sc-carbs').value) || 0,
          fat: Number($('sc-fat').value) || 0,
          fibre: Number($('sc-fibre').value) || 0,
          sugar: Number($('sc-sugar').value) || 0,
        },
      }),
    })
    toast(`${item.name} saved. Log it by typing its name.`)
    $('scan-form').classList.add('hidden')
    scanStatus('')
    loadPantry()
  } catch (error) {
    toast(error.message, true)
  }
})

// ------------------------------------------------------ ingredient library

let ingTimer
$('ing-search').addEventListener('input', () => {
  clearTimeout(ingTimer)
  ingTimer = setTimeout(loadIngredients, 300)
})

async function loadIngredients() {
  const query = $('ing-search').value.trim()
  const container = $('ing-results')
  try {
    const { foods } = await api(`/foods?q=${encodeURIComponent(query)}`)
    if (!foods.length) {
      container.innerHTML = '<p class="empty">Nothing matches. Try a simpler word — "flour", "mince", "oil".</p>'
      return
    }
    container.innerHTML = ''
    for (const food of foods) {
      const row = document.createElement('div')
      row.className = 'ing-row'
      const unitNote = food.unit?.name && food.unit?.grams
        ? ` · 1 ${escapeHtml(food.unit.name)} ≈ ${food.unit.grams} g`
        : ''
      row.innerHTML = `
        <span class="ing-name">${escapeHtml(food.name)}
          <span class="meta" style="display:block">${food.per100.kcal} kcal · ${food.per100.protein}g P ·
            ${food.per100.carbs}g C · ${food.per100.fat}g F per 100 g${unitNote}</span>
        </span>`
      const add = document.createElement('button')
      add.className = 'btn small'
      add.textContent = 'Add'
      add.addEventListener('click', () => addIngredientToLogger(food))
      row.appendChild(add)
      container.appendChild(row)
    }
  } catch (error) {
    container.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }
}

/** Append an ingredient to the Today logger so a recipe builds up phrase by phrase. */
function addIngredientToLogger(food) {
  // Log by the natural unit's weight when one exists, otherwise 100 g — the
  // preview's gram inputs are where the real weights get set.
  const grams = food.unit?.grams || 100
  const cleanName = food.name.replace(/\s*\(.*?\)\s*$/, '')
  const box = $('entry-text')
  const existing = box.value.trim()
  box.value = existing ? `${existing.replace(/,\s*$/, '')}, ${grams}g ${cleanName}` : `${grams}g ${cleanName}`

  if (state.kind !== 'meal') {
    state.kind = 'meal'
    document.querySelectorAll('#kind-seg button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.kind === 'meal')))
    $('slot-seg').classList.remove('hidden')
  }
  toast(`${cleanName} added to the logger — open Today to weigh and save.`)
  previewParse()
}

async function logSuggestedMeal(meals, id) {
  const meal = meals.find((m) => m.id === id)
  if (!meal) return
  const text = meal.ingredients.map((i) => `${i.grams}g ${i.name}`).join(', ')
  try {
    await api('/entries', {
      method: 'POST',
      body: JSON.stringify({ kind: 'meal', date: state.date, slot: meal.slot, text }),
    })
    toast(`${meal.name} logged.`)
    loadRecommendations()
  } catch (error) { toast(error.message, true) }
}

// ----------------------------------------------------------------- profile

async function loadProfile() {
  const { profile, options, targets, today, bmi, bmiBands } = await api('/profile')
  state.profile = profile
  state.options = options
  state.bmi = bmi
  state.bmiBands = bmiBands
  state.today = today
  if (!state.date) { state.date = today; state.statsDate = today }

  $('p-name').value = profile.name || ''
  $('p-sex').value = profile.sex
  $('p-age').value = profile.age
  $('p-height').value = profile.heightCm
  $('p-weight').value = profile.weightKg
  $('p-rate').value = profile.rateKgPerWeek
  $('p-timezone').value = profile.timezone

  $('p-baseline').innerHTML = Object.entries(options.baselines).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('p-baseline').value = profile.baseline
  $('p-goal').innerHTML = Object.entries(options.goals).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('p-goal').value = profile.goal
  $('p-climate').innerHTML = Object.entries(options.climates || {}).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('p-climate').value = profile.climate || 'hot'
  $('p-plan').innerHTML = '<option value="">None</option>' +
    (options.plans || []).map((p) => `<option value="${p.id}">${p.name} (${p.owner})</option>`).join('')
  $('p-plan').value = profile.planId || ''
  $('p-plan-start').value = profile.planStart || ''
  $('p-eatback').innerHTML = Object.entries(options.eatBack || {}).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('p-eatback').value = profile.eatBack || 'all'

  renderTargetSummary(targets)
}

function renderTargetSummary(targets) {
  $('targets-summary').textContent =
    `Resting metabolic rate about ${targets.bmr.toLocaleString()} kcal. Maintenance around ` +
    `${targets.baseline.toLocaleString()} kcal before training. Target: ${targets.calories.toLocaleString()} kcal, ` +
    `${targets.protein} g protein, ${targets.fibre} g fibre.` + (targets.capNote ? ` ${targets.capNote}` : '')
}

$('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    const { profile, targets, bmi } = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: $('p-name').value,
        sex: $('p-sex').value,
        age: Number($('p-age').value),
        heightCm: Number($('p-height').value),
        weightKg: Number($('p-weight').value),
        baseline: $('p-baseline').value,
        goal: $('p-goal').value,
        rateKgPerWeek: Number($('p-rate').value),
        timezone: $('p-timezone').value,
        climate: $('p-climate').value,
        planId: $('p-plan').value || null,
        planStart: $('p-plan-start').value || null,
        eatBack: $('p-eatback').value,
      }),
    })
    state.profile = profile
    state.bmi = bmi
    renderTargetSummary(targets)
    renderBmi()
    toast('Saved.')
    await loadDay()
  } catch (error) { toast(error.message, true) }
})

// -------------------------------------------------------------- onboarding

/*
 * First-login gate. Daily calories come from Mifflin-St Jeor, which needs
 * sex, age, height and weight — so nobody reaches the app until those are
 * entered. Existing accounts pass through once with their saved numbers
 * prefilled; brand-new accounts start blank so the numbers are really theirs.
 */
function showOnboarding() {
  const profile = state.profile
  const options = state.options || {}
  $('ob-baseline').innerHTML = Object.entries(options.baselines || {})
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('ob-goal').innerHTML = Object.entries(options.goals || {})
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  if (state.justSignedUp) {
    $('ob-sex').value = ''
    $('ob-age').value = ''
    $('ob-height').value = ''
    $('ob-weight').value = ''
    $('ob-baseline').value = 'light'
    $('ob-goal').value = 'maintain'
  } else {
    $('ob-sex').value = profile.sex || ''
    $('ob-age').value = profile.age || ''
    $('ob-height').value = profile.heightCm || ''
    $('ob-weight').value = profile.weightKg || ''
    $('ob-baseline').value = profile.baseline
    $('ob-goal').value = profile.goal
  }
  onboardPreview()
  $('login').classList.add('hidden')
  $('app').classList.add('hidden')
  $('onboard').classList.remove('hidden')
}

// Live preview of what the numbers mean, using the same Mifflin-St Jeor
// constants as the engine (10W + 6.25H − 5A, +5 men / −161 women).
function onboardPreview() {
  const sex = $('ob-sex').value
  const age = Number($('ob-age').value)
  const height = Number($('ob-height').value)
  const weight = Number($('ob-weight').value)
  if (!sex || !age || !height || !weight) { $('ob-preview').textContent = ''; return }
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + offset)
  const bmi = (weight / ((height / 100) ** 2)).toFixed(1)
  $('ob-preview').textContent =
    `Resting metabolic rate about ${bmr.toLocaleString()} kcal/day (Mifflin-St Jeor). BMI ${bmi}.`
}

;['ob-sex', 'ob-age', 'ob-height', 'ob-weight'].forEach((id) => {
  $(id).addEventListener('input', onboardPreview)
  $(id).addEventListener('change', onboardPreview)
})

$('onboard-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  $('onboard-error').textContent = ''
  try {
    await api('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        sex: $('ob-sex').value,
        age: Number($('ob-age').value),
        heightCm: Number($('ob-height').value),
        weightKg: Number($('ob-weight').value),
        baseline: $('ob-baseline').value,
        goal: $('ob-goal').value,
        onboarded: true,
      }),
    })
    state.justSignedUp = false
    $('onboard').classList.add('hidden')
    await boot()
  } catch (error) {
    $('onboard-error').textContent = error.message
  }
})

// --------------------------------------------------------------------- BMI

const BMI_COLOURS = {
  underweight: '#38bdf8', healthy: 'var(--good)', overweight: '#f0b429',
  obese1: '#f97316', obese2: '#ef4444', obese3: '#b91c1c',
}
const BMI_LO = 14, BMI_HI = 44 // display window for the gauge

function renderBmi() {
  const el = $('bmi-card')
  const info = state.bmi
  if (!el || !info) return
  const bandColour = BMI_COLOURS[info.band] || 'var(--accent)'
  el.innerHTML = `
    <div class="bmi-figure">${info.bmi}<small style="color:${bandColour}">${info.label}</small></div>
    ${bmiGauge(info)}
    <p class="bmi-note">Healthy range for your height (BMI 18.5–25):
      <strong>${info.healthyKgMin}–${info.healthyKgMax} kg</strong>.</p>
    <div id="bmi-trend"></div>
    <p class="bmi-note faint">WHO adult classification. BMI is weight-for-height only —
      it cannot tell muscle from fat, so read it as a trend, not a verdict.</p>`
  loadBmiTrend()
}

function bmiGauge(info) {
  const x = (bmi) => ((Math.min(BMI_HI, Math.max(BMI_LO, bmi)) - BMI_LO) / (BMI_HI - BMI_LO)) * 292 + 4
  const bands = (state.bmiBands || []).map((band) => {
    const left = x(Math.max(band.min, BMI_LO))
    const width = Math.max(0, x(Math.min(band.max, BMI_HI)) - left)
    return `<rect x="${left.toFixed(1)}" y="26" width="${width.toFixed(1)}" height="12" rx="2"
      fill="${BMI_COLOURS[band.id] || 'var(--surface-3)'}" opacity="${band.id === state.bmi.band ? 1 : 0.35}">
      <title>${band.label}: ${band.min}–${band.max === 60 ? '+' : band.max}</title></rect>`
  }).join('')
  const ticks = [18.5, 25, 30, 35, 40].map((t) =>
    `<line x1="${x(t).toFixed(1)}" y1="24" x2="${x(t).toFixed(1)}" y2="40" stroke="var(--bg)" stroke-width="1"/>
     <text x="${x(t).toFixed(1)}" y="52" font-size="8" fill="var(--faint)" text-anchor="middle">${t}</text>`).join('')
  const mx = x(info.bmi)
  return `<svg class="bmi-scale" viewBox="0 0 300 56" role="img" aria-label="BMI ${info.bmi}, ${info.label}">
    ${bands}${ticks}
    <path d="M${(mx - 5).toFixed(1)} 12 h10 l-5 9 z" fill="var(--text)"/>
    <text x="${mx.toFixed(1)}" y="9" font-size="9.5" font-weight="700" fill="var(--text)"
      text-anchor="middle">${info.bmi}</text>
  </svg>`
}

// BMI over time, derived from weigh-ins at the current height.
async function loadBmiTrend() {
  const box = $('bmi-trend')
  if (!box || !state.profile) return
  try {
    const { weights } = await api('/history?days=180')
    if (!weights || weights.length < 2) {
      box.innerHTML = '<p class="bmi-note">Log weigh-ins to see your BMI trend here.</p>'
      return
    }
    const heightM = state.profile.heightCm / 100
    const points = weights.map((w) => ({ date: w.date, bmi: w.value / (heightM * heightM) }))
    const values = points.map((p) => p.bmi)
    const min = Math.min(...values) - 0.6
    const max = Math.max(...values) + 0.6
    const span = Math.max(1, max - min)
    const px = (i) => (points.length === 1 ? 150 : (i / (points.length - 1)) * 292 + 4)
    const py = (v) => 96 - ((v - min) / span) * 82
    const line = points.map((p, i) => `${px(i).toFixed(1)},${py(p.bmi).toFixed(1)}`).join(' ')
    const guides = [18.5, 25, 30, 35, 40].filter((g) => g > min - 0.5 && g < max + 0.5).map((g) =>
      `<line x1="4" y1="${py(g).toFixed(1)}" x2="296" y2="${py(g).toFixed(1)}"
         stroke="var(--border)" stroke-dasharray="3 4" stroke-width="1"/>
       <text x="296" y="${(py(g) - 3).toFixed(1)}" font-size="8" fill="var(--faint)" text-anchor="end">${g}</text>`).join('')
    const last = points[points.length - 1]
    box.innerHTML = `<h2 style="margin-top:14px">BMI over time</h2>
      <svg class="chart" viewBox="0 0 300 110" preserveAspectRatio="none" role="img" aria-label="BMI trend">
        ${guides}
        <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
        <text x="296" y="106" font-size="9" fill="var(--muted)" text-anchor="end">${last.bmi.toFixed(1)} now</text>
      </svg>`
  } catch { box.innerHTML = '' }
}

// -------------------------------------------------------------------- boot

async function boot() {
  if (!state.token) {
    $('login').classList.remove('hidden')
    $('app').classList.add('hidden')
    $('onboard').classList.add('hidden')
    return
  }
  try {
    await loadProfile()

    // Nobody uses the app before telling it who they are: the calorie maths
    // is personal or it is fiction.
    if (!state.profile.onboarded) {
      showOnboarding()
      return
    }

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserZone && state.profile.timezone !== browserZone && !localStorage.getItem('ff_tz_set')) {
      localStorage.setItem('ff_tz_set', '1')
      await api('/profile', { method: 'PUT', body: JSON.stringify({ ...state.profile, timezone: browserZone }) })
      await loadProfile()
    }

    state.calMonth = state.date.slice(0, 7)
    await loadCalMarks(state.calMonth)
    await loadDay()
    renderWeekStrip()
    syncCalendars()

    $('login').classList.add('hidden')
    $('onboard').classList.add('hidden')
    $('app').classList.remove('hidden')
    showView('today')
  } catch (error) {
    if (state.token) toast(error.message, true)
    signOut()
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

boot()
