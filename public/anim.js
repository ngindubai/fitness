/**
 * Movement animation engine.
 *
 * Draws a side-view (or front-view) figure as thick rounded limbs with
 * visible joints, interpolates smoothly between authored poses, pulses a
 * soft glow over the muscle the exercise is supposed to work, and captions
 * each phase ("squeeze for two seconds") in sync with the motion.
 *
 * Poses are authored with the hip position, torso angle and *end-point*
 * targets (ankles, wrists); knees and elbows are solved with two-bone IK so
 * limbs always read anatomically, whatever the in-between frame.
 */

const NS = 'http://www.w3.org/2000/svg'

// Segment lengths, shared by every figure so proportions stay consistent.
const TORSO = 42
const THIGH = 33
const SHIN = 33
const UPPER = 24
const FORE = 22
const HEAD_R = 9.5
const FOOT = 13

const rad = (deg) => (deg * Math.PI) / 180

/** Two-bone IK: joint between `a` and `b` for limbs l1+l2, bending to `side`. */
function solveJoint(a, b, l1, l2, side = 1) {
  let dx = b[0] - a[0]
  let dy = b[1] - a[1]
  let d = Math.hypot(dx, dy)
  const max = l1 + l2 - 0.01
  if (d > max) {
    dx *= max / d; dy *= max / d; d = max
    b = [a[0] + dx, a[1] + dy]
  }
  if (d < 1) d = 1
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along))
  const ux = dx / d
  const uy = dy / d
  return {
    joint: [a[0] + ux * along - uy * h * side, a[1] + uy * along + ux * h * side],
    end: b,
  }
}

/** Forward-solve a full pose into named joint coordinates. */
function solvePose(pose) {
  const [hx, hy] = pose.hip
  const t = rad(pose.torso || 0)
  const shoulder = [hx + TORSO * Math.sin(t), hy - TORSO * Math.cos(t)]
  const headA = rad((pose.torso || 0) + (pose.headTilt || 0))
  const head = [
    shoulder[0] + (HEAD_R + 5.5) * Math.sin(headA),
    shoulder[1] - (HEAD_R + 5.5) * Math.cos(headA),
  ]

  const legs = (pose.ankles || []).map((ankle, i) => {
    const bend = (pose.legBend || [1, 1])[i] ?? 1
    const { joint, end } = solveJoint(pose.hip, ankle, THIGH, SHIN, bend)
    const footA = rad((pose.feet || [0, 0])[i] ?? 0)
    const toe = [end[0] + FOOT * Math.cos(footA), end[1] + FOOT * Math.sin(footA)]
    return { knee: joint, ankle: end, toe }
  })

  const arms = (pose.wrists || []).map((wrist, i) => {
    if (!wrist) return null
    const target = pose.wristsRel ? [shoulder[0] + wrist[0], shoulder[1] + wrist[1]] : wrist
    const bend = (pose.armBend || [1, 1])[i] ?? 1
    const { joint, end } = solveJoint(shoulder, target, UPPER, FORE, bend)
    return { elbow: joint, wrist: end }
  })

  return { hip: pose.hip, shoulder, head, legs, arms }
}

/** Deep numeric interpolation between two poses (same shape). */
function lerpPose(a, b, t) {
  const mix = (x, y) => x + (y - x) * t
  const walk = (u, v) => {
    if (typeof u === 'number') return mix(u, v)
    if (Array.isArray(u)) return u.map((item, i) => walk(item, v[i]))
    if (u && typeof u === 'object') {
      const out = {}
      for (const key of Object.keys(u)) out[key] = walk(u[key], v[key])
      return out
    }
    return t < 0.5 ? u : v
  }
  return walk(a, b)
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

function line(group, cls, a, b, width) {
  const node = el('line', { class: cls, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })
  if (width) node.setAttribute('stroke-width', width)
  group.appendChild(node)
  return node
}

function dot(group, cls, p, r) {
  const node = el('circle', { class: cls, cx: p[0], cy: p[1], r })
  group.appendChild(node)
  return node
}

// ------------------------------------------------------------------- props

function drawDumbbell(group, at, vertical = false) {
  const g = el('g', { class: 'fig-wt' })
  const w = 17
  const h = 5
  if (vertical) {
    g.appendChild(el('rect', { x: at[0] - h / 2, y: at[1] - w / 2, width: h, height: w, rx: 1.6 }))
    g.appendChild(el('rect', { x: at[0] - 5, y: at[1] - w / 2 - 2.6, width: 10, height: 2.8, rx: 1.2 }))
    g.appendChild(el('rect', { x: at[0] - 5, y: at[1] + w / 2 - 0.2, width: 10, height: 2.8, rx: 1.2 }))
  } else {
    g.appendChild(el('rect', { x: at[0] - w / 2, y: at[1] - h / 2, width: w, height: h, rx: 1.6 }))
    g.appendChild(el('rect', { x: at[0] - w / 2 - 2.6, y: at[1] - 5, width: 2.8, height: 10, rx: 1.2 }))
    g.appendChild(el('rect', { x: at[0] + w / 2 - 0.2, y: at[1] - 5, width: 2.8, height: 10, rx: 1.2 }))
  }
  group.appendChild(g)
}

function propAnchor(name, joints) {
  switch (name) {
    case 'wrist0': return joints.arms[0]?.wrist
    case 'wrist1': return joints.arms[1]?.wrist
    case 'hips': return [joints.hip[0], joints.hip[1] - 8]
    case 'goblet': {
      const s = joints.shoulder
      const h = joints.hip
      return [s[0] + (h[0] - s[0]) * 0.3 + 13, s[1] + (h[1] - s[1]) * 0.3 + 2]
    }
    default: return null
  }
}

function drawProps(group, props, joints) {
  for (const prop of props || []) {
    if (prop.t === 'dumbbell') {
      const targets = prop.at === 'wrists' ? ['wrist0', 'wrist1'] : [prop.at]
      for (const target of targets) {
        const at = propAnchor(target, joints)
        if (at) drawDumbbell(group, at, prop.vertical)
      }
    }
    if (prop.t === 'bar') {
      const a = joints.arms[0]?.wrist
      const b = joints.arms[1]?.wrist
      if (a && b) {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len = Math.hypot(dx, dy) || 1
        const ux = (dx / len) * 14
        const uy = (dy / len) * 14
        line(group, 'fig-cable', mid, prop.cable, 1.6)
        line(group, 'fig-bar', [a[0] - ux, a[1] - uy], [b[0] + ux, b[1] + uy], 4.5)
      }
    }
    if (prop.t === 'handle') {
      const a = joints.arms[0]?.wrist
      if (a) {
        line(group, 'fig-cable', a, prop.cable, 1.6)
        line(group, 'fig-bar', [a[0], a[1] - 6], [a[0], a[1] + 6], 4.5)
      }
    }
    if (prop.t === 'band') {
      const a = joints.legs[0]?.knee
      const b = joints.legs[1]?.knee
      if (a && b) line(group, 'fig-band', [a[0], a[1] + 3], [b[0], b[1] + 3], 5)
    }
  }
}

// ------------------------------------------------------------------ figure

function drawFigure(group, joints, spec, glowLevel) {
  group.textContent = ''

  // Glow under everything so the limbs stay crisp on top of it.
  if (spec.glow && glowLevel > 0.02) {
    const base = spec.glow.joint === 'shoulder' ? joints.shoulder
      : spec.glow.joint === 'torsoMid'
        ? [(joints.hip[0] + joints.shoulder[0]) / 2, (joints.hip[1] + joints.shoulder[1]) / 2]
        : spec.glow.joint === 'knee0' ? joints.legs[0].knee
          : spec.glow.joint === 'thighMid0'
            ? [(joints.hip[0] + joints.legs[0].knee[0]) / 2, (joints.hip[1] + joints.legs[0].knee[1]) / 2]
            : spec.glow.joint === 'upperArmMid0'
              ? [(joints.shoulder[0] + joints.arms[0].elbow[0]) / 2, (joints.shoulder[1] + joints.arms[0].elbow[1]) / 2]
              : joints.hip
    const points = spec.glow.mirror
      ? [base, [2 * ((joints.hip[0] + joints.shoulder[0]) / 2) - base[0], base[1]]]
      : [base]
    for (const p of points) {
      const g = dot(group, 'fig-glow', [p[0] + (spec.glow.dx || 0), p[1] + (spec.glow.dy || 0)], 13)
      g.setAttribute('opacity', (0.55 * glowLevel).toFixed(2))
      const ring = dot(group, 'fig-glow-ring', [p[0] + (spec.glow.dx || 0), p[1] + (spec.glow.dy || 0)], 13 + 4 * glowLevel)
      ring.setAttribute('opacity', (0.8 * glowLevel).toFixed(2))
    }
  }

  const far = el('g', { class: 'fig-far' })
  const near = el('g', { class: 'fig-near' })
  group.appendChild(far)

  const drawLeg = (target, leg) => {
    if (!leg) return
    line(target, 'fig-bone', joints.hip, leg.knee)
    line(target, 'fig-bone', leg.knee, leg.ankle)
    line(target, 'fig-foot', leg.ankle, leg.toe)
    dot(target, 'fig-joint', leg.knee, 2.6)
  }
  const drawArm = (target, arm) => {
    if (!arm) return
    line(target, 'fig-bone arm', joints.shoulder, arm.elbow)
    line(target, 'fig-bone arm', arm.elbow, arm.wrist)
    dot(target, 'fig-joint', arm.elbow, 2.3)
  }

  drawLeg(far, joints.legs[1])
  drawArm(far, joints.arms[1])

  // Torso and head sit between the far and near limbs.
  line(group, 'fig-torso', joints.hip, joints.shoulder)
  dot(group, 'fig-joint', joints.hip, 3)
  dot(group, 'fig-joint', joints.shoulder, 3)
  dot(group, 'fig-head', joints.head, HEAD_R)

  group.appendChild(near)
  drawLeg(near, joints.legs[0])
  drawArm(near, joints.arms[0])

  drawProps(near, spec.props, joints)
}

// ------------------------------------------------------------------ scene

function drawScene(svg, spec) {
  const g = el('g', { class: 'fig-scene' })
  line(g, 'fig-ground', [8, spec.ground ?? 172], [232, spec.ground ?? 172], 2)
  for (const shape of spec.scene || []) {
    if (shape.t === 'rect') g.appendChild(el('rect', { class: 'fig-kit', x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: shape.rx ?? 2.5 }))
    if (shape.t === 'line') line(g, 'fig-kit-line', [shape.x1, shape.y1], [shape.x2, shape.y2], shape.w || 2.5)
    if (shape.t === 'circle') g.appendChild(el('circle', { class: 'fig-kit', cx: shape.cx, cy: shape.cy, r: shape.r }))
  }
  svg.appendChild(g)
}

// ------------------------------------------------------------------ mount

/**
 * Mount a movement animation into `container`.
 * @returns {{destroy():void}}
 */
export function mountAnimation(container, spec, { static: isStatic = false, caption = true } = {}) {
  const svg = el('svg', { viewBox: spec.viewBox || '0 0 240 190', class: 'fig', role: 'img' })
  svg.setAttribute('aria-label', `${spec.name} — movement diagram`)
  drawScene(svg, spec)
  const figure = el('g')
  svg.appendChild(figure)
  container.appendChild(svg)

  let captionEl = null
  if (caption && !isStatic) {
    captionEl = document.createElement('div')
    captionEl.className = 'fig-caption'
    container.appendChild(captionEl)
  }

  const phases = spec.phases
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const render = (pose, glow) => drawFigure(figure, solvePose(pose), spec, glow)

  if (isStatic) {
    render(spec.poses[spec.thumb ?? 0], 0)
    return { destroy: () => svg.remove() }
  }

  let raf = null
  let timer = null
  let paused = false
  let phaseIdx = 0
  let phaseStart = performance.now()
  let fromPose = spec.poses[phases[phases.length - 1].pose]

  const setCaption = (phase) => {
    if (!captionEl) return
    captionEl.textContent = phase.label || ''
    captionEl.classList.toggle('bad', !!phase.bad)
    svg.classList.toggle('bad', !!phase.bad)
  }

  const step = (now) => {
    if (paused) return
    const phase = phases[phaseIdx]
    const t = Math.min(1, (now - phaseStart) / phase.dur)
    const to = spec.poses[phase.pose]
    const prevGlow = phases[(phaseIdx + phases.length - 1) % phases.length].glow || 0
    const glow = prevGlow + ((phase.glow || 0) - prevGlow) * t
    render(lerpPose(fromPose, to, easeInOut(t)), glow)
    if (t >= 1) {
      fromPose = to
      phaseIdx = (phaseIdx + 1) % phases.length
      phaseStart = now
      setCaption(phases[phaseIdx])
    }
    raf = requestAnimationFrame(step)
  }

  if (reduced) {
    // No motion: step through the key poses slowly instead.
    let i = 0
    const flip = () => {
      const phase = phases[i % phases.length]
      render(spec.poses[phase.pose], phase.glow || 0)
      setCaption(phase)
      i += 1
      timer = setTimeout(flip, 2200)
    }
    flip()
  } else {
    setCaption(phases[0])
    raf = requestAnimationFrame(step)
  }

  const toggle = () => {
    paused = !paused
    svg.classList.toggle('paused', paused)
    if (!paused && !reduced) {
      phaseStart = performance.now()
      raf = requestAnimationFrame(step)
    }
  }
  svg.addEventListener('click', toggle)

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
      svg.remove()
      captionEl?.remove()
    },
  }
}
