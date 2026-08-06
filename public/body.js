/**
 * The body heat map: two stylised figures (front and back) whose muscle
 * regions are coloured by whatever the caller computes — effort over a date
 * range, or live recovery state. Pure SVG, drawn here, no images.
 */

const NS = 'http://www.w3.org/2000/svg'

// One entry per drawable region. `mirror: true` draws the shape twice,
// reflected around its figure's centre line, because bodies are symmetric
// and authoring one side is enough.
const FRONT_CX = 90
const BACK_CX = 270

const REGIONS = [
  // ------------------------------------------------------------- front view
  { muscle: 'traps', view: 'front', shape: { t: 'ellipse', cx: 74, cy: 52, rx: 10, ry: 5.5 }, mirror: true },
  { muscle: 'front_delts', view: 'front', shape: { t: 'ellipse', cx: 67, cy: 63, rx: 7.5, ry: 9.5 }, mirror: true },
  { muscle: 'side_delts', view: 'front', shape: { t: 'ellipse', cx: 56, cy: 66, rx: 6.5, ry: 11 }, mirror: true },
  { muscle: 'chest', view: 'front', shape: { t: 'ellipse', cx: 78, cy: 82, rx: 13.5, ry: 12 }, mirror: true },
  { muscle: 'biceps', view: 'front', shape: { t: 'ellipse', cx: 52, cy: 96, rx: 7, ry: 13.5 }, mirror: true },
  { muscle: 'forearms', view: 'front', shape: { t: 'ellipse', cx: 47, cy: 128, rx: 6, ry: 15.5 }, mirror: true },
  { muscle: 'abs', view: 'front', shape: { t: 'rect', x: 81, y: 97, w: 18, h: 44, rx: 8 } },
  { muscle: 'obliques', view: 'front', shape: { t: 'ellipse', cx: 68, cy: 115, rx: 6.5, ry: 17 }, mirror: true },
  { muscle: 'quads', view: 'front', shape: { t: 'ellipse', cx: 74, cy: 184, rx: 9.5, ry: 33 }, mirror: true },
  { muscle: 'adductors', view: 'front', shape: { t: 'ellipse', cx: 86, cy: 168, rx: 4.5, ry: 20 }, mirror: true },
  { muscle: 'calves', view: 'front', shape: { t: 'ellipse', cx: 79, cy: 240, rx: 7, ry: 18 }, mirror: true },

  // -------------------------------------------------------------- back view
  { muscle: 'traps', view: 'back', shape: { t: 'path', d: 'M 270 44 L 288 56 L 276 84 L 264 84 L 252 56 Z' } },
  { muscle: 'rear_delts', view: 'back', shape: { t: 'ellipse', cx: 247, cy: 63, rx: 7.5, ry: 9 }, mirror: true },
  { muscle: 'side_delts', view: 'back', shape: { t: 'ellipse', cx: 236, cy: 66, rx: 6, ry: 11 }, mirror: true },
  { muscle: 'mid_back', view: 'back', shape: { t: 'ellipse', cx: 270, cy: 96, rx: 10, ry: 11 } },
  { muscle: 'lats', view: 'back', shape: { t: 'ellipse', cx: 254, cy: 100, rx: 10, ry: 21, rotate: 10 }, mirror: true },
  { muscle: 'lower_back', view: 'back', shape: { t: 'ellipse', cx: 270, cy: 124, rx: 8.5, ry: 9 } },
  { muscle: 'triceps', view: 'back', shape: { t: 'ellipse', cx: 233, cy: 96, rx: 7, ry: 13.5 }, mirror: true },
  { muscle: 'forearms', view: 'back', shape: { t: 'ellipse', cx: 227, cy: 128, rx: 6, ry: 15.5 }, mirror: true },
  { muscle: 'glutes', view: 'back', shape: { t: 'ellipse', cx: 261, cy: 146, rx: 10.5, ry: 12 }, mirror: true },
  { muscle: 'hamstrings', view: 'back', shape: { t: 'ellipse', cx: 258, cy: 182, rx: 10.5, ry: 26 }, mirror: true },
  { muscle: 'calves', view: 'back', shape: { t: 'ellipse', cx: 259, cy: 238, rx: 8, ry: 19 }, mirror: true },
]

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

function shapeNode(shape, cx) {
  let node
  if (shape.t === 'ellipse') {
    node = el('ellipse', { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry })
    if (shape.rotate) node.setAttribute('transform', `rotate(${shape.rotate} ${shape.cx} ${shape.cy})`)
  } else if (shape.t === 'rect') {
    node = el('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: shape.rx ?? 4 })
  } else {
    node = el('path', { d: shape.d })
  }
  return node
}

function mirrored(shape, cx) {
  const flip = (x) => 2 * cx - x
  if (shape.t === 'ellipse') return { ...shape, cx: flip(shape.cx), rotate: shape.rotate ? -shape.rotate : 0 }
  if (shape.t === 'rect') return { ...shape, x: flip(shape.x) - shape.w }
  return shape
}

/** Faint scaffolding so the muscle blobs read as a person. */
function scaffolding(svg) {
  const g = el('g', { class: 'body-frame' })
  for (const cx of [FRONT_CX, BACK_CX]) {
    g.appendChild(el('circle', { cx, cy: 28, r: 13 }))                       // head
    g.appendChild(el('rect', { x: cx - 5, y: 40, width: 10, height: 9, rx: 3 }))   // neck
    g.appendChild(el('rect', { x: cx - 27, y: 50, width: 54, height: 95, rx: 20 })) // torso
    g.appendChild(el('rect', { x: cx - 37, y: 56, width: 13, height: 92, rx: 6 })) // arms
    g.appendChild(el('rect', { x: cx + 24, y: 56, width: 13, height: 92, rx: 6 }))
    g.appendChild(el('rect', { x: cx - 24, y: 143, width: 21, height: 122, rx: 9 })) // legs
    g.appendChild(el('rect', { x: cx + 3, y: 143, width: 21, height: 122, rx: 9 }))
  }
  svg.appendChild(g)
}

/**
 * Render (or re-render) the two-figure body map into `container`.
 *
 * @param {HTMLElement} container
 * @param {(muscleId: string) => {fill: string, opacity: number, title?: string}} colourFor
 * @param {(muscleId: string) => void} [onTap]
 */
export function renderBodyMap(container, colourFor, onTap) {
  container.textContent = ''
  const svg = el('svg', { viewBox: '0 0 360 290', class: 'body-map', role: 'img' })
  svg.setAttribute('aria-label', 'Muscle map, front and back')
  scaffolding(svg)

  for (const region of REGIONS) {
    const cx = region.view === 'front' ? FRONT_CX : BACK_CX
    const style = colourFor(region.muscle) || { fill: 'transparent', opacity: 0.15 }
    const shapes = [region.shape]
    if (region.mirror) shapes.push(mirrored(region.shape, cx))
    for (const shape of shapes) {
      const node = shapeNode(shape, cx)
      node.setAttribute('class', 'body-muscle')
      node.setAttribute('fill', style.fill)
      node.setAttribute('fill-opacity', String(style.opacity))
      node.setAttribute('data-muscle', region.muscle)
      if (style.title) {
        const title = el('title')
        title.textContent = style.title
        node.appendChild(title)
      }
      if (onTap) node.addEventListener('click', () => onTap(region.muscle))
      svg.appendChild(node)
    }
  }

  const frontLabel = el('text', { x: FRONT_CX, y: 285, class: 'body-label', 'text-anchor': 'middle' })
  frontLabel.textContent = 'Front'
  const backLabel = el('text', { x: BACK_CX, y: 285, class: 'body-label', 'text-anchor': 'middle' })
  backLabel.textContent = 'Back'
  svg.appendChild(frontLabel)
  svg.appendChild(backLabel)

  container.appendChild(svg)
}
