/**
 * The movement guide: every exercise both plans prescribe, with authored
 * animation poses (rendered by anim.js) and the full coaching text from the
 * plan documents — set up, execution, common faults, and where you should
 * feel it.
 *
 * Pose format is documented in anim.js: hip + torso angle + end-point
 * targets; knees and elbows are IK-solved. All figures live in a
 * 240×190 box with the floor at y=172.
 */

// Shared standing bits.
const STAND_ANKLES = [[119, 167], [105, 167]]
const KNEES_FWD = [-1, -1]

export const MOVEMENTS = [
  // ================================================================ legs
  {
    id: 'goblet_squat',
    name: 'Goblet squat',
    patterns: ['goblet squat'],
    muscles: 'Quads, glutes, core',
    feel: 'Quads and glutes together, with the glutes taking over in the bottom third.',
    setup: 'Hold one dumbbell vertically against your chest, cupping the top end. Feet a little wider than your shoulders, toes turned out about 20–30 degrees.',
    steps: [
      'Breathe in and brace your stomach as if about to be poked in the gut.',
      'Push your knees out and sit straight down between your feet.',
      'Go as deep as you can with heels flat and lower back long.',
      'Drive through the middle of your foot and stand tall. Breathe out at the top.',
    ],
    wrong: [
      'Heels lifting — go less deep or put a small plate under each heel.',
      'Knees caving inwards on the way up. Screw your feet into the floor.',
      'Only going halfway. Depth is what recruits the glutes.',
      'Racing the reps. Two seconds down, no pause, drive up.',
    ],
    cue: 'Chest up — sit between your feet, not behind them.',
    anim: {
      glow: { joint: 'thighMid0', dx: 5, dy: 0 },
      props: [{ t: 'dumbbell', at: 'goblet', vertical: true }],
      poses: [
        { hip: [112, 107], torso: 6, ankles: STAND_ANKLES, legBend: KNEES_FWD, wristsRel: true, wrists: [[15, 16], [13, 18]], armBend: [1, 1] },
        { hip: [98, 140], torso: 26, ankles: STAND_ANKLES, legBend: KNEES_FWD, wristsRel: true, wrists: [[15, 15], [13, 17]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Brace — chest up' },
        { pose: 1, dur: 1500, label: 'Two seconds down, sit between your feet' },
        { pose: 1, dur: 350, label: 'Heels flat, knees out' },
        { pose: 0, dur: 1000, label: 'Drive up through mid-foot', glow: 1 },
        { pose: 0, dur: 450, label: 'Tall at the top', glow: 0.5 },
      ],
    },
  },
  {
    id: 'rdl',
    name: 'Romanian deadlift',
    patterns: ['dumbbell romanian deadlift', 'romanian deadlift', 'rdl'],
    muscles: 'Hamstrings, glutes, back',
    feel: 'A strong stretch down the back of your thighs on the way down, and the glutes as you stand.',
    setup: 'A dumbbell in each hand resting against the front of your thighs. Feet hip width. Knees softly bent — and they stay at exactly that bend throughout.',
    steps: [
      'Pull your shoulders down and back, and take a breath.',
      'Push your hips backwards, letting the weights slide down the front of your legs.',
      'Stop at a strong hamstring stretch, usually just below the knee.',
      'Drive your hips forwards to stand. Squeeze your glutes at the top — do not lean back.',
    ],
    wrong: [
      'Turning it into a squat. If the knees bend more as you go down, you have stopped hinging.',
      'Rounding the lower back to chase depth. Range comes from the hamstrings, never the spine.',
      'Letting the weights drift away from your legs — that loads the lower back instantly.',
    ],
    cue: 'Hips back, not down. Weights stay glued to your legs.',
    anim: {
      glow: { joint: 'hip', dx: -9, dy: 0 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [112, 107], torso: 4, ankles: STAND_ANKLES, legBend: KNEES_FWD, wrists: [[124, 150], [116, 152]], armBend: [1, 1] },
        { hip: [99, 116], torso: 80, headTilt: -30, ankles: STAND_ANKLES, legBend: KNEES_FWD, wrists: [[136, 148], [128, 150]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Shoulders back — soft knees' },
        { pose: 1, dur: 1500, label: 'Hips back — weights brush the legs' },
        { pose: 1, dur: 400, label: 'Feel the hamstrings stretch', glow: 0.5 },
        { pose: 0, dur: 1000, label: 'Drive the hips forward', glow: 1 },
        { pose: 0, dur: 500, label: 'Squeeze — don’t lean back', glow: 1 },
      ],
    },
  },
  {
    id: 'split_squat',
    name: 'Split squat',
    patterns: ['split squat'],
    muscles: 'Legs, glutes, balance',
    feel: 'The front leg doing almost all of the work — thigh and glute.',
    setup: 'Long stride, front foot flat, back heel lifted. Body weight only for the first month; a hand on a rack or wall if you wobble.',
    steps: [
      'Stand tall with your weight mostly on the front foot.',
      'Drop straight down, lowering the back knee towards the floor.',
      'Stop an inch or two off the floor, or as low as you can control.',
      'Push through the front heel to stand. All reps on one leg, then swap.',
    ],
    wrong: [
      'Stride too short — the front knee shoots forward and complains. Step further out.',
      'Leaning forwards over the front leg. Chest stacked over hips.',
      'Pushing off the back foot. The back leg is a kickstand.',
    ],
    cue: 'Straight down, not forwards. Front heel drives.',
    anim: {
      glow: { joint: 'thighMid0', dx: 4, dy: 0 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [110, 110], torso: 6, ankles: [[138, 167], [86, 161]], feet: [0, 48], legBend: KNEES_FWD, wrists: [[120, 114], [104, 116]], armBend: [1, 1] },
        { hip: [106, 141], torso: 12, ankles: [[138, 167], [86, 161]], feet: [0, 48], legBend: KNEES_FWD, wrists: [[116, 145], [100, 147]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Tall — weight on the front foot' },
        { pose: 1, dur: 1400, label: 'Straight down, back knee to the floor' },
        { pose: 1, dur: 300, label: 'An inch off the floor' },
        { pose: 0, dur: 950, label: 'Front heel drives', glow: 1 },
        { pose: 0, dur: 400, label: 'Back leg is only balance' },
      ],
    },
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian split squat',
    patterns: ['bulgarian split squat'],
    muscles: 'Glutes, quads, balance',
    feel: 'A deep stretch across the top of the front glute at the bottom, and a hard squeeze standing up. If it is all front-of-thigh, step further forwards.',
    setup: 'Stand about two feet in front of the bench, facing away, top of the back foot resting on it. Front foot far enough forward that the front shin stays close to vertical.',
    steps: [
      'Lean your torso forwards about 15 degrees and keep it there — that shifts the work to the glutes.',
      'Drop straight down, back knee travelling towards the floor.',
      'Go as deep as you can with the front heel flat.',
      'Push through the front heel to stand. All reps one side, then swap.',
    ],
    wrong: [
      'Front foot too close to the bench — the knee shoots past the toes and the glute does nothing.',
      'Staying bolt upright. The forward lean is not bad form here, it is the point.',
      'Starting with weight. Four weeks with body weight first.',
    ],
    cue: 'Long stride, lean forwards, push through the heel.',
    anim: {
      scene: [{ t: 'rect', x: 42, y: 138, w: 44, h: 7 }, { t: 'line', x1: 50, y1: 145, x2: 50, y2: 172, w: 2.5 }, { t: 'line', x1: 78, y1: 145, x2: 78, y2: 172, w: 2.5 }],
      glow: { joint: 'hip', dx: -7, dy: 4 },
      poses: [
        { hip: [108, 112], torso: 16, ankles: [[136, 167], [70, 132]], feet: [0, 55], legBend: KNEES_FWD, wrists: [[116, 118], [102, 120]], armBend: [1, 1] },
        { hip: [104, 143], torso: 20, ankles: [[136, 167], [70, 132]], feet: [0, 55], legBend: KNEES_FWD, wrists: [[112, 148], [98, 150]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 400, label: 'Lean forward 15° — that’s the point' },
        { pose: 1, dur: 1500, label: 'Drop straight down' },
        { pose: 1, dur: 350, label: 'Stretch across the front glute', glow: 0.6 },
        { pose: 0, dur: 950, label: 'Push through the front heel', glow: 1 },
        { pose: 0, dur: 400, label: 'Back leg is only balance' },
      ],
    },
  },
  {
    id: 'step_up',
    name: 'Step up',
    patterns: ['step up', 'step-up'],
    muscles: 'Glutes, quads',
    feel: 'The glute of the leg on the box — on the way up AND on the way down.',
    setup: 'Box or bench at roughly knee height — higher hits the glute more. Dumbbells by your sides. Whole foot on the box, heel included.',
    steps: [
      'Lean forwards slightly and drive up through the heel of the top foot.',
      'Stand all the way up and pause. The bottom leg must not help.',
      'Lower yourself back down over three seconds.',
      'Tap the floor lightly and go again.',
    ],
    wrong: [
      'Pushing off the floor with the back foot — that is a hop, not a step up.',
      'Only half the foot on the box, so the calf and quad take over.',
      'Dropping down under gravity. The lowering half is where most of the work is.',
    ],
    cue: 'Whole foot on, drive through the heel, lower slowly.',
    anim: {
      scene: [{ t: 'rect', x: 122, y: 140, w: 52, h: 32 }],
      glow: { joint: 'hip', dx: -8, dy: 2 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [98, 110], torso: 10, ankles: [[138, 135], [94, 167]], legBend: KNEES_FWD, wrists: [[106, 114], [92, 116]], armBend: [1, 1] },
        { hip: [136, 78], torso: 4, ankles: [[140, 134], [118, 146]], legBend: KNEES_FWD, wrists: [[144, 82], [130, 84]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 400, label: 'Whole foot on — heel included' },
        { pose: 1, dur: 1000, label: 'Drive through the top heel', glow: 1 },
        { pose: 1, dur: 400, label: 'Stand tall — no push from below', glow: 0.6 },
        { pose: 0, dur: 1800, label: 'Three seconds down, tap the floor' },
      ],
    },
  },
  {
    id: 'reverse_lunge',
    name: 'Reverse lunge',
    patterns: ['reverse lunge', 'lunge'],
    muscles: 'Glutes, quads',
    feel: 'The front-leg glute as you push back up. The back leg should feel like it is barely working.',
    setup: 'Stand tall, dumbbells by your sides, feet hip width.',
    steps: [
      'Take a long step straight backwards with one leg.',
      'Drop the back knee towards the floor, most of your weight on the front foot.',
      'Stop an inch or two off the floor.',
      'Push through the front heel back to the start. Alternate legs.',
    ],
    wrong: [
      'Short steps back, which makes it a quad exercise. Step long.',
      'Weight shifting onto the back foot — about 80% stays on the front leg.',
      'Looking down. Eyes on a fixed point ahead or you will wobble.',
    ],
    cue: 'Step long, weight forwards, drive through the front heel.',
    anim: {
      glow: { joint: 'hip', dx: -8, dy: 2 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [112, 107], torso: 4, ankles: [[120, 167], [106, 167]], legBend: KNEES_FWD, wrists: [[118, 112], [104, 114]], armBend: [1, 1] },
        { hip: [106, 138], torso: 10, ankles: [[120, 167], [64, 163]], feet: [0, 50], legBend: KNEES_FWD, wrists: [[112, 142], [98, 144]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 400, label: 'Stand tall' },
        { pose: 1, dur: 1300, label: 'Long step straight back' },
        { pose: 1, dur: 300, label: 'Weight stays on the front foot' },
        { pose: 0, dur: 900, label: 'Front heel — push back to start', glow: 1 },
        { pose: 0, dur: 350, label: 'Alternate legs', glow: 0.4 },
      ],
    },
  },
  {
    id: 'single_leg_rdl',
    name: 'Single-leg Romanian deadlift',
    patterns: ['single-leg romanian deadlift', 'single leg romanian deadlift'],
    muscles: 'Glutes, hamstrings, balance',
    feel: 'Deep in the standing glute and hamstring. If it is all hamstring, squeeze the glute deliberately on the way up.',
    setup: 'One light dumbbell in the hand opposite the standing leg. Soft bend in the standing knee. Eyes fixed on a spot about six feet ahead.',
    steps: [
      'Hinge forwards from the hip, the free leg travelling straight back.',
      'Keep your hips square to the floor — this is the whole exercise.',
      'Point the toes of the raised foot at the floor, not the wall.',
      'Squeeze the standing glute to come back up tall.',
    ],
    wrong: [
      'Hips rolling open, which makes it easy and useless.',
      'Rounding the back to go lower. Stop where the hips stay square.',
      'Going too heavy. Five kilos done properly beats fifteen done badly.',
      'Expecting to be steady in week one — everyone wobbles. One finger on a wall is allowed.',
    ],
    cue: 'Hips square, toes to the floor, squeeze up.',
    anim: {
      glow: { joint: 'hip', dx: -9, dy: 0 },
      props: [{ t: 'dumbbell', at: 'wrist0' }],
      poses: [
        { hip: [112, 107], torso: 4, ankles: [[118, 167], [106, 166]], legBend: KNEES_FWD, wrists: [[120, 149], [110, 150]], armBend: [1, 1] },
        { hip: [110, 110], torso: 78, headTilt: -28, ankles: [[118, 167], [50, 124]], feet: [0, 60], legBend: [-1, 1], wrists: [[148, 143], [140, 144]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Eyes on a spot ahead' },
        { pose: 1, dur: 1400, label: 'Hinge — hips stay square', glow: 0.4 },
        { pose: 1, dur: 350, label: 'Back toes point at the FLOOR' },
        { pose: 0, dur: 1000, label: 'Squeeze the standing glute up', glow: 1 },
      ],
    },
  },
  {
    id: 'band_walk',
    name: 'Lateral band walk',
    patterns: ['lateral band walk', 'band walk'],
    muscles: 'Side glutes',
    feel: 'The upper outer part of your hip, burning within ten steps. If it is in your thighs, drop lower and push the knees out harder.',
    setup: 'Band around your legs just above the knees (ankles for more). Feet hip width, quarter squat, chest up, hands together in front.',
    steps: [
      'Push your knees out against the band before you move — tension first.',
      'Step sideways with the leading foot, keeping the tension.',
      'Bring the trailing foot in slowly — never closer than hip width.',
      'Ten steps one way, ten back. Stay low the whole time.',
    ],
    wrong: [
      'Standing up between steps. Stay in the quarter squat throughout.',
      'Letting the trailing foot snap in, which releases all the tension.',
      'Knees collapsing inwards on the trailing leg.',
    ],
    cue: 'Stay low, knees out, no rest between steps.',
    anim: {
      glow: { joint: 'hip', dx: 16, dy: -3, mirror: true },
      props: [{ t: 'band' }],
      poses: [
        { hip: [112, 124], torso: 4, ankles: [[128, 167], [98, 167]], feet: [0, 180], legBend: [-1, 1], wrists: [[120, 118], [106, 118]], armBend: [-1, 1] },
        { hip: [120, 124], torso: 4, ankles: [[150, 167], [98, 167]], feet: [0, 180], legBend: [-1, 1], wrists: [[128, 118], [114, 118]], armBend: [-1, 1] },
        { hip: [132, 124], torso: 4, ankles: [[150, 167], [120, 167]], feet: [0, 180], legBend: [-1, 1], wrists: [[140, 118], [126, 118]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 1, dur: 700, label: 'Step wide — band stays tight', glow: 0.8 },
        { pose: 2, dur: 750, label: 'Trail foot in SLOW — hip width, no closer', glow: 1 },
        { pose: 1, dur: 700, label: 'Stay in the quarter squat', glow: 0.8 },
        { pose: 0, dur: 750, label: 'Knees out against the band, always', glow: 1 },
      ],
    },
  },

  // ================================================================ hinge/bridge
  {
    id: 'hip_thrust',
    name: 'Hip thrust',
    patterns: ['hip thrust'],
    muscles: 'Glutes',
    feel: 'Squarely in the middle of each bum cheek, burning by rep eight. Lower back or front-of-thigh means the setup is wrong, not you.',
    setup: 'Upper back against the long edge of the bench, roughly at the bottom of the shoulder blades. Feet flat, hip width, heels about a foot from your bum. Dumbbell across the hips on a towel.',
    steps: [
      'Tuck your chin — look at a spot on the floor a few feet ahead.',
      'Push through your heels and lift until knees-to-shoulders is one straight line. Not higher.',
      'Squeeze as hard as you can for a full two seconds at the top.',
      'Lower slowly until your bum is an inch off the floor, then go again.',
    ],
    wrong: [
      'Arching the lower back to get higher. Ribs down, hips tucked.',
      'Feet too far away (hamstrings take it) or too close (quads take it). Find the glute spot and remember it.',
      'Going up and straight back down. The two-second squeeze IS the exercise.',
      'Being too polite with the weight — this is the one to push.',
    ],
    cue: 'Chin tucked, ribs down, squeeze for two.',
    anim: {
      scene: [{ t: 'rect', x: 30, y: 118, w: 52, h: 8 }, { t: 'line', x1: 38, y1: 126, x2: 38, y2: 172, w: 2.5 }, { t: 'line', x1: 74, y1: 126, x2: 74, y2: 172, w: 2.5 }],
      glow: { joint: 'hip', dx: -6, dy: 7 },
      props: [{ t: 'dumbbell', at: 'hips' }],
      poses: [
        { hip: [112, 116], torso: -82, headTilt: 34, ankles: [[134, 166], [126, 167]], legBend: KNEES_FWD, wrists: [[104, 106], [116, 104]], armBend: [1, -1] },
        { hip: [104, 150], torso: -41, headTilt: 24, ankles: [[134, 166], [126, 167]], legBend: KNEES_FWD, wrists: [[100, 140], [112, 138]], armBend: [1, -1] },
      ],
      phases: [
        { pose: 1, dur: 500, label: 'Chin tucked — heels a foot out' },
        { pose: 0, dur: 700, label: 'Drive the heels — hips to a straight line', glow: 0.7 },
        { pose: 0, dur: 2000, label: 'SQUEEZE — two full seconds', glow: 1 },
        { pose: 1, dur: 1150, label: 'Lower slow — an inch off the floor' },
      ],
    },
  },
  {
    id: 'glute_bridge',
    name: 'Glute bridge',
    patterns: ['glute bridge'],
    muscles: 'Glutes (learning)',
    feel: 'Both glutes, evenly. Use this to find the feeling, then take it to the hip thrust.',
    setup: 'On your back, knees bent, feet flat and hip width, heels close enough to brush with your fingertips. Arms by your sides.',
    steps: [
      'Press your lower back flat into the floor before you lift anything.',
      'Push through your heels and lift to a straight line, knees to shoulders.',
      'Squeeze hard for three seconds at the top.',
      'Lower slowly and touch the floor lightly rather than resting on it.',
    ],
    wrong: [
      'Lifting so high the back arches — hips only need to reach the line.',
      'Pushing through the toes, which hands the work to the quads.',
      'Rushing twenty reps. Ten slow ones with a real squeeze wins.',
    ],
    cue: 'Heels, not toes. Squeeze for three.',
    anim: {
      glow: { joint: 'hip', dx: -4, dy: 8 },
      poses: [
        { hip: [108, 138], torso: -121, headTilt: 30, ankles: [[128, 166], [120, 167]], legBend: KNEES_FWD, wrists: [[92, 164], [86, 166]], armBend: [1, -1] },
        { hip: [104, 160], torso: -95, headTilt: 8, ankles: [[128, 166], [120, 167]], legBend: KNEES_FWD, wrists: [[88, 166], [82, 167]], armBend: [1, -1] },
      ],
      phases: [
        { pose: 1, dur: 500, label: 'Lower back pressed into the floor' },
        { pose: 0, dur: 700, label: 'Heels — not toes', glow: 0.7 },
        { pose: 0, dur: 2400, label: 'Squeeze for three full seconds', glow: 1 },
        { pose: 1, dur: 1100, label: 'Touch down lightly, go again' },
      ],
    },
  },

  // ================================================================ upper
  {
    id: 'bench_press',
    name: 'Dumbbell bench press',
    patterns: ['dumbbell bench press', 'bench press'],
    muscles: 'Chest, shoulders, triceps',
    feel: 'Across the chest, with the triceps helping near the top.',
    setup: 'Sit on the end of the bench with the dumbbells on your thighs, lie back using your knees to kick them up. Feet flat on the floor.',
    steps: [
      'Set your shoulder blades down and back into the bench.',
      'Start with arms straight, weights above your chest — not your face.',
      'Lower for three seconds until your elbows are level with your ribs.',
      'Press up and slightly together. Don’t clash them at the top.',
    ],
    wrong: [
      'Elbows flared straight out. Tuck them to about 45 degrees.',
      'Bouncing the weights off the chest. Touch, pause, press.',
      'Feet up on the bench, which costs all your stability.',
    ],
    cue: 'Blades pinned, elbows at 45 degrees.',
    anim: {
      scene: [{ t: 'rect', x: 54, y: 130, w: 110, h: 8 }, { t: 'line', x1: 64, y1: 138, x2: 64, y2: 172, w: 2.5 }, { t: 'line', x1: 152, y1: 138, x2: 152, y2: 172, w: 2.5 }],
      glow: { joint: 'shoulder', dx: 9, dy: -7 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [126, 124], torso: -88, ankles: [[148, 167], [140, 167]], legBend: KNEES_FWD, wrists: [[80, 82], [90, 84]], armBend: [1, 1] },
        { hip: [126, 124], torso: -88, ankles: [[148, 167], [140, 167]], legBend: KNEES_FWD, wrists: [[78, 112], [92, 114]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Blades pinned — feet planted' },
        { pose: 1, dur: 1500, label: 'Three seconds down, elbows 45°' },
        { pose: 1, dur: 300, label: 'Touch — pause' },
        { pose: 0, dur: 850, label: 'Press up and slightly together', glow: 1 },
        { pose: 0, dur: 350, label: 'Arms straight, over the chest', glow: 0.4 },
      ],
    },
  },
  {
    id: 'lat_pulldown',
    name: 'Lat pulldown',
    patterns: ['lat pulldown', 'pulldown'],
    muscles: 'Back, biceps',
    feel: 'The outer edges of your back, under the armpits. The arms tiring too is normal.',
    setup: 'Thigh pad snug so you don’t lift off the seat. Grip a little wider than your shoulders, palms away.',
    steps: [
      'Sit tall, lean back about 15 degrees and hold that angle.',
      'Before you pull, draw your shoulders down away from your ears.',
      'Drive your elbows down and back until the bar reaches your collarbone.',
      'Let it rise slowly — let the shoulders stretch up at the very top.',
    ],
    wrong: [
      'Pulling with the arms and forgetting the back. Start from the shoulder blades.',
      'Rocking backwards to move the bar. If the torso swings, drop the weight.',
      'Pulling behind the neck. No benefit, hard on the shoulder.',
    ],
    cue: 'Shoulders down first, then elbows to your pockets.',
    anim: {
      scene: [
        { t: 'rect', x: 96, y: 144, w: 56, h: 6 }, { t: 'line', x1: 104, y1: 150, x2: 104, y2: 172, w: 2.5 }, { t: 'line', x1: 144, y1: 150, x2: 144, y2: 172, w: 2.5 },
        { t: 'rect', x: 112, y: 126, w: 30, h: 7 },
      ],
      glow: { joint: 'torsoMid', dx: -9, dy: 2 },
      props: [{ t: 'bar', cable: [128, 2] }],
      poses: [
        { hip: [112, 140], torso: -12, ankles: [[142, 167], [134, 167]], legBend: KNEES_FWD, wrists: [[121, 54], [135, 54]], armBend: [1, 1] },
        { hip: [112, 140], torso: -14, ankles: [[142, 167], [134, 167]], legBend: KNEES_FWD, wrists: [[115, 94], [129, 94]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Shoulders down away from the ears' },
        { pose: 1, dur: 900, label: 'Elbows to the back pockets', glow: 1 },
        { pose: 1, dur: 400, label: 'Bar to the collarbone — chest proud', glow: 1 },
        { pose: 0, dur: 1500, label: 'Slow up — full stretch at the top' },
      ],
    },
  },
  {
    id: 'one_arm_row',
    name: 'One-arm dumbbell row',
    patterns: ['one-arm dumbbell row', 'one arm dumbbell row', 'one-arm row', 'dumbbell row'],
    muscles: 'Back, biceps, core',
    feel: 'The side of your back and between the blades — not the arm doing everything.',
    setup: 'One hand and same-side knee on the bench, other foot on the floor out to the side. Back flat, roughly parallel to the floor.',
    steps: [
      'Let the dumbbell hang and let the shoulder blade stretch forwards.',
      'Pull the blade back first, then row the dumbbell to your lower ribs.',
      'Elbow stays close to your side — no flaring.',
      'Lower all the way down. Full stretch every rep.',
    ],
    wrong: [
      'Twisting the torso to lift more. Shoulders stay level with the floor.',
      'Rowing to the armpit instead of the hip — that becomes a shoulder exercise.',
      'Half reps at the bottom. The stretch is where the growth is.',
    ],
    cue: 'Blade first, then elbow, to your hip.',
    anim: {
      scene: [{ t: 'rect', x: 92, y: 140, w: 84, h: 7 }, { t: 'line', x1: 100, y1: 147, x2: 100, y2: 172, w: 2.5 }, { t: 'line', x1: 168, y1: 147, x2: 168, y2: 172, w: 2.5 }],
      glow: { joint: 'torsoMid', dx: 2, dy: -9 },
      props: [{ t: 'dumbbell', at: 'wrist0' }],
      poses: [
        { hip: [152, 124], torso: -86, headTilt: -6, ankles: [[176, 146], [136, 167]], feet: [40, 0], legBend: [1, -1], wrists: [[112, 160], [102, 139]], armBend: [-1, 1] },
        { hip: [152, 124], torso: -86, headTilt: -6, ankles: [[176, 146], [136, 167]], feet: [40, 0], legBend: [1, -1], wrists: [[116, 122], [102, 139]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Back flat — let the blade stretch' },
        { pose: 1, dur: 800, label: 'Blade first, then elbow to the hip', glow: 1 },
        { pose: 1, dur: 350, label: 'To the lower ribs — no twist', glow: 1 },
        { pose: 0, dur: 1300, label: 'All the way down — full stretch' },
      ],
    },
  },
  {
    id: 'seated_row',
    name: 'Seated row',
    patterns: ['seated row'],
    muscles: 'Mid back, posture',
    feel: 'Between and just below the shoulder blades. If it is all biceps, the arms are starting before the back.',
    setup: 'On the low pulley, feet on the plate, slight knee bend. Sit up tall, arms straight.',
    steps: [
      'Let the shoulders travel forwards first so the back gets a full stretch.',
      'Pull the shoulder blades together — squeeze a pencil between them.',
      'Row the handle into your belly button, elbows brushing your sides.',
      'Hold the squeeze a second, then let it back out slowly and fully.',
    ],
    wrong: [
      'Leaning backwards to move the weight. Torso stays near vertical.',
      'Pulling to the chest, which flares the elbows out.',
      'Shrugging towards the ears. Shoulders down, neck long.',
    ],
    cue: 'Blades together, then handle to your belly button.',
    anim: {
      scene: [
        { t: 'rect', x: 204, y: 96, w: 14, h: 76 }, { t: 'line', x1: 162, y1: 146, x2: 172, y2: 168, w: 4 },
        { t: 'rect', x: 74, y: 142, w: 46, h: 6 }, { t: 'line', x1: 82, y1: 148, x2: 82, y2: 172, w: 2.5 }, { t: 'line', x1: 112, y1: 148, x2: 112, y2: 172, w: 2.5 },
      ],
      glow: { joint: 'torsoMid', dx: -9, dy: -3 },
      props: [{ t: 'handle', cable: [204, 128] }],
      poses: [
        { hip: [96, 138], torso: 14, ankles: [[158, 158], [154, 160]], legBend: [1, 1], wrists: [[142, 128], [140, 132]], armBend: [1, 1] },
        { hip: [96, 138], torso: -6, ankles: [[158, 158], [154, 160]], legBend: [1, 1], wrists: [[106, 126], [104, 130]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Full stretch — let the blades open' },
        { pose: 1, dur: 800, label: 'Blades together FIRST', glow: 1 },
        { pose: 1, dur: 400, label: 'Handle to the belly button', glow: 1 },
        { pose: 0, dur: 1300, label: 'Let it back out slowly, fully' },
      ],
    },
  },
  {
    id: 'shoulder_press',
    name: 'Seated shoulder press',
    patterns: ['seated dumbbell shoulder press', 'seated shoulder press', 'shoulder press'],
    muscles: 'Shoulders, triceps',
    feel: 'The tops and fronts of your shoulders, triceps at the top of each rep.',
    setup: 'Bench upright. Dumbbells at shoulder height, palms forward, elbows slightly in front of the body rather than straight out.',
    steps: [
      'Brace your stomach and press your back into the pad.',
      'Press up and slightly inwards so the weights finish close together overhead.',
      'Stop just short of locking the elbows.',
      'Lower under control until elbows are level with shoulders.',
    ],
    wrong: [
      'Arching the lower back to press more. If the ribs flare, it is too heavy.',
      'Elbows straight out in a T, which grinds the shoulder joint.',
      'Starting too heavy — light is a real working weight here.',
    ],
    cue: 'Ribs down, press up and in.',
    anim: {
      scene: [
        { t: 'rect', x: 86, y: 78, w: 7, h: 66 },
        { t: 'rect', x: 86, y: 142, w: 50, h: 6 }, { t: 'line', x1: 94, y1: 148, x2: 94, y2: 172, w: 2.5 }, { t: 'line', x1: 128, y1: 148, x2: 128, y2: 172, w: 2.5 },
      ],
      glow: { joint: 'shoulder', dx: 4, dy: -5 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [104, 138], torso: -4, ankles: [[132, 167], [124, 167]], legBend: KNEES_FWD, wrists: [[116, 94], [108, 96]], armBend: [1, 1] },
        { hip: [104, 138], torso: -4, ankles: [[132, 167], [124, 167]], legBend: KNEES_FWD, wrists: [[108, 48], [102, 50]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Ribs down — back into the pad' },
        { pose: 1, dur: 900, label: 'Press up and slightly in', glow: 1 },
        { pose: 1, dur: 300, label: 'Just short of locked' },
        { pose: 0, dur: 1300, label: 'Lower to elbow-at-shoulder level' },
      ],
    },
  },
  {
    id: 'lateral_raise',
    name: 'Lateral raise',
    patterns: ['lateral raise'],
    muscles: 'Side shoulders',
    feel: 'The very outside of the shoulder, a couple of inches down from the top. It burns quickly.',
    setup: 'Genuinely light dumbbells. Stand tall, arms by your sides, a small permanent bend in the elbows.',
    steps: [
      'Lead with your elbows rather than your hands.',
      'Raise out to the sides until arms are level with shoulders. No higher.',
      'Pause for a beat at the top.',
      'Lower slowly over three seconds, all the way down.',
    ],
    wrong: [
      'Too much weight and swinging. If the body moves at all, halve it.',
      'Shrugging the shoulders up towards the ears.',
      'Going above shoulder height, which hands the work to the traps.',
    ],
    cue: 'Elbows lead — pour the water out at the top.',
    anim: {
      glow: { joint: 'shoulder', dx: 19, dy: 2, mirror: true },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [116, 108], torso: 0, ankles: [[128, 167], [104, 167]], feet: [0, 180], legBend: [-1, 1], wrists: [[132, 148], [100, 148]], armBend: [-1, 1] },
        { hip: [116, 108], torso: 0, ankles: [[128, 167], [104, 167]], feet: [0, 180], legBend: [-1, 1], wrists: [[170, 94], [62, 94]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Genuinely light weights' },
        { pose: 1, dur: 900, label: 'Elbows lead — stop at shoulder height', glow: 1 },
        { pose: 1, dur: 400, label: 'Pause at the top', glow: 1 },
        { pose: 0, dur: 1600, label: 'Three seconds down, all the way' },
      ],
    },
  },
  {
    id: 'curl',
    name: 'Dumbbell curl',
    patterns: ['dumbbell curl', 'curl'],
    muscles: 'Biceps',
    feel: 'The biceps only. If your hips move, you are cheating them.',
    setup: 'Stand tall, dumbbells by your sides, palms forward. Elbows tucked against the ribs — and they stay there.',
    steps: [
      'Curl the weight up by bending the elbow only.',
      'Squeeze hard at the top for a full second.',
      'Lower slowly — three seconds — until the arm is completely straight.',
      'Do not let the elbow drift forwards as you curl.',
    ],
    wrong: [
      'Swinging the body to get the weight up.',
      'Stopping short at the bottom. Straighten fully every rep.',
      'Elbows travelling forwards, which turns it into a front raise.',
    ],
    cue: 'Elbows pinned. Only the forearm moves.',
    anim: {
      glow: { joint: 'upperArmMid0', dx: 4, dy: 0 },
      props: [{ t: 'dumbbell', at: 'wrists' }],
      poses: [
        { hip: [112, 107], torso: 2, ankles: STAND_ANKLES, legBend: KNEES_FWD, wrists: [[118, 110], [112, 112]], armBend: [1, 1] },
        { hip: [112, 107], torso: 2, ankles: STAND_ANKLES, legBend: KNEES_FWD, wrists: [[126, 84], [120, 86]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Elbows pinned to the ribs' },
        { pose: 1, dur: 800, label: 'Curl — only the forearm moves', glow: 1 },
        { pose: 1, dur: 500, label: 'Squeeze for a full second', glow: 1 },
        { pose: 0, dur: 1500, label: 'Three seconds down — dead straight' },
      ],
    },
  },

  // ================================================================ core
  {
    id: 'plank',
    name: 'Plank',
    patterns: ['plank'],
    muscles: 'Core, lower back',
    feel: 'Deep across the front of your stomach — and, done right, your glutes too.',
    setup: 'Forearms on the floor, elbows under shoulders, feet hip width, one straight line from head to heels.',
    steps: [
      'Push the floor away with your forearms so the upper back doesn’t sag.',
      'Squeeze your glutes hard — the part everyone skips.',
      'Tuck your hips slightly so the lower back flattens.',
      'Breathe normally. If you can’t talk, you’re holding your breath.',
    ],
    wrong: [
      'Hips sagging towards the floor — that loads the lower back, not the core.',
      'Bum in the air, which makes it easy and pointless.',
      'Chasing long holds. Thirty hard seconds beats two soft minutes.',
    ],
    cue: 'Squeeze the glutes and the plank fixes itself.',
    anim: {
      glow: { joint: 'torsoMid', dx: 0, dy: 9 },
      poses: [
        { hip: [130, 152], torso: -88, headTilt: -4, ankles: [[196, 162], [190, 163]], feet: [70, 70], legBend: [1, 1], wrists: [[108, 168], [104, 169]], armBend: [1, 1] },
        { hip: [130, 161], torso: -80, headTilt: -10, ankles: [[196, 162], [190, 163]], feet: [70, 70], legBend: [1, 1], wrists: [[108, 168], [104, 169]], armBend: [1, 1] },
      ],
      phases: [
        { pose: 0, dur: 2600, label: 'One line, head to heels — glutes tight', glow: 0.8 },
        { pose: 1, dur: 700, label: 'The classic fault…', bad: true },
        { pose: 1, dur: 900, label: 'Hips sag — the lower back pays', bad: true },
        { pose: 0, dur: 700, label: 'Fix: tuck the hips, squeeze', glow: 1 },
      ],
    },
  },
  {
    id: 'side_plank',
    name: 'Side plank',
    patterns: ['side plank'],
    muscles: 'Side core, hips',
    feel: 'Down the side of your bottom hip and along the side of your waist.',
    setup: 'On your side, elbow directly under the shoulder, legs straight, feet stacked. Top hand on your hip.',
    steps: [
      'Push the forearm into the floor and lift your hips.',
      'One straight line from head through hips to ankles.',
      'Top hip stacked directly above the bottom one — don’t roll forwards.',
      'Hold, breathing normally, then swap sides. Harder side first.',
    ],
    wrong: [
      'Hips dropping towards the floor.',
      'Rolling forwards so the chest points at the floor.',
      'Elbow out in front of the shoulder, which strains it.',
    ],
    cue: 'Hips up, shoulders stacked, do not roll forwards.',
    anim: {
      glow: { joint: 'torsoMid', dx: 0, dy: -7 },
      poses: [
        { hip: [110, 147], torso: -92, headTilt: 0, ankles: [[172, 162], [168, 163]], legBend: [1, 1], wrists: [[88, 168], [112, 138]], armBend: [1, -1] },
        { hip: [110, 158], torso: -84, headTilt: -6, ankles: [[172, 162], [168, 163]], legBend: [1, 1], wrists: [[88, 168], [112, 148]], armBend: [1, -1] },
      ],
      phases: [
        { pose: 0, dur: 800, label: 'Push the floor away — hips up' },
        { pose: 0, dur: 2200, label: 'Shoulders stacked — breathe', glow: 0.9 },
        { pose: 1, dur: 800, label: 'The fault: the hip drops', bad: true },
        { pose: 0, dur: 800, label: 'Lift back to the line', glow: 1 },
      ],
    },
  },
  {
    id: 'dead_bug',
    name: 'Dead bug',
    patterns: ['dead bug'],
    muscles: 'Deep core, coordination',
    feel: 'The midsection working to keep the lower back welded to the floor while the limbs move.',
    setup: 'On your back. Arms straight up, knees and hips at 90 degrees so the shins are parallel to the floor.',
    steps: [
      'Press the lower back flat into the floor — this is the whole exercise.',
      'Slowly lower one arm behind you and the opposite leg away.',
      'Only as far as the back stays pinned down.',
      'Return and swap sides. Three seconds out, three back.',
    ],
    wrong: [
      'Letting the lower back arch off the floor. Shorten the range.',
      'Moving fast. Slow is the point.',
      'Holding your breath — breathe out as the limbs extend.',
    ],
    cue: 'Lower back stays welded to the floor.',
    anim: {
      glow: { joint: 'torsoMid', dx: 0, dy: -8 },
      poses: [
        { hip: [122, 152], torso: -93, ankles: [[144, 120], [140, 122]], legBend: [-1, -1], wrists: [[78, 112], [84, 114]], armBend: [1, -1] },
        { hip: [122, 152], torso: -93, ankles: [[144, 120], [180, 144]], legBend: [-1, -1], wrists: [[44, 146], [84, 114]], armBend: [1, -1] },
      ],
      phases: [
        { pose: 0, dur: 500, label: 'Lower back welded to the floor' },
        { pose: 1, dur: 1400, label: 'Opposite arm and leg away — slow', glow: 0.8 },
        { pose: 1, dur: 300, label: 'Only as far as the back stays down', glow: 1 },
        { pose: 0, dur: 1100, label: 'Back to the start — swap sides' },
      ],
    },
  },

  // ================================================================ cardio
  {
    id: 'rowing_machine',
    name: 'Rowing machine',
    patterns: ['rowing machine', '2,000 m row', '2000 m row', 'rower'],
    muscles: 'Conditioning, back, legs',
    feel: 'Legs doing sixty per cent of the work, back and arms finishing it.',
    setup: 'Strap across the ball of the foot. Sit tall, shins vertical, arms straight, shoulders in front of hips.',
    steps: [
      'Legs first: push the floor away while the arms stay straight.',
      'When the legs are almost flat, swing the torso back to eleven o’clock.',
      'Last, pull the handle to the bottom of your ribcage, elbows past the body.',
      'Reverse it exactly: arms away, body forwards, then bend the knees.',
    ],
    wrong: [
      'Pulling with the arms first. It is legs, body, arms.',
      'Yanking the handle to the chin — it comes to the lower ribs.',
      'Frantic stroke rate. Slow powerful strokes, 22–26 per minute.',
    ],
    cue: 'Legs, body, arms. Then arms, body, legs.',
    anim: {
      scene: [
        { t: 'line', x1: 42, y1: 152, x2: 198, y2: 152, w: 3 },
        { t: 'circle', cx: 54, cy: 132, r: 15 },
        { t: 'line', x1: 78, y1: 124, x2: 90, y2: 150, w: 4 },
      ],
      glow: { joint: 'torsoMid', dx: 7, dy: 0 },
      props: [{ t: 'handle', cable: [62, 124] }],
      poses: [
        { hip: [120, 144], torso: -18, ankles: [[84, 132], [86, 136]], feet: [230, 230], legBend: [-1, -1], wrists: [[78, 122], [80, 126]], armBend: [-1, 1] },
        { hip: [150, 144], torso: 14, ankles: [[84, 132], [86, 136]], feet: [230, 230], legBend: [-1, -1], wrists: [[140, 122], [142, 126]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 0, dur: 400, label: 'Catch: shins vertical, arms long' },
        { pose: 1, dur: 900, label: 'Legs push FIRST — then body, then arms', glow: 1 },
        { pose: 1, dur: 250, label: 'Handle to the lower ribs', glow: 0.7 },
        { pose: 0, dur: 1400, label: 'Recover slow: arms, body, slide' },
      ],
    },
  },
  {
    id: 'incline_walk',
    name: 'Incline treadmill walk',
    patterns: ['incline treadmill walk', 'incline walk', 'walk-run', 'treadmill', 'steady cardio', 'steady —'],
    muscles: 'Base fitness, fat loss',
    feel: 'Breathing hard but able to hold a conversation. If you can’t speak a sentence, drop the incline — not the time.',
    setup: 'Incline 5–6%, speed about 5 km/h. Adjust until it is work but you could still talk.',
    steps: [
      'Stand tall — don’t lean into the belt.',
      'Let go of the handrails. Holding on cuts the work by a third.',
      'Normal-length strides, rolling heel to toe.',
      'Talk test every few minutes.',
    ],
    wrong: [
      'Gripping the rails and leaning back — you’re walking downhill at that point.',
      'Incline so high you have to hold on. Lower, hands off, is better.',
      'Skipping it because it feels too easy to count. It builds the engine.',
    ],
    cue: 'Hands off the rails. Talk test, every time.',
    anim: {
      scene: [
        { t: 'line', x1: 56, y1: 168, x2: 184, y2: 146, w: 4 },
        { t: 'line', x1: 184, y1: 146, x2: 196, y2: 112, w: 3 },
        { t: 'rect', x: 188, y: 102, w: 24, h: 11 },
      ],
      poses: [
        { hip: [114, 96], torso: 5, ankles: [[140, 148], [94, 162]], feet: [-10, -10], legBend: KNEES_FWD, wrists: [[128, 100], [102, 106]], armBend: [1, -1] },
        { hip: [114, 99], torso: 5, ankles: [[92, 162], [138, 149]], feet: [-10, -10], legBend: KNEES_FWD, wrists: [[104, 106], [126, 100]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 0, dur: 600, label: 'Stand tall — hands OFF the rails' },
        { pose: 1, dur: 600, label: 'Heel to toe, normal strides' },
        { pose: 0, dur: 600, label: 'Breathing hard but able to chat' },
        { pose: 1, dur: 600, label: 'Too easy? Raise incline, not speed' },
      ],
    },
  },
  {
    id: 'running',
    name: 'Running',
    patterns: ['easy run', 'hills or intervals', 'run — whatever', 'run —', 'running', 'intervals — 6'],
    muscles: 'Heart, head, calorie budget',
    feel: 'Everywhere, which is the point. Easy runs conversational; hill efforts genuinely hard.',
    setup: 'Two runs a week during the plan, three at most. One of them hills or intervals, the other genuinely easy.',
    steps: [
      'Easy runs: conversational pace, full sentences.',
      'Hill session: 6–8 efforts of 60–90 seconds uphill, walk back down.',
      'Put the hard run at least 48 hours from a leg day — or straight after the weights.',
      'Relaxed shoulders, quick light steps.',
    ],
    wrong: [
      'Running the day after a heavy leg session and wondering why it feels awful.',
      'Adding mileage when the scale stalls. Fix the food instead.',
      'Every run at the same medium effort. Easy easy, hard hard.',
    ],
    cue: 'Two runs, one hard uphill, one easy. Weights first.',
    anim: {
      poses: [
        { hip: [112, 106], torso: 8, ankles: [[136, 138], [80, 152]], feet: [-15, 45], legBend: KNEES_FWD, wrists: [[134, 88], [96, 92]], armBend: [1, -1] },
        { hip: [112, 110], torso: 8, ankles: [[82, 150], [134, 140]], feet: [45, -15], legBend: KNEES_FWD, wrists: [[98, 92], [132, 88]], armBend: [-1, 1] },
      ],
      phases: [
        { pose: 0, dur: 450, label: 'Relaxed shoulders, light steps' },
        { pose: 1, dur: 450, label: 'Easy means conversational' },
        { pose: 0, dur: 450, label: 'Hills: drive the arms' },
        { pose: 1, dur: 450, label: 'Hard days hard, easy days easy' },
      ],
    },
  },
]

export const MOVEMENTS_BY_ID = new Map(MOVEMENTS.map((m) => [m.id, m]))

// Longest pattern wins, so "single-leg romanian deadlift" beats "romanian
// deadlift" and "side plank" beats "plank".
const MATCHERS = MOVEMENTS
  .flatMap((m) => m.patterns.map((pattern) => ({ pattern, id: m.id })))
  .sort((a, b) => b.pattern.length - a.pattern.length)

/** Find the movement guide for an exercise or cardio title, or null. */
export function findMovement(name) {
  const cleaned = String(name || '').toLowerCase()
  for (const { pattern, id } of MATCHERS) {
    if (cleaned.includes(pattern)) return MOVEMENTS_BY_ID.get(id)
  }
  return null
}
