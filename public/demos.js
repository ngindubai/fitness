/**
 * Form demos for every exercise on the menu.
 *
 * The plan movements carry full authored guides (movements.js). Everything
 * else gets a pattern demo from here: a compact two-or-three pose animation
 * of the movement's shape, rendered by the same anim.js engine. These are
 * deliberately simpler than the authored guides — the point is "this is the
 * motion", not a coaching session — and every one of the 110 menu entries
 * resolves to one or the other, which a test enforces.
 *
 * All figures face right. Floor at y=172, standing ankles at y=167.
 */

import { findMovement, MOVEMENTS_BY_ID } from './movements.js'

const STAND = [[119, 167], [105, 167]]
const KF = [-1, -1] // knees forward

const stand = (extra = {}) => ({
  hip: [112, 107], torso: 4, ankles: STAND, legBend: KF,
  wrists: [[122, 150], [116, 152]], armBend: [1, 1], ...extra,
})

/** A→B→A loop with sensible captions. */
const loop = (a, b, { down = 'Lower under control', up = 'Drive back', hold, dur = 1300 } = {}) => ({
  poses: [a, b],
  phases: [
    { pose: 0, dur: 500, label: 'Set — brace' },
    { pose: 1, dur, label: down },
    ...(hold ? [{ pose: 1, dur: 400, label: hold }] : [{ pose: 1, dur: 250, label: '' }]),
    { pose: 0, dur: Math.round(dur * 0.75), label: up, glow: 1 },
    { pose: 0, dur: 400, label: '', glow: 0.4 },
  ],
})

// ------------------------------------------------------------ pattern bank

const SQUAT_STAND = { hip: [112, 107], torso: 4, ankles: STAND, legBend: KF, wristsRel: true, wrists: [[9, 3], [7, 5]], armBend: [1, 1] }
const SQUAT_DEEP = { hip: [98, 140], torso: 24, ankles: STAND, legBend: KF, wristsRel: true, wrists: [[9, 3], [7, 5]], armBend: [1, 1] }

function backSquat(over = {}) {
  return {
    glow: { joint: 'thighMid0', dx: 4, dy: 0 },
    props: [{ t: 'plate', r: 7 }],
    ...loop(SQUAT_STAND, SQUAT_DEEP, { down: 'Sit down between your feet', up: 'Drive up through mid-foot' }),
    ...over,
  }
}

const HINGE_TOP = { hip: [112, 107], torso: 3, ankles: STAND, legBend: KF, wrists: [[122, 151], [118, 153]], armBend: [1, 1] }
const HINGE_BOTTOM = { hip: [102, 122], torso: 62, headTilt: -25, ankles: STAND, legBend: KF, wrists: [[130, 156], [126, 158]], armBend: [1, 1] }

function hinge(over = {}) {
  return {
    glow: { joint: 'hip', dx: -9, dy: -2 },
    props: [{ t: 'plate', r: 7 }],
    poses: [HINGE_BOTTOM, HINGE_TOP],
    phases: [
      { pose: 0, dur: 500, label: 'Flat back — bar close' },
      { pose: 1, dur: 1200, label: 'Stand up — hips through', glow: 1 },
      { pose: 1, dur: 400, label: 'Tall lockout, no lean-back', glow: 0.5 },
      { pose: 0, dur: 1100, label: 'Hips back to lower' },
    ],
    ...over,
  }
}

const PLANK_TOP = { hip: [96, 149], torso: 88, headTilt: -55, ankles: [[54, 166], [50, 166]], feet: [70, 70], legBend: [1, 1], wrists: [[128, 166], [124, 166]], armBend: [1, 1] }
const PLANK_LOW = { hip: [96, 158], torso: 88, headTilt: -55, ankles: [[54, 166], [50, 166]], feet: [70, 70], legBend: [1, 1], wrists: [[128, 166], [124, 166]], armBend: [1, 1] }

const QUAD_BASE = { hip: [96, 142], torso: 86, headTilt: -45, ankles: [[64, 166], [60, 166]], feet: [70, 70], legBend: [1, 1], wrists: [[130, 166], [126, 166]], armBend: [1, 1] }

const HANG_BAR = { scene: [{ t: 'line', x1: 84, y1: 52, x2: 150, y2: 52, w: 3 }, { t: 'line', x1: 90, y1: 52, x2: 90, y2: 172, w: 2 }, { t: 'line', x1: 144, y1: 52, x2: 144, y2: 172, w: 2 }] }
const HANG_DOWN = { hip: [114, 147], torso: 2, ankles: [[118, 162], [110, 162]], feet: [60, 60], legBend: [1, 1], wrists: [[122, 54], [108, 54]], armBend: [-1, -1] }
const HANG_UP = { hip: [114, 122], torso: 2, ankles: [[118, 148], [110, 148]], feet: [60, 60], legBend: [1, 1], wrists: [[122, 54], [108, 54]], armBend: [-1, -1] }

const LYING_FLAT = { hip: [95, 158], torso: -92, headTilt: 0, ankles: [[126, 166], [122, 166]], legBend: [-1, -1], wrists: [[116, 130], [112, 132]], armBend: [1, 1] }

function benchScene(x = 74, w = 60) {
  return [{ t: 'rect', x, y: 150, w, h: 7, rx: 2 }, { t: 'line', x1: x + 8, y1: 157, x2: x + 8, y2: 170, w: 3 }, { t: 'line', x1: x + w - 8, y1: 157, x2: x + w - 8, y2: 170, w: 3 }]
}

// ------------------------------------------------- demos per exercise id

const D = {}

// Squat family --------------------------------------------------------
D.squat = () => backSquat()
D.front_squat = () => backSquat({ props: [{ t: 'plate', r: 7 }] })
D.hack_squat = () => ({ ...backSquat(), scene: [{ t: 'line', x1: 84, y1: 70, x2: 96, y2: 168, w: 4 }] })
D.sumo_squat = () => backSquat({
  poses: [
    { ...SQUAT_STAND, ankles: [[130, 167], [94, 167]] },
    { ...SQUAT_DEEP, hip: [104, 138], ankles: [[130, 167], [94, 167]] },
  ],
})
D.sissy_squat = () => loopSpec(
  { hip: [112, 107], torso: 2, ankles: STAND, legBend: KF, wrists: [[120, 128], [114, 130]], armBend: [1, 1] },
  { hip: [122, 128], torso: -24, ankles: STAND, feet: [-30, -30], legBend: KF, wrists: [[130, 148], [124, 150]], armBend: [1, 1] },
  { glow: { joint: 'thighMid0', dx: 4, dy: 0 }, down: 'Knees forward, lean back — one line', up: 'Pull back up with the quads' },
)
D.pistol_squat = () => loopSpec(
  { hip: [112, 107], torso: 4, ankles: [[119, 167], [140, 158]], legBend: [-1, -1], wrists: [[150, 120], [144, 122]], armBend: [1, 1] },
  { hip: [96, 142], torso: 26, ankles: [[119, 167], [152, 138]], legBend: [-1, -1], wrists: [[152, 122], [146, 124]], armBend: [1, 1] },
  { glow: { joint: 'thighMid0', dx: 4, dy: 0 }, down: 'One leg out — sit down slowly', up: 'Stand without tipping' },
)
D.wall_sit = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'line', x1: 84, y1: 60, x2: 84, y2: 172, w: 3 }],
  poses: [
    { hip: [90, 138], torso: 0, ankles: [[122, 167], [108, 167]], legBend: KF, wrists: [[98, 158], [92, 160]], armBend: [1, 1] },
    { hip: [90, 140], torso: 0, ankles: [[122, 167], [108, 167]], legBend: KF, wrists: [[98, 160], [92, 162]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 1600, label: 'Back flat on the wall, thighs level', glow: 0.8 },
    { pose: 1, dur: 1600, label: 'Breathe — quads burning is the point', glow: 1 },
  ],
})
D.jump_squat = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  poses: [
    SQUAT_STAND,
    { ...SQUAT_DEEP, hip: [100, 136] },
    { hip: [112, 92], torso: 2, ankles: [[120, 152], [106, 152]], feet: [40, 40], legBend: KF, wristsRel: true, wrists: [[10, 18], [8, 20]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 1, dur: 600, label: 'Dip fast' },
    { pose: 2, dur: 350, label: 'Explode off the floor', glow: 1 },
    { pose: 0, dur: 450, label: 'Land soft, knees out', glow: 0.4 },
    { pose: 0, dur: 300, label: '' },
  ],
})
D.leg_press = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'rect', x: 64, y: 128, w: 30, h: 10, rx: 2 }, { t: 'line', x1: 150, y1: 96, x2: 172, y2: 150, w: 5 }],
  poses: [
    { hip: [92, 136], torso: -28, ankles: [[142, 112], [136, 118]], feet: [-70, -70], legBend: [-1, -1], wrists: [[100, 150], [94, 152]], armBend: [1, 1] },
    { hip: [92, 136], torso: -28, ankles: [[118, 128], [112, 132]], feet: [-70, -70], legBend: [-1, -1], wrists: [[100, 150], [94, 152]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 1, dur: 1200, label: 'Sled down slow — knees to chest' },
    { pose: 0, dur: 900, label: 'Press away, never lock hard', glow: 1 },
    { pose: 0, dur: 350, label: '', glow: 0.4 },
  ],
})

// Hinge family --------------------------------------------------------
D.deadlift = () => hinge()
D.good_morning = () => ({
  glow: { joint: 'hip', dx: -9, dy: -2 },
  props: [{ t: 'plate', r: 6 }],
  ...loop(
    { ...HINGE_TOP, wristsRel: true, wrists: [[8, 2], [6, 4]] },
    { hip: [100, 118], torso: 74, headTilt: -30, ankles: STAND, legBend: KF, wristsRel: true, wrists: [[8, 2], [6, 4]], armBend: [1, 1] },
    { down: 'Bar on the back — hips push back', up: 'Hamstrings pull you tall' },
  ),
})
D.kettlebell_swing = () => ({
  glow: { joint: 'hip', dx: -9, dy: -2 },
  props: [{ t: 'kettlebell' }],
  poses: [
    { hip: [102, 120], torso: 58, headTilt: -20, ankles: STAND, legBend: KF, wrists: [[112, 148], [108, 150]], armBend: [1, 1] },
    { hip: [112, 107], torso: 2, ankles: STAND, legBend: KF, wrists: [[152, 104], [148, 106]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 550, label: 'Hike the bell back' },
    { pose: 1, dur: 550, label: 'Snap the hips — arms just steer', glow: 1 },
    { pose: 0, dur: 600, label: 'Let it swing back through', glow: 0.3 },
  ],
})
D.back_extension = () => ({
  glow: { joint: 'hip', dx: -6, dy: -4 },
  scene: [{ t: 'rect', x: 88, y: 138, w: 26, h: 26, rx: 3 }, { t: 'line', x1: 70, y1: 164, x2: 70, y2: 172, w: 3 }],
  poses: [
    { hip: [100, 138], torso: 88, headTilt: -40, ankles: [[62, 158], [58, 158]], legBend: [1, 1], wrists: [[128, 148], [124, 150]], armBend: [1, 1] },
    { hip: [100, 138], torso: 30, headTilt: -10, ankles: [[62, 158], [58, 158]], legBend: [1, 1], wrists: [[112, 122], [108, 124]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 900, label: 'Hinge over the pad' },
    { pose: 1, dur: 1000, label: 'Squeeze up to one straight line', glow: 1 },
    { pose: 1, dur: 350, label: 'No overarching at the top', glow: 0.5 },
    { pose: 0, dur: 900, label: 'Lower slow' },
  ],
})
D.reverse_hyper = () => ({
  glow: { joint: 'hip', dx: -4, dy: 2 },
  scene: [{ t: 'rect', x: 96, y: 132, w: 44, h: 8, rx: 2 }, { t: 'line', x1: 104, y1: 140, x2: 104, y2: 170, w: 3 }, { t: 'line', x1: 130, y1: 140, x2: 130, y2: 170, w: 3 }],
  poses: [
    { hip: [100, 138], torso: 96, headTilt: -20, ankles: [[76, 166], [72, 166]], legBend: [1, 1], wrists: [[142, 140], [138, 142]], armBend: [1, 1] },
    { hip: [100, 136], torso: 96, headTilt: -20, ankles: [[52, 130], [48, 132]], legBend: [1, 1], wrists: [[142, 140], [138, 142]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 500, label: 'Chest on the pad, legs hanging' },
    { pose: 1, dur: 900, label: 'Glutes lift the legs level', glow: 1 },
    { pose: 0, dur: 1000, label: 'Lower without swinging' },
  ],
})
D.superman = () => ({
  glow: { joint: 'hip', dx: -6, dy: -2 },
  poses: [
    { hip: [96, 162], torso: -92, headTilt: 25, ankles: [[148, 164], [144, 165]], legBend: [1, 1], wrists: [[44, 162], [40, 163]], armBend: [1, 1] },
    { hip: [96, 160], torso: -80, headTilt: 30, ankles: [[150, 150], [146, 152]], legBend: [1, 1], wrists: [[42, 146], [38, 148]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 700, label: 'Face down, long body' },
    { pose: 1, dur: 900, label: 'Lift arms and legs together', glow: 1 },
    { pose: 1, dur: 900, label: 'Hold — squeeze the glutes', glow: 1 },
    { pose: 0, dur: 800, label: 'Down with control' },
  ],
})

// Lunge family --------------------------------------------------------
const LUNGE_UP = { hip: [110, 110], torso: 6, ankles: [[138, 167], [86, 161]], feet: [0, 48], legBend: KF, wrists: [[120, 114], [104, 116]], armBend: [1, 1] }
const LUNGE_DOWN = { hip: [106, 141], torso: 12, ankles: [[138, 167], [86, 161]], feet: [0, 48], legBend: KF, wrists: [[116, 145], [100, 147]], armBend: [1, 1] }
D.lunge = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  props: [{ t: 'dumbbell', at: 'wrists' }],
  ...loop(LUNGE_UP, LUNGE_DOWN, { down: 'Step long — drop straight down', up: 'Front heel drives you up' }),
})
D.lateral_lunge = () => loopSpec(
  { hip: [108, 110], torso: 6, ankles: [[134, 167], [92, 167]], legBend: KF, wrists: [[116, 118], [102, 120]], armBend: [1, 1] },
  { hip: [122, 134], torso: 18, ankles: [[140, 167], [88, 167]], legBend: KF, wrists: [[128, 142], [116, 144]], armBend: [1, 1] },
  { glow: { joint: 'thighMid0', dx: 4, dy: 0 }, down: 'Sit into one hip, other leg straight', up: 'Push back to centre' },
)
D.curtsy_lunge = () => loopSpec(
  LUNGE_UP,
  { hip: [108, 138], torso: 14, ankles: [[130, 167], [96, 160]], feet: [0, 40], legBend: [-1, 1], wrists: [[116, 142], [102, 144]], armBend: [1, 1] },
  { glow: { joint: 'hip', dx: -4, dy: 2 }, down: 'Back leg sweeps behind — drop down', up: 'Front glute stands you up' },
)

// Leg machines --------------------------------------------------------
D.leg_extension = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'rect', x: 66, y: 128, w: 40, h: 9, rx: 2 }, { t: 'line', x1: 74, y1: 137, x2: 74, y2: 170, w: 4 }],
  poses: [
    { hip: [92, 128], torso: -6, ankles: [[112, 162], [106, 163]], legBend: KF, wrists: [[100, 142], [94, 144]], armBend: [1, 1] },
    { hip: [92, 128], torso: -6, ankles: [[144, 136], [138, 138]], legBend: KF, wrists: [[100, 142], [94, 144]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 400, label: 'Seated, shins behind the pad' },
    { pose: 1, dur: 900, label: 'Kick to straight — squeeze', glow: 1 },
    { pose: 1, dur: 350, label: 'Hold a beat', glow: 0.7 },
    { pose: 0, dur: 1100, label: 'Lower slow — no dropping' },
  ],
})
D.leg_curl = () => ({
  glow: { joint: 'hip', dx: -2, dy: 6 },
  scene: [{ t: 'rect', x: 70, y: 148, w: 70, h: 8, rx: 2 }],
  poses: [
    { hip: [100, 146], torso: 92, headTilt: -15, ankles: [[160, 152], [156, 153]], legBend: [-1, -1], wrists: [[132, 158], [128, 159]], armBend: [1, 1] },
    { hip: [100, 146], torso: 92, headTilt: -15, ankles: [[122, 118], [118, 120]], legBend: [-1, -1], wrists: [[132, 158], [128, 159]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 400, label: 'Face down, legs long' },
    { pose: 1, dur: 900, label: 'Heels to your backside', glow: 1 },
    { pose: 0, dur: 1100, label: 'Resist all the way back' },
  ],
})
D.calf_raise = () => loopSpec(
  { ...stand({ wrists: [[124, 152], [112, 154]] }) },
  { hip: [112, 100], torso: 4, ankles: [[121, 161], [107, 161]], feet: [-28, -28], legBend: KF, wrists: [[124, 145], [112, 147]], armBend: [1, 1] },
  { glow: { joint: 'knee0', dx: 2, dy: 26 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Up onto the balls of your feet', up: 'Heels down slow, full stretch', invert: true },
)
D.hip_adduction = () => loopSpec(
  { hip: [112, 108], torso: 4, ankles: [[142, 165], [105, 167]], legBend: KF, wrists: [[120, 150], [112, 152]], armBend: [1, 1] },
  { hip: [112, 108], torso: 4, ankles: [[112, 166], [105, 167]], legBend: KF, wrists: [[120, 150], [112, 152]], armBend: [1, 1] },
  { glow: { joint: 'thighMid0', dx: 2, dy: 4 }, down: 'Sweep the leg across your body', up: 'Control it back out', invert: true },
)
D.glute_kickback = () => ({
  glow: { joint: 'hip', dx: -6, dy: 0 },
  poses: [
    QUAD_BASE,
    { ...QUAD_BASE, ankles: [[64, 166], [40, 122]] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'On all fours, back flat' },
    { pose: 1, dur: 900, label: 'Drive the heel back and up', glow: 1 },
    { pose: 1, dur: 300, label: 'Squeeze — no arching', glow: 0.7 },
    { pose: 0, dur: 800, label: 'Back under control' },
  ],
})
D.bird_dog = () => ({
  glow: { joint: 'torsoMid', dx: 0, dy: 8 },
  poses: [
    QUAD_BASE,
    { ...QUAD_BASE, ankles: [[64, 166], [36, 130]], wrists: [[130, 166], [178, 134]] },
  ],
  phases: [
    { pose: 0, dur: 500, label: 'All fours — imagine a tray on your back' },
    { pose: 1, dur: 1000, label: 'Opposite arm and leg reach long', glow: 1 },
    { pose: 1, dur: 700, label: 'Hold — hips stay level', glow: 0.8 },
    { pose: 0, dur: 800, label: 'Back without wobbling' },
  ],
})

// Horizontal press ----------------------------------------------------
D.press_up = () => ({
  glow: { joint: 'shoulder', dx: 6, dy: 10 },
  ...loop(PLANK_TOP, PLANK_LOW, { down: 'Chest to the floor, elbows ~45°', up: 'Press the floor away' }),
})
D.pike_pushup = () => loopSpec(
  { hip: [92, 118], torso: 52, headTilt: -50, ankles: [[52, 166], [48, 166]], legBend: [-1, -1], wrists: [[128, 166], [124, 166]], armBend: [1, 1] },
  { hip: [90, 124], torso: 58, headTilt: -55, ankles: [[52, 166], [48, 166]], legBend: [-1, -1], wrists: [[128, 166], [124, 166]], armBend: [1, 1] },
  { glow: { joint: 'shoulder', dx: 2, dy: 2 }, down: 'Hips high — head toward the floor', up: 'Press back to the pike' },
)
D.dip = () => ({
  glow: { joint: 'shoulder', dx: 4, dy: 10 },
  scene: [{ t: 'line', x1: 96, y1: 122, x2: 96, y2: 172, w: 3.5 }, { t: 'line', x1: 136, y1: 122, x2: 136, y2: 172, w: 3.5 }, { t: 'line', x1: 90, y1: 122, x2: 102, y2: 122, w: 3 }, { t: 'line', x1: 130, y1: 122, x2: 142, y2: 122, w: 3 }],
  poses: [
    { hip: [114, 118], torso: 6, ankles: [[106, 152], [100, 154]], feet: [60, 60], legBend: [1, 1], wrists: [[134, 122], [98, 122]], armBend: [-1, -1] },
    { hip: [114, 132], torso: 14, ankles: [[104, 160], [98, 162]], feet: [60, 60], legBend: [1, 1], wrists: [[134, 122], [98, 122]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'Arms locked on the bars' },
    { pose: 1, dur: 1100, label: 'Bend to ~90°, slight lean forward' },
    { pose: 0, dur: 900, label: 'Press back to straight', glow: 1 },
    { pose: 0, dur: 300, label: '', glow: 0.4 },
  ],
})
D.chest_fly = () => ({
  glow: { joint: 'shoulder', dx: 8, dy: 12 },
  scene: benchScene(),
  poses: [
    { hip: [96, 146], torso: 96, headTilt: 0, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[86, 104], [82, 106]], armBend: [1, 1] },
    { hip: [96, 146], torso: 96, headTilt: 0, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[52, 132], [48, 134]], armBend: [1, 1] },
  ],
  props: [{ t: 'dumbbell', at: 'wrists' }],
  phases: [
    { pose: 0, dur: 450, label: 'Arms over the chest, soft elbows' },
    { pose: 1, dur: 1200, label: 'Open wide — feel the stretch' },
    { pose: 0, dur: 900, label: 'Hug the arc back together', glow: 1 },
    { pose: 0, dur: 300, label: '', glow: 0.4 },
  ],
})
D.svend_press = () => loopSpec(
  { ...stand({ wristsRel: true, wrists: [[14, 8], [12, 10]] }) },
  { ...stand({ wristsRel: true, wrists: [[42, 6], [40, 8]] }) },
  { glow: { joint: 'shoulder', dx: 8, dy: 8 }, props: [{ t: 'ball', r: 6 }], down: 'Press the plate straight out', up: 'Squeeze it the whole way back', invert: true },
)

// Vertical press ------------------------------------------------------
D.push_press = () => ({
  glow: { joint: 'shoulder', dx: 2, dy: -2 },
  props: [{ t: 'plate', r: 6 }],
  poses: [
    { ...stand({ wristsRel: true, wrists: [[10, 2], [8, 4]] }) },
    { hip: [110, 116], torso: 6, ankles: STAND, legBend: KF, wristsRel: true, wrists: [[10, 2], [8, 4]], armBend: [1, 1] },
    { ...stand({ wristsRel: true, wrists: [[6, -42], [4, -40]], armBend: [-1, -1] }) },
  ],
  phases: [
    { pose: 1, dur: 500, label: 'Quick knee dip' },
    { pose: 2, dur: 550, label: 'Legs launch it overhead', glow: 1 },
    { pose: 0, dur: 900, label: 'Lower to the shoulders', glow: 0.3 },
  ],
})
D.landmine_press = () => ({
  glow: { joint: 'shoulder', dx: 4, dy: 0 },
  scene: [{ t: 'circle', cx: 40, cy: 166, r: 5 }],
  poses: [
    { ...stand({ wrists: [[126, 96], [122, 98]], armBend: [1, 1] }) },
    { ...stand({ wrists: [[152, 74], [148, 76]], armBend: [-1, -1] }) },
  ],
  props: [{ t: 'bar', cable: [40, 166] }],
  phases: [
    { pose: 0, dur: 450, label: 'Bar end at the shoulder' },
    { pose: 1, dur: 900, label: 'Press up and away', glow: 1 },
    { pose: 0, dur: 1000, label: 'Pull it back with control', glow: 0.3 },
  ],
})
D.thruster = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  props: [{ t: 'plate', r: 6 }],
  poses: [
    { ...SQUAT_DEEP, wristsRel: true, wrists: [[11, 3], [9, 5]] },
    { ...SQUAT_STAND, wristsRel: true, wrists: [[11, 3], [9, 5]] },
    { ...SQUAT_STAND, wristsRel: true, wrists: [[6, -42], [4, -40]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 800, label: 'Front squat down' },
    { pose: 2, dur: 700, label: 'Stand and press in one drive', glow: 1 },
    { pose: 1, dur: 600, label: 'Bar back to the shoulders', glow: 0.3 },
  ],
})
D.wall_ball = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'line', x1: 196, y1: 40, x2: 196, y2: 172, w: 4 }],
  props: [{ t: 'ball', r: 7 }],
  poses: [
    { ...SQUAT_DEEP, wristsRel: true, wrists: [[13, 4], [11, 6]] },
    { ...SQUAT_STAND, wristsRel: true, wrists: [[24, -34], [22, -32]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 700, label: 'Squat with the ball at your chest' },
    { pose: 1, dur: 550, label: 'Drive up — throw to the target', glow: 1 },
    { pose: 0, dur: 700, label: 'Catch and ride it back down', glow: 0.3 },
  ],
})
D.med_ball_slam = () => ({
  glow: { joint: 'torsoMid', dx: 4, dy: 0 },
  props: [{ t: 'ball', r: 7 }],
  poses: [
    { ...stand({ wristsRel: true, wrists: [[8, -40], [6, -38]], armBend: [-1, -1] }) },
    { hip: [104, 126], torso: 42, headTilt: -15, ankles: STAND, legBend: KF, wrists: [[130, 160], [126, 162]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 600, label: 'Ball high overhead, tall' },
    { pose: 1, dur: 450, label: 'Slam it through the floor', glow: 1 },
    { pose: 0, dur: 800, label: 'Pick up and reset', glow: 0.2 },
  ],
})
D.clean = () => ({
  glow: { joint: 'hip', dx: -8, dy: 0 },
  props: [{ t: 'plate', r: 7 }],
  poses: [
    { ...HINGE_BOTTOM, wrists: [[128, 158], [124, 160]] },
    { ...stand({ wrists: [[124, 138], [120, 140]] }) },
    { ...stand({ wristsRel: true, wrists: [[12, 4], [10, 6]] }) },
  ],
  phases: [
    { pose: 0, dur: 500, label: 'Set like a deadlift' },
    { pose: 1, dur: 450, label: 'Explode tall — bar close', glow: 1 },
    { pose: 2, dur: 400, label: 'Whip the elbows through, catch', glow: 0.7 },
    { pose: 0, dur: 900, label: 'Back to the floor' },
  ],
})
D.snatch = () => ({
  glow: { joint: 'hip', dx: -8, dy: 0 },
  props: [{ t: 'plate', r: 7 }],
  poses: [
    { ...HINGE_BOTTOM, wrists: [[130, 158], [126, 160]] },
    { ...stand({ wristsRel: true, wrists: [[6, -42], [4, -40]], armBend: [-1, -1] }) },
  ],
  phases: [
    { pose: 0, dur: 550, label: 'Wide grip, flat back' },
    { pose: 1, dur: 550, label: 'One pull — floor to overhead', glow: 1 },
    { pose: 0, dur: 1000, label: 'Reset', glow: 0.2 },
  ],
})
D.burpee = () => ({
  glow: { joint: 'torsoMid', dx: 0, dy: 0 },
  poses: [
    stand(),
    { hip: [104, 146], torso: 40, headTilt: -20, ankles: STAND, legBend: KF, wrists: [[128, 164], [124, 166]], armBend: [1, 1] },
    PLANK_TOP,
    { hip: [112, 96], torso: 2, ankles: [[120, 154], [106, 154]], feet: [40, 40], legBend: KF, wristsRel: true, wrists: [[6, -36], [4, -34]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 1, dur: 420, label: 'Hands down' },
    { pose: 2, dur: 420, label: 'Feet back — plank' },
    { pose: 1, dur: 420, label: 'Feet in' },
    { pose: 3, dur: 420, label: 'Jump tall', glow: 1 },
    { pose: 0, dur: 380, label: 'Land, go again', glow: 0.3 },
  ],
})
D.mountain_climber = () => ({
  glow: { joint: 'torsoMid', dx: 0, dy: 6 },
  poses: [
    PLANK_TOP,
    { ...PLANK_TOP, ankles: [[94, 158], [50, 166]] },
    { ...PLANK_TOP, ankles: [[54, 166], [90, 158]] },
  ],
  phases: [
    { pose: 1, dur: 380, label: 'Knee drives to the chest' },
    { pose: 2, dur: 380, label: 'Switch — hips stay low', glow: 0.8 },
    { pose: 0, dur: 300, label: '' },
  ],
})
D.box_jump = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'rect', x: 140, y: 134, w: 44, h: 38, rx: 3 }],
  poses: [
    { hip: [104, 112], torso: 8, ankles: [[112, 167], [98, 167]], legBend: KF, wrists: [[114, 130], [100, 132]], armBend: [1, 1] },
    { hip: [100, 134], torso: 22, ankles: [[112, 167], [98, 167]], legBend: KF, wrists: [[86, 150], [80, 152]], armBend: [1, 1] },
    { hip: [158, 96], torso: 8, ankles: [[166, 130], [152, 130]], legBend: KF, wrists: [[168, 116], [154, 118]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 1, dur: 500, label: 'Load — arms back' },
    { pose: 2, dur: 480, label: 'Jump — land soft on top', glow: 1 },
    { pose: 0, dur: 700, label: 'Step down, never jump down', glow: 0.2 },
  ],
})
D.farmer_carry = () => ({
  glow: { joint: 'torsoMid', dx: 0, dy: 0 },
  props: [{ t: 'dumbbell', at: 'wrists' }],
  poses: [
    { hip: [108, 107], torso: 2, ankles: [[124, 167], [96, 165]], feet: [0, 20], legBend: KF, wrists: [[118, 152], [102, 154]], armBend: [1, 1] },
    { hip: [116, 107], torso: 2, ankles: [[100, 165], [132, 167]], feet: [20, 0], legBend: [-1, -1], wrists: [[126, 152], [110, 154]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 700, label: 'Heavy in each hand — walk tall' },
    { pose: 1, dur: 700, label: 'Short quick steps, no leaning', glow: 0.7 },
  ],
})
D.sled = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'rect', x: 168, y: 148, w: 40, h: 22, rx: 3 }],
  poses: [
    { hip: [104, 124], torso: 46, headTilt: -20, ankles: [[124, 167], [86, 163]], feet: [0, 30], legBend: KF, wrists: [[164, 138], [160, 140]], armBend: [1, 1] },
    { hip: [112, 124], torso: 46, headTilt: -20, ankles: [[90, 163], [130, 167]], feet: [30, 0], legBend: KF, wrists: [[170, 138], [166, 140]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 650, label: 'Low lean, arms locked on' },
    { pose: 1, dur: 650, label: 'Drive step after step', glow: 1 },
  ],
})
D.battle_ropes = () => ({
  glow: { joint: 'shoulder', dx: 4, dy: 4 },
  props: [{ t: 'rope', anchor: [212, 168] }],
  poses: [
    { hip: [108, 114], torso: 14, ankles: STAND, legBend: KF, wrists: [[136, 100], [128, 138]], armBend: [1, 1] },
    { hip: [108, 116], torso: 14, ankles: STAND, legBend: KF, wrists: [[136, 138], [128, 100]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 380, label: 'Alternate arms — big waves' },
    { pose: 1, dur: 380, label: 'Stay low, keep breathing', glow: 0.8 },
  ],
})
D.turkish_getup = () => ({
  glow: { joint: 'torsoMid', dx: 0, dy: 0 },
  props: [{ t: 'kettlebell' }],
  poses: [
    { hip: [90, 158], torso: -80, headTilt: 60, ankles: [[128, 166], [70, 164]], legBend: [-1, 1], wrists: [[104, 110], [100, 112]], armBend: [-1, -1] },
    { hip: [96, 148], torso: -30, headTilt: 25, ankles: [[128, 166], [70, 164]], legBend: [-1, 1], wrists: [[112, 92], [64, 158]], armBend: [-1, 1] },
    { ...stand({ wristsRel: true, wrists: [[4, -42], [2, 40]], armBend: [-1, 1] }) },
  ],
  phases: [
    { pose: 0, dur: 700, label: 'Lying — weight punched to the sky' },
    { pose: 1, dur: 900, label: 'Roll to the elbow, then the hand', glow: 0.6 },
    { pose: 2, dur: 900, label: 'Stand — arm never bends', glow: 1 },
    { pose: 1, dur: 800, label: 'Reverse every step down' },
  ],
})

// Shoulders / arms ----------------------------------------------------
D.front_raise = () => loopSpec(
  { ...stand() },
  { ...stand({ wrists: [[158, 96], [154, 98]], armBend: [1, 1] }) },
  { glow: { joint: 'shoulder', dx: 6, dy: 2 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Straight arms to shoulder height', up: 'Lower slower than you lifted', invert: true },
)
D.upright_row = () => loopSpec(
  { ...stand({ wrists: [[120, 150], [114, 152]] }) },
  { ...stand({ wrists: [[122, 112], [116, 114]], armBend: [-1, -1] }) },
  { glow: { joint: 'shoulder', dx: 2, dy: 0 }, props: [{ t: 'plate', r: 5 }], down: 'Elbows lead, bar up the body', up: 'Down smooth — no swinging', invert: true },
)
D.shrug = () => loopSpec(
  { ...stand({ wrists: [[124, 152], [112, 154]] }) },
  { hip: [112, 105], torso: 4, ankles: STAND, legBend: KF, wrists: [[124, 146], [112, 148]], armBend: [1, 1], headTilt: 0 },
  { glow: { joint: 'shoulder', dx: 0, dy: -4 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Shoulders straight up to your ears', up: 'Two-second squeeze, then down', invert: true },
)
D.face_pull = () => loopSpec(
  { ...stand({ wrists: [[152, 96], [148, 98]], armBend: [1, 1] }) },
  { ...stand({ wrists: [[126, 92], [120, 96]], armBend: [-1, -1] }) },
  { glow: { joint: 'shoulder', dx: -4, dy: 2 }, scene: [{ t: 'line', x1: 210, y1: 92, x2: 216, y2: 92, w: 6 }], props: [{ t: 'bar', cable: [212, 92] }], down: 'Pull the rope to your eyebrows', up: 'Elbows high, let it draw back', invert: true },
)
D.rear_delt_fly = () => loopSpec(
  { hip: [102, 118], torso: 64, headTilt: -25, ankles: STAND, legBend: KF, wrists: [[126, 150], [122, 152]], armBend: [1, 1] },
  { hip: [102, 118], torso: 64, headTilt: -25, ankles: STAND, legBend: KF, wrists: [[92, 118], [88, 120]], armBend: [1, 1] },
  { glow: { joint: 'shoulder', dx: -6, dy: 4 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Hinged over — arms sweep wide', up: 'Back down without swinging', invert: true },
)
D.tricep_pushdown = () => loopSpec(
  { ...stand({ wrists: [[130, 118], [126, 120]], armBend: [-1, -1] }) },
  { ...stand({ wrists: [[136, 152], [132, 154]], armBend: [-1, -1] }) },
  { glow: { joint: 'upperArmMid0', dx: 4, dy: 8 }, scene: [{ t: 'line', x1: 138, y1: 36, x2: 144, y2: 36, w: 6 }], props: [{ t: 'handle', cable: [140, 38] }], down: 'Elbows pinned — press to straight', up: 'Let it rise only to the ribs', invert: true },
)
D.straight_arm_pulldown = () => loopSpec(
  { ...stand({ wrists: [[152, 92], [148, 94]], armBend: [1, 1] }) },
  { ...stand({ wrists: [[128, 152], [124, 154]], armBend: [1, 1] }) },
  { glow: { joint: 'shoulder', dx: -8, dy: 10 }, props: [{ t: 'bar', cable: [204, 48] }], scene: [{ t: 'line', x1: 202, y1: 46, x2: 208, y2: 46, w: 6 }], down: 'Straight arms sweep to your thighs', up: 'Lats stretch it back up', invert: true },
)
D.tricep_extension = () => loopSpec(
  { ...stand({ wristsRel: true, wrists: [[2, -14], [0, -12]], armBend: [-1, -1] }) },
  { ...stand({ wristsRel: true, wrists: [[6, -42], [4, -40]], armBend: [-1, -1] }) },
  { glow: { joint: 'upperArmMid0', dx: 2, dy: 0 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Press to straight overhead', up: 'Lower behind the head, elbows in', invert: true },
)
D.skull_crusher = () => ({
  glow: { joint: 'upperArmMid0', dx: 2, dy: 0 },
  scene: benchScene(),
  props: [{ t: 'plate', r: 5 }],
  poses: [
    { hip: [96, 146], torso: 96, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[84, 102], [80, 104]], armBend: [-1, -1] },
    { hip: [96, 146], torso: 96, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[62, 118], [58, 120]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'Bar over the chest' },
    { pose: 1, dur: 1100, label: 'Hinge at the elbows only' },
    { pose: 0, dur: 900, label: 'Press back up', glow: 1 },
    { pose: 0, dur: 300, label: '', glow: 0.4 },
  ],
})
D.tricep_kickback = () => loopSpec(
  { hip: [102, 118], torso: 62, headTilt: -25, ankles: STAND, legBend: KF, wrists: [[118, 142], [114, 144]], armBend: [-1, -1] },
  { hip: [102, 118], torso: 62, headTilt: -25, ankles: STAND, legBend: KF, wrists: [[86, 122], [82, 124]], armBend: [-1, -1] },
  { glow: { joint: 'upperArmMid0', dx: -2, dy: 2 }, props: [{ t: 'dumbbell', at: 'wrists' }], down: 'Kick the forearm straight back', up: 'Only the elbow moves', invert: true },
)
D.pullover = () => ({
  glow: { joint: 'shoulder', dx: -6, dy: 8 },
  scene: benchScene(),
  props: [{ t: 'dumbbell', at: 'wrist0' }],
  poses: [
    { hip: [96, 146], torso: 96, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[86, 104], [82, 106]], armBend: [1, 1] },
    { hip: [96, 146], torso: 96, ankles: [[140, 166], [134, 166]], legBend: [-1, -1], wrists: [[52, 122], [48, 124]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'Weight over the chest' },
    { pose: 1, dur: 1200, label: 'Arc back overhead — ribs down' },
    { pose: 0, dur: 950, label: 'Lats pull it back over', glow: 1 },
    { pose: 0, dur: 300, label: '', glow: 0.4 },
  ],
})

// Rows / pulls --------------------------------------------------------
const ROW_HINGE = { hip: [102, 118], torso: 58, headTilt: -25, ankles: STAND, legBend: KF }
D.row = () => loopSpec(
  { ...ROW_HINGE, wrists: [[128, 152], [124, 154]], armBend: [1, 1] },
  { ...ROW_HINGE, wrists: [[118, 126], [114, 128]], armBend: [1, 1] },
  { glow: { joint: 'torsoMid', dx: -8, dy: 0 }, props: [{ t: 'plate', r: 6 }], down: 'Pull the bar to your waist', up: 'Lower without standing up', invert: true },
)
D.t_bar_row = () => D.row()
D.meadows_row = () => loopSpec(
  { ...ROW_HINGE, wrists: [[128, 152], null], armBend: [1, 1] },
  { ...ROW_HINGE, wrists: [[116, 124], null], armBend: [1, 1] },
  { glow: { joint: 'torsoMid', dx: -8, dy: 0 }, props: [{ t: 'dumbbell', at: 'wrist0' }], down: 'One-arm row to the hip', up: 'Long stretch at the bottom', invert: true },
)
D.inverted_row = () => ({
  glow: { joint: 'torsoMid', dx: -6, dy: -4 },
  scene: [{ t: 'line', x1: 84, y1: 118, x2: 148, y2: 118, w: 3 }, { t: 'line', x1: 90, y1: 118, x2: 90, y2: 172, w: 2 }, { t: 'line', x1: 142, y1: 118, x2: 142, y2: 172, w: 2 }],
  poses: [
    { hip: [96, 152], torso: -78, headTilt: 70, ankles: [[44, 164], [40, 164]], legBend: [-1, -1], wrists: [[118, 120], [114, 120]], armBend: [-1, -1] },
    { hip: [98, 142], torso: -74, headTilt: 66, ankles: [[44, 164], [40, 164]], legBend: [-1, -1], wrists: [[118, 120], [114, 120]], armBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 500, label: 'Hang under the bar, body straight' },
    { pose: 1, dur: 900, label: 'Chest to the bar', glow: 1 },
    { pose: 0, dur: 1000, label: 'Lower without sagging' },
  ],
})
D.pull_up = () => ({
  glow: { joint: 'torsoMid', dx: -6, dy: -6 },
  ...HANG_BAR,
  poses: [HANG_DOWN, HANG_UP],
  phases: [
    { pose: 0, dur: 500, label: 'Dead hang — shoulders down first' },
    { pose: 1, dur: 1000, label: 'Pull the bar to your chest', glow: 1 },
    { pose: 1, dur: 300, label: 'Chin over', glow: 0.7 },
    { pose: 0, dur: 1100, label: 'Lower all the way down' },
  ],
})
D.chin_up = () => D.pull_up()
D.leg_raise = () => ({
  glow: { joint: 'torsoMid', dx: 4, dy: 14 },
  ...HANG_BAR,
  poses: [
    { ...HANG_DOWN, ankles: [[116, 164], [110, 164]], legBend: [-1, -1] },
    { ...HANG_DOWN, ankles: [[152, 122], [148, 124]], legBend: [-1, -1] },
  ],
  phases: [
    { pose: 0, dur: 500, label: 'Hang long, no swing' },
    { pose: 1, dur: 900, label: 'Legs up — pelvis curls at the top', glow: 1 },
    { pose: 0, dur: 1100, label: 'Down dead slow' },
  ],
})

// Core ----------------------------------------------------------------
D.crunch = () => ({
  glow: { joint: 'torsoMid', dx: 6, dy: 4 },
  poses: [
    LYING_FLAT,
    { ...LYING_FLAT, hip: [95, 158], torso: -58, headTilt: 40, wrists: [[104, 118], [100, 120]] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'Knees bent, hands to temples' },
    { pose: 1, dur: 800, label: 'Ribs to hips — shoulders peel up', glow: 1 },
    { pose: 1, dur: 300, label: 'Squeeze', glow: 0.7 },
    { pose: 0, dur: 900, label: 'Down slow — no neck pulling' },
  ],
})
D.cable_crunch = () => ({
  glow: { joint: 'torsoMid', dx: 6, dy: 2 },
  scene: [{ t: 'line', x1: 196, y1: 40, x2: 202, y2: 40, w: 6 }],
  props: [{ t: 'handle', cable: [198, 42] }],
  poses: [
    { hip: [104, 148], torso: 18, headTilt: -10, ankles: [[80, 166], [76, 166]], feet: [70, 70], legBend: [1, 1], wristsRel: true, wrists: [[8, -6], [6, -4]], armBend: [1, 1] },
    { hip: [104, 148], torso: 52, headTilt: -30, ankles: [[80, 166], [76, 166]], feet: [70, 70], legBend: [1, 1], wristsRel: true, wrists: [[8, -6], [6, -4]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 450, label: 'Kneel — rope at your head' },
    { pose: 1, dur: 800, label: 'Crunch down with the abs only', glow: 1 },
    { pose: 0, dur: 900, label: 'Uncurl tall again' },
  ],
})
D.russian_twist = () => ({
  glow: { joint: 'torsoMid', dx: 6, dy: 4 },
  poses: [
    { hip: [100, 152], torso: -32, headTilt: 25, ankles: [[134, 148], [130, 150]], legBend: [-1, -1], wrists: [[128, 122], [124, 124]], armBend: [1, 1] },
    { hip: [100, 152], torso: -32, headTilt: 25, ankles: [[134, 148], [130, 150]], legBend: [-1, -1], wrists: [[112, 140], [108, 142]], armBend: [1, 1] },
  ],
  props: [{ t: 'ball', r: 5 }],
  phases: [
    { pose: 0, dur: 500, label: 'Lean back, heels light' },
    { pose: 1, dur: 550, label: 'Rotate — the ribcage turns', glow: 0.9 },
    { pose: 0, dur: 550, label: 'And across the other way', glow: 0.9 },
  ],
})
D.ab_rollout = () => ({
  glow: { joint: 'torsoMid', dx: 4, dy: 6 },
  poses: [
    { hip: [98, 144], torso: 40, headTilt: -20, ankles: [[74, 166], [70, 166]], feet: [70, 70], legBend: [1, 1], wrists: [[132, 160], [128, 162]], armBend: [1, 1] },
    { hip: [104, 152], torso: 74, headTilt: -35, ankles: [[74, 166], [70, 166]], feet: [70, 70], legBend: [1, 1], wrists: [[168, 162], [164, 164]], armBend: [1, 1] },
  ],
  props: [{ t: 'ball', r: 6, dy: 3 }],
  phases: [
    { pose: 0, dur: 450, label: 'Kneeling, wheel under shoulders' },
    { pose: 1, dur: 1100, label: 'Roll out as far as you can hold' },
    { pose: 0, dur: 950, label: 'Drag it back with the abs', glow: 1 },
  ],
})
D.pallof_press = () => loopSpec(
  { ...stand({ wristsRel: true, wrists: [[12, 6], [10, 8]] }) },
  { ...stand({ wristsRel: true, wrists: [[40, 4], [38, 6]] }) },
  { glow: { joint: 'torsoMid', dx: 4, dy: 2 }, scene: [{ t: 'line', x1: 210, y1: 108, x2: 216, y2: 108, w: 6 }], props: [{ t: 'handle', cable: [212, 108] }], down: 'Press out — refuse the twist', up: 'Back to the chest, still square', invert: true },
)
D.woodchop = () => loopSpec(
  { hip: [110, 110], torso: 10, ankles: STAND, legBend: KF, wrists: [[148, 84], [144, 86]], armBend: [1, 1] },
  { hip: [104, 126], torso: 30, headTilt: -10, ankles: STAND, legBend: KF, wrists: [[92, 146], [88, 148]], armBend: [1, 1] },
  { glow: { joint: 'torsoMid', dx: 4, dy: 2 }, props: [{ t: 'ball', r: 5 }], down: 'Chop high-to-low across the body', up: 'Rotate back up, arms long', invert: true },
)
D.hollow_hold = () => ({
  glow: { joint: 'torsoMid', dx: 6, dy: 6 },
  poses: [
    { hip: [95, 158], torso: -70, headTilt: 45, ankles: [[146, 138], [142, 140]], legBend: [-1, -1], wrists: [[52, 130], [48, 132]], armBend: [1, 1] },
    { hip: [95, 158], torso: -76, headTilt: 45, ankles: [[148, 146], [144, 148]], legBend: [-1, -1], wrists: [[50, 138], [46, 140]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 1400, label: 'Low back pressed into the floor', glow: 0.9 },
    { pose: 1, dur: 1400, label: 'Hold — banana, not a rocking chair', glow: 0.9 },
  ],
})

// Cardio machines -----------------------------------------------------
D.elliptical = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'line', x1: 96, y1: 96, x2: 96, y2: 150, w: 3 }, { t: 'rect', x: 84, y: 158, w: 76, h: 6, rx: 3 }],
  poses: [
    { hip: [112, 110], torso: 8, ankles: [[134, 156], [96, 152]], legBend: KF, wrists: [[102, 112], [98, 116]], armBend: [1, 1] },
    { hip: [112, 110], torso: 8, ankles: [[96, 152], [134, 156]], legBend: KF, wrists: [[110, 108], [92, 118]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 650, label: 'Long gliding strides' },
    { pose: 1, dur: 650, label: 'Push AND pull the handles', glow: 0.7 },
  ],
})
const BIKE_SCENE = [{ t: 'circle', cx: 118, cy: 152, r: 14 }, { t: 'line', x1: 96, y1: 124, x2: 96, y2: 140, w: 4 }, { t: 'line', x1: 140, y1: 110, x2: 140, y2: 126, w: 3 }]
function bike(label1, label2) {
  return {
    glow: { joint: 'thighMid0', dx: 4, dy: 0 },
    scene: BIKE_SCENE,
    poses: [
      { hip: [98, 122], torso: 28, headTilt: -12, ankles: [[128, 146], [108, 158]], legBend: KF, wrists: [[140, 112], [136, 114]], armBend: [1, 1] },
      { hip: [98, 122], torso: 28, headTilt: -12, ankles: [[108, 158], [128, 146]], legBend: KF, wrists: [[140, 112], [136, 114]], armBend: [1, 1] },
    ],
    phases: [
      { pose: 0, dur: 500, label: label1 },
      { pose: 1, dur: 500, label: label2, glow: 0.7 },
    ],
  }
}
D.stationary_bike = () => bike('Smooth circles, not stomps', 'Knees track straight ahead')
D.spin_class = () => bike('Cadence first, then resistance', 'Stay smooth out of the saddle')
D.assault_bike = () => ({
  ...bike('Push the pedals AND the bars', 'Arms drive — it all counts'),
  poses: [
    { hip: [98, 122], torso: 24, headTilt: -10, ankles: [[128, 146], [108, 158]], legBend: KF, wrists: [[148, 98], [130, 118]], armBend: [1, 1] },
    { hip: [98, 122], torso: 24, headTilt: -10, ankles: [[108, 158], [128, 146]], legBend: KF, wrists: [[130, 118], [148, 98]], armBend: [1, 1] },
  ],
})
D.stairs = () => ({
  glow: { joint: 'thighMid0', dx: 4, dy: 0 },
  scene: [{ t: 'rect', x: 104, y: 152, w: 30, h: 20, rx: 2 }, { t: 'rect', x: 134, y: 134, w: 30, h: 38, rx: 2 }],
  poses: [
    { hip: [108, 106], torso: 12, ankles: [[142, 134], [112, 152]], legBend: KF, wrists: [[118, 122], [102, 126]], armBend: [1, 1] },
    { hip: [122, 98], torso: 12, ankles: [[146, 132], [122, 148]], legBend: KF, wrists: [[130, 116], [116, 120]], armBend: [1, 1] },
  ],
  phases: [
    { pose: 0, dur: 600, label: 'Whole foot on each step' },
    { pose: 1, dur: 600, label: 'Push through the heel, stand tall', glow: 0.8 },
  ],
})
D.ski_erg = () => loopSpec(
  { hip: [110, 108], torso: 10, ankles: STAND, legBend: KF, wristsRel: true, wrists: [[14, -26], [12, -24]], armBend: [1, 1] },
  { hip: [104, 124], torso: 42, headTilt: -15, ankles: STAND, legBend: KF, wrists: [[112, 148], [108, 150]], armBend: [1, 1] },
  { glow: { joint: 'torsoMid', dx: -4, dy: 0 }, scene: [{ t: 'line', x1: 148, y1: 34, x2: 154, y2: 34, w: 6 }], props: [{ t: 'handle', cable: [150, 36] }], down: 'Pull down with lats and abs together', up: 'Reach tall to reload' },
)

// ------------------------------------------------------------ resolution

/** Small helper: two-pose loop with options baked into a spec. */
function loopSpec(a, b, { glow, props, scene, down, up, invert } = {}) {
  const spec = invert
    ? { // motion goes A→B as the WORK phase (raise-type movements)
        poses: [a, b],
        phases: [
          { pose: 0, dur: 450, label: 'Set — brace' },
          { pose: 1, dur: 900, label: down, glow: 1 },
          { pose: 1, dur: 300, label: '', glow: 0.6 },
          { pose: 0, dur: 1000, label: up },
        ],
      }
    : loop(a, b, { down, up })
  if (glow) spec.glow = glow
  if (props) spec.props = props
  if (scene) spec.scene = scene
  return spec
}

/**
 * The demo for a menu row: the authored movement guide when one exists
 * (fuller coaching), otherwise the pattern demo from this file.
 * @param {{id:string,name:string,aliases?:string[]}} row
 * @returns {{movement:object}|{spec:object}|null}
 */
export function demoForExercise(row) {
  const movement = findMovement(row.name)
    || (row.aliases || []).map((a) => findMovement(a)).find(Boolean)
  if (movement) return { movement }
  // A few close variants borrow the nearest authored guide outright.
  const borrow = { incline_db_press: 'bench_press', chest_press_machine: 'bench_press', arnold_press: 'shoulder_press' }
  if (borrow[row.id]) return { movement: MOVEMENTS_BY_ID.get(borrow[row.id]) }
  const make = D[row.id]
  if (make) return { spec: { ...make(), name: row.name } }
  return null
}
