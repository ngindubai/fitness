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
}

// ------------------------------------------------------------------- api

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
  setTimeout(() => el.remove(), isError ? 5000 : 2600)
}

// ------------------------------------------------------------------ auth

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

// ------------------------------------------------------------ navigation

const VIEWS = ['today', 'coach', 'meals', 'trends', 'you']

document.querySelectorAll('nav.tabs button').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view))
})

function showView(view) {
  state.view = view
  for (const name of VIEWS) $(`view-${name}`).classList.toggle('hidden', name !== view)
  document.querySelectorAll('nav.tabs button').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.view === view))
  })

  if (view === 'coach') loadReview()
  if (view === 'meals') loadRecommendations()
  if (view === 'trends') loadTrends()
}

// ------------------------------------------------------------ date logic

function shiftDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

$('prev-day').addEventListener('click', () => {
  state.date = shiftDate(state.date, -1)
  loadDay()
})

$('next-day').addEventListener('click', () => {
  if (state.date >= state.today) return
  state.date = shiftDate(state.date, 1)
  loadDay()
})

function labelForDate(iso) {
  if (iso === state.today) return 'Today'
  if (iso === shiftDate(state.today, -1)) return 'Yesterday'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

// ----------------------------------------------------------- entry input

$('kind-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  state.kind = button.dataset.kind
  document.querySelectorAll('#kind-seg button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === button))
  })

  const isMeal = state.kind === 'meal'
  const isWeight = state.kind === 'weight'
  $('slot-seg').classList.toggle('hidden', !isMeal)
  $('entry-text').placeholder = isWeight
    ? '84.2'
    : isMeal
      ? "2 eggs, 3 rashers bacon, wholemeal toast and a black coffee"
      : 'ran 5k in 26 min, then 30 min weights'
  $('entry-text').inputMode = isWeight ? 'decimal' : 'text'
  $('logger-hint').textContent = isWeight
    ? 'Just the number, in kilograms. This also updates the weight your targets are based on.'
    : "Type it how you'd say it. Weights, counts and portions all work."
  clearPreview()
})

$('slot-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  const already = button.getAttribute('aria-pressed') === 'true'
  state.slot = already ? null : button.dataset.slot
  document.querySelectorAll('#slot-seg button').forEach((b) => {
    b.setAttribute('aria-pressed', String(!already && b === button))
  })
})

let parseTimer
$('entry-text').addEventListener('input', () => {
  clearTimeout(parseTimer)
  if (state.kind === 'weight' || !$('entry-text').value.trim()) {
    clearPreview()
    return
  }
  // Debounced so a fast typist does not fire a request per keystroke.
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
  } catch {
    clearPreview()
  }
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
    if (state.kind === 'meal') {
      // Showing the assumed portion ("about 1.4 slices") makes a wrong guess
      // obvious; a bare gram figure hides it.
      const portion = item.portion ? ` &middot; about ${item.portion.count} ${escapeHtml(item.portion.unit)}` : ''
      left.innerHTML = item.recognised
        ? `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal &middot; ${item.protein} g protein${portion}</div>`
        : `<div>${escapeHtml(item.raw)}</div><div class="sub">Not recognised &mdash; this won't be counted</div>`
    } else {
      left.innerHTML = item.recognised
        ? `<div>${escapeHtml(item.name)}</div><div class="sub">${item.kcal} kcal${item.distanceKm ? ` &middot; ${item.distanceKm} km` : ''}</div>`
        : `<div>${escapeHtml(item.raw)}</div><div class="sub">Not recognised &mdash; this won't be counted</div>`
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

/**
 * Re-scale one item locally so portion corrections feel instant. The server
 * recomputes from the food database when the entry is saved, so this is a
 * display convenience rather than the source of truth.
 */
function adjust(index, amount) {
  const items = state.parsed
  const item = items[index]
  if (!item || !Number.isFinite(amount) || amount < 0) return

  if (state.kind === 'meal') {
    const factor = item.grams > 0 ? amount / item.grams : 0
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar']) {
      item[key] = Math.round((item[key] || 0) * factor * 10) / 10
    }
    item.kcal = Math.round(item.kcal)
    item.grams = amount
  } else {
    const factor = item.minutes > 0 ? amount / item.minutes : 0
    item.kcal = Math.round((item.kcal || 0) * factor)
    item.minutes = amount
  }
  renderPreview(items)
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
    if (state.kind === 'weight') {
      await api('/entries', {
        method: 'POST',
        body: JSON.stringify({ kind: 'weight', date: state.date, value: Number(text) }),
      })
      toast('Weight logged.')
    } else {
      await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
          kind: state.kind,
          date: state.date,
          slot: state.slot || undefined,
          text,
          items: state.parsed || undefined,
        }),
      })
      toast('Logged.')
    }
    $('entry-text').value = ''
    clearPreview()
    await loadDay()
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.disabled = false
  }
})

// -------------------------------------------------------------- the day

async function loadDay() {
  const data = await api(`/day?date=${state.date}`)

  $('greeting').textContent = labelForDate(state.date)
  $('date-label').textContent = new Date(`${state.date}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  $('next-day').disabled = state.date >= state.today

  const { day } = data
  const deficit = day.deficit

  $('net-figure').textContent = `${deficit >= 0 ? '' : '+'}${Math.abs(Math.round(deficit)).toLocaleString()}`
  $('net-label').textContent = deficit >= 0 ? 'kcal deficit' : 'kcal surplus'
  $('net-figure').style.color = colourForBalance(day)
  $('kcal-in').textContent = Math.round(day.caloriesIn).toLocaleString()
  $('kcal-out').textContent = Math.round(day.caloriesOut).toLocaleString()

  renderBars(day)
  renderEntries(data.entries)
}

function colourForBalance(day) {
  const goal = day.targets.goal
  if (!day.caloriesIn) return 'var(--muted)'
  if (goal === 'lose') return day.deficit > 0 ? 'var(--good)' : 'var(--bad)'
  if (goal === 'gain') return day.net > 0 ? 'var(--good)' : 'var(--bad)'
  return Math.abs(day.net) < 300 ? 'var(--good)' : 'var(--warn)'
}

function renderBars(day) {
  const rows = [
    { label: 'Calories', value: day.caloriesIn, target: day.targets.calories, unit: '' },
    { label: 'Protein', value: day.nutrition.protein, target: day.targets.protein, unit: 'g' },
    { label: 'Carbs', value: day.nutrition.carbs, target: day.targets.carbs, unit: 'g' },
    { label: 'Fat', value: day.nutrition.fat, target: day.targets.fat, unit: 'g' },
    { label: 'Fibre', value: day.nutrition.fibre, target: day.targets.fibre, unit: 'g' },
  ]

  $('bars').innerHTML = rows.map((row) => {
    const pct = row.target ? (row.value / row.target) * 100 : 0
    // Calories are the one row where overshooting is the failure; for the
    // others, hitting the target is the win.
    const tone = row.label === 'Calories'
      ? (pct > 110 ? 'bad' : pct > 100 ? 'warn' : 'good')
      : (pct >= 90 ? 'good' : pct >= 60 ? 'warn' : 'bad')
    return `
      <div class="bar-row">
        <span class="label">${row.label}</span>
        <span class="bar-track"><span class="bar-fill ${tone}" style="width:${Math.min(100, Math.max(0, pct))}%"></span></span>
        <span class="value">${Math.round(row.value)}${row.unit} / ${Math.round(row.target)}${row.unit}</span>
      </div>`
  }).join('')
}

function renderEntries({ meals, workouts, weights }) {
  const container = $('entries')
  container.innerHTML = ''

  const all = [
    ...meals.map((entry) => ({ entry, kind: 'meal' })),
    ...workouts.map((entry) => ({ entry, kind: 'workout' })),
    ...weights.map((entry) => ({ entry, kind: 'weight' })),
  ].sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt))

  if (!all.length) {
    container.innerHTML = '<p class="empty">Nothing logged yet.</p>'
    return
  }

  for (const { entry, kind } of all) {
    const row = document.createElement('div')
    row.className = 'entry'

    const kcal = (entry.items || []).reduce((sum, item) => sum + (item.kcal || 0), 0)
    const names = (entry.items || []).map((item) => item.name).join(', ')

    const title =
      kind === 'weight' ? `Weight: ${entry.value} kg`
      : kind === 'workout' ? names || entry.raw
      : names || entry.raw

    const sub =
      kind === 'meal' ? (entry.slot || 'meal')
      : kind === 'workout' ? `${(entry.items || []).reduce((s, i) => s + (i.minutes || 0), 0)} min`
      : ''

    row.innerHTML = `
      <div>
        <div class="title">${escapeHtml(title)}</div>
        ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
      </div>
      <div class="kcal">${kind === 'weight' ? '' : `${kind === 'workout' ? '-' : ''}${Math.round(kcal)}`}</div>`

    const del = document.createElement('button')
    del.className = 'del'
    del.textContent = '×'
    del.setAttribute('aria-label', 'Delete entry')
    del.addEventListener('click', async () => {
      await api(`/entries/${entry.id}`, { method: 'DELETE' })
      await loadDay()
    })
    row.appendChild(del)

    container.appendChild(row)
  }
}

// -------------------------------------------------------------- review

$('refresh-review').addEventListener('click', () => loadReview(true))

async function loadReview(force = false) {
  $('findings').innerHTML = '<p class="spinner">Working it out…</p>'

  try {
    const data = await api(`/review?date=${state.date}&ai=1${force ? '&refresh=1' : ''}`)
    const { review, narrative } = data

    $('score').textContent = review.score
    $('score').className = `score ${review.score >= 70 ? 'good' : review.score >= 45 ? 'mid' : 'bad'}`
    $('verdict-label').textContent = review.verdict
    $('verdict-sub').textContent = review.headline

    if (narrative) {
      $('narrative').textContent = narrative
      $('narrative').classList.remove('hidden')
    } else {
      $('narrative').classList.add('hidden')
    }

    $('findings').innerHTML = review.findings
      .map((f) => `<div class="finding ${f.severity}">${escapeHtml(f.text)}</div>`)
      .join('')
  } catch (error) {
    $('findings').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
  }

  try {
    const { week, review } = await api(`/week?end=${state.date}`)
    $('week-stats').innerHTML = [
      ['Avg in', `${week.avgIn.toLocaleString()}`, 'kcal/day'],
      ['Avg out', `${week.avgOut.toLocaleString()}`, 'kcal/day'],
      ['Trend', `${week.projectedKgPerWeek > 0 ? '+' : ''}${week.projectedKgPerWeek}`, 'kg/week'],
      ['Training', `${week.trainingDays}/${week.loggedDays}`, 'days'],
    ].map(([key, n, unit]) => `<div class="stat"><div class="n">${n}</div><div class="k">${key} &middot; ${unit}</div></div>`).join('')

    $('week-findings').innerHTML = review.findings
      .map((f) => `<div class="finding ${f.severity}">${escapeHtml(f.text)}</div>`)
      .join('')
  } catch {
    /* the weekly panel is secondary; a failure here should not blank the page */
  }
}

// --------------------------------------------------------------- meals

$('meal-slot-seg').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  state.mealSlot = button.dataset.mealslot
  document.querySelectorAll('#meal-slot-seg button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === button))
  })
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
        <div class="macros">${meal.macros.kcal} kcal &middot; ${meal.macros.protein}g P &middot;
          ${meal.macros.carbs}g C &middot; ${meal.macros.fat}g F &middot; ${meal.effortMinutes} min</div>
        ${meal.why.length ? `<div class="why">${escapeHtml(meal.why.join('; '))}</div>` : ''}
        <div class="ingredients">${meal.ingredients.map((i) => `${escapeHtml(i.name)} ${i.grams}g`).join(' &middot; ')}</div>
        <button class="btn" data-log-meal="${meal.id}">Log this</button>
      </div>`).join('')

    const aiCards = (data.aiIdeas || []).map((idea) => `
      <div class="meal">
        <div class="name">${escapeHtml(idea.name)}</div>
        <div class="macros">~${idea.estimatedKcal} kcal &middot; ~${idea.estimatedProtein}g protein &middot; suggested</div>
        <div class="why">${escapeHtml(idea.why)}</div>
      </div>`).join('')

    $('recommendations').innerHTML = cards + aiCards +
      `<p class="hint">You have about ${Math.round(data.remaining.kcal)} kcal and
        ${Math.round(data.remaining.protein)} g of protein left today.</p>`

    $('recommendations').querySelectorAll('[data-log-meal]').forEach((button) => {
      button.addEventListener('click', () => logSuggestedMeal(data.meals, button.dataset.logMeal))
    })

    $('favourites').innerHTML = data.taste.favourites.length
      ? data.taste.favourites.map((f) => `<span class="chip">${escapeHtml(f.name)} &times;${f.count}</span>`).join('')
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
  } catch (error) {
    toast(error.message, true)
  }
}

// -------------------------------------------------------------- trends

async function loadTrends() {
  const data = await api('/history?days=30')
  drawBalanceChart(data.days)
  drawWeightChart(data.weights)
}

function drawBalanceChart(days) {
  const svg = $('balance-chart')
  const logged = days.filter((d) => d.logged)
  if (!logged.length) {
    svg.innerHTML = '<text x="150" y="52" fill="#9aa5b4" font-size="11" text-anchor="middle">No data yet</text>'
    return
  }

  const max = Math.max(600, ...days.map((d) => Math.abs(d.net)))
  const width = 300 / days.length
  const mid = 48

  const bars = days.map((day, index) => {
    if (!day.logged) return ''
    const height = (Math.abs(day.net) / max) * 44
    const y = day.net > 0 ? mid - height : mid
    const colour = day.net > 0 ? 'var(--bad)' : 'var(--good)'
    return `<rect x="${index * width + 0.6}" y="${y}" width="${Math.max(1.5, width - 1.2)}" height="${Math.max(1, height)}" fill="${colour}" rx="1"/>`
  }).join('')

  svg.innerHTML = `${bars}<line x1="0" y1="${mid}" x2="300" y2="${mid}" stroke="var(--border)" stroke-width="1"/>`
}

function drawWeightChart(weights) {
  const svg = $('weight-chart')
  if (weights.length < 2) {
    svg.innerHTML = '<text x="150" y="52" fill="#9aa5b4" font-size="11" text-anchor="middle">Log weight twice to see a trend</text>'
    $('weight-hint').textContent = 'Log your weight from the Today tab to build this up.'
    return
  }

  const values = weights.map((w) => w.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(0.5, max - min)

  const points = weights.map((w, index) => {
    const x = (index / (weights.length - 1)) * 300
    const y = 88 - ((w.value - min) / span) * 76
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  svg.innerHTML =
    `<polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>`

  const change = values[values.length - 1] - values[0]
  $('weight-hint').textContent =
    `${values[0]} kg to ${values[values.length - 1]} kg over ${weights.length} weigh-ins ` +
    `(${change >= 0 ? '+' : ''}${change.toFixed(1)} kg).`
}

// ------------------------------------------------------------- profile

async function loadProfile() {
  const { profile, options, targets, today } = await api('/profile')
  state.profile = profile
  state.today = today
  if (!state.date) state.date = today

  $('p-name').value = profile.name || ''
  $('p-sex').value = profile.sex
  $('p-age').value = profile.age
  $('p-height').value = profile.heightCm
  $('p-weight').value = profile.weightKg
  $('p-rate').value = profile.rateKgPerWeek
  $('p-timezone').value = profile.timezone

  $('p-baseline').innerHTML = Object.entries(options.baselines)
    .map(([key, v]) => `<option value="${key}">${v.label}</option>`).join('')
  $('p-baseline').value = profile.baseline

  $('p-goal').innerHTML = Object.entries(options.goals)
    .map(([key, v]) => `<option value="${key}">${v.label}</option>`).join('')
  $('p-goal').value = profile.goal

  renderTargetSummary(targets)
}

function renderTargetSummary(targets) {
  $('targets-summary').textContent =
    `Resting metabolic rate about ${targets.bmr.toLocaleString()} kcal. With your daily activity, ` +
    `maintenance is around ${targets.baseline.toLocaleString()} kcal before any training. ` +
    `Target: ${targets.calories.toLocaleString()} kcal, ${targets.protein} g protein, ` +
    `${targets.fibre} g fibre.` + (targets.capNote ? ` ${targets.capNote}` : '')
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
      }),
    })
    state.profile = profile
    renderTargetSummary(targets)
    toast('Saved.')
    await loadDay()
  } catch (error) {
    toast(error.message, true)
  }
})

// ---------------------------------------------------------------- boot

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ))
}

async function boot() {
  if (!state.token) {
    $('login').classList.remove('hidden')
    $('app').classList.add('hidden')
    return
  }

  try {
    await loadProfile()

    // Adopt the browser's timezone on first run so dates line up without the
    // user having to think about it.
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserZone && state.profile.timezone !== browserZone && !localStorage.getItem('ff_tz_set')) {
      localStorage.setItem('ff_tz_set', '1')
      await api('/profile', { method: 'PUT', body: JSON.stringify({ ...state.profile, timezone: browserZone }) })
      await loadProfile()
    }

    await loadDay()
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
