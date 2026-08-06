/**
 * Front end. Vanilla ES modules, no build step — what you read here is what
 * runs in the browser.
 */

const $ = (id) => document.getElementById(id)

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
  if (response.status === 401) {
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

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  $('login-error').textContent = ''
  try {
    const { token } = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ passcode: $('passcode').value }),
    })
    state.token = token
    localStorage.setItem('ff_token', token)
    $('passcode').value = ''
    await boot()
  } catch (error) {
    $('login-error').textContent = error.message
  }
})

function signOut() {
  state.token = null
  localStorage.removeItem('ff_token')
  $('app').classList.add('hidden')
  $('login').classList.remove('hidden')
}

$('logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {})
  signOut()
})

// -------------------------------------------------------------- navigation

const VIEWS = ['today', 'coach', 'stats', 'meals', 'you']

document.querySelectorAll('nav.tabs button, .side-nav button').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view))
})

function showView(view) {
  state.view = view
  for (const name of VIEWS) $(`view-${name}`).classList.toggle('hidden', name !== view)
  document.querySelectorAll('nav.tabs button, .side-nav button').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.view === view))
  })
  if (view === 'coach') loadReview()
  if (view === 'stats') loadStats()
  if (view === 'meals') loadRecommendations()
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
    if (!item.recognised) {
      left.innerHTML = `<div>${escapeHtml(item.raw)}</div><div class="sub">Not recognised — this won't be counted</div>`
    } else if (state.kind === 'meal') {
      const portion = item.portion ? ` · about ${item.portion.count} ${escapeHtml(item.portion.unit)}` : ''
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal · ${item.protein} g protein${portion}</div>`
    } else if (item.exercise) {
      const vol = item.exercise.volume ? ` · ${item.exercise.volume.toLocaleString()} kg volume` : ''
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">~${item.minutes} min · ${item.kcal} kcal${vol}</div>`
    } else {
      const extras = [item.distanceKm ? `${item.distanceKm} km` : null, item.heatAdjusted ? 'heat adjusted' : null].filter(Boolean)
      left.innerHTML = `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal${extras.length ? ' · ' + extras.join(' · ') : ''}</div>`
    }
    row.appendChild(left)

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

  $('greeting').textContent = labelForDate(state.date)
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
  $('ring-big').textContent = Math.abs(left).toLocaleString()
  $('ring-sub').textContent = left >= 0 ? 'kcal left' : 'kcal over'

  $('kcal-in').textContent = Math.round(day.caloriesIn).toLocaleString()
  $('kcal-out').textContent = Math.round(day.caloriesOut).toLocaleString()
  $('net-label').textContent = day.deficit >= 0 ? 'Deficit' : 'Surplus'
  $('net-figure').textContent = Math.abs(Math.round(day.net)).toLocaleString()
  $('net-figure').style.color = day.caloriesIn === 0 ? 'var(--muted)' : day.deficit >= 0 ? 'var(--good)' : 'var(--bad)'

  renderBars(day)
  renderWater(day)
  renderEntries(data.entries)
  state.lastLoggedId = null
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

    if (kind === 'meal') {
      const portion = item.portion ? ` · ~${item.portion.count} ${item.portion.unit}` : ''
      row.innerHTML = `
        <span>${escapeHtml(item.name)}<span class="meta" style="display:block">${item.kcal} kcal · ${item.protein}g P${portion}</span></span>
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
      [summary.totalSets || 0, 'working sets'],
      [litres(summary.avgWaterMl), 'avg water'],
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
      [summary.alcoholDays, 'alcohol days'],
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
  const { profile, options, targets, today } = await api('/profile')
  state.profile = profile
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
    const { profile, targets } = await api('/profile', {
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
      }),
    })
    state.profile = profile
    renderTargetSummary(targets)
    toast('Saved.')
    await loadDay()
  } catch (error) { toast(error.message, true) }
})

// -------------------------------------------------------------------- boot

async function boot() {
  if (!state.token) {
    $('login').classList.remove('hidden')
    $('app').classList.add('hidden')
    return
  }
  try {
    await loadProfile()

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
