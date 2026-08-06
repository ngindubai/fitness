/**
 * Six-month training and food plans, encoded from the two plan documents.
 *
 * These are stored as weekly/phase *templates*, not 180 pre-written days:
 * any date's prescription is computed on demand from the template plus the
 * plan's start date (see ../plan.js). That keeps the database clean, makes
 * the whole six months browsable through the calendar, and means a plan can
 * be re-anchored to a different start date without touching stored data.
 *
 * Exercise `group` matches the volume groups the engine already tracks
 * (legs / push / pull / core / full). `logText` strings are fed through the
 * ordinary workout parser when a block is confirmed, so confirmed cardio is
 * indistinguishable from hand-typed cardio.
 */

const ex = (name, group, note = null) => ({ name, group, ...(note ? { note } : {}) })

// ---------------------------------------------------------------- Gareth

const GARETH_SESSION_A1 = {
  title: 'Session A — full body',
  exercises: [
    ex('Goblet squat', 'legs'),
    ex('Dumbbell bench press', 'push'),
    ex('Lat pulldown', 'pull'),
    ex('Dumbbell Romanian deadlift', 'legs'),
    ex('Plank', 'core', 'Hard 30–45 s holds beat soft minutes'),
  ],
}
const GARETH_SESSION_B1 = {
  title: 'Session B — full body',
  exercises: [
    ex('Split squat', 'legs'),
    ex('Seated dumbbell shoulder press', 'push'),
    ex('One-arm dumbbell row', 'pull'),
    ex('Hip thrust', 'legs'),
    ex('Dead bug', 'core'),
  ],
}

const GARETH_SESSION_A3 = {
  title: 'Session A — legs & push',
  exercises: [
    ex('Goblet squat', 'legs'),
    ex('Split squat', 'legs'),
    ex('Hip thrust', 'legs'),
    ex('Dumbbell bench press', 'push'),
    ex('Seated dumbbell shoulder press', 'push'),
    ex('Lateral raise', 'push'),
  ],
}
const GARETH_SESSION_B3 = {
  title: 'Session B — pull & core',
  exercises: [
    ex('Lat pulldown', 'pull'),
    ex('One-arm dumbbell row', 'pull'),
    ex('Dumbbell Romanian deadlift', 'legs'),
    ex('Dumbbell curl', 'pull'),
    ex('Plank', 'core'),
    ex('Dead bug', 'core'),
  ],
}
const GARETH_SESSION_C3 = {
  title: 'Session C — full body',
  exercises: [
    ex('Goblet squat', 'legs'),
    ex('Dumbbell bench press', 'push'),
    ex('Lat pulldown', 'pull'),
    ex('Dumbbell Romanian deadlift', 'legs'),
    ex('Rowing machine finisher', 'full', '5 easy minutes to close'),
  ],
}

// ------------------------------------------------------------------ Katy

const KATY_SESSION_A = {
  title: 'Session A — glutes & hamstrings',
  exercises: [
    ex('Hip thrust', 'legs', 'Two-second squeeze at the top of every rep'),
    ex('Romanian deadlift', 'legs'),
    ex('Bulgarian split squat', 'legs', 'Lean forward ~15°, long stride'),
    ex('Lateral band walk', 'legs', 'Stay low the whole set'),
    ex('Side plank', 'core'),
  ],
}
const KATY_SESSION_A_LEARN = {
  title: 'Session A — glutes & hamstrings',
  exercises: [
    ex('Glute bridge', 'legs', 'Learning month: bridge before thrust'),
    ex('Romanian deadlift', 'legs'),
    ex('Bulgarian split squat', 'legs', 'Bodyweight only this month'),
    ex('Lateral band walk', 'legs'),
    ex('Side plank', 'core'),
  ],
}
const KATY_SESSION_A_BUILD = {
  title: 'Session A — glutes & hamstrings',
  exercises: [
    ex('Hip thrust', 'legs', 'Pause at the top; last set close to failure'),
    ex('Romanian deadlift', 'legs'),
    ex('Bulgarian split squat', 'legs'),
    ex('Single-leg Romanian deadlift', 'legs'),
    ex('Lateral band walk', 'legs'),
    ex('Side plank', 'core'),
  ],
}
const KATY_SESSION_B = {
  title: 'Session B — upper body',
  exercises: [
    ex('Lat pulldown', 'pull'),
    ex('Seated row', 'pull'),
    ex('Dumbbell bench press', 'push'),
    ex('Seated shoulder press', 'push'),
    ex('Lateral raise', 'push', 'Genuinely light — 3–5 kg'),
    ex('Plank', 'core'),
  ],
}
const KATY_SESSION_C = {
  title: 'Session C — glutes & quads',
  exercises: [
    ex('Goblet squat', 'legs', 'Wide stance, toes out, full depth'),
    ex('Step up', 'legs', 'Three seconds down'),
    ex('Reverse lunge', 'legs'),
    ex('Single-leg Romanian deadlift', 'legs'),
    ex('Plank', 'core'),
  ],
}
const KATY_SESSION_C_LATE = {
  title: 'Session C — glutes & quads',
  exercises: [
    ex('Goblet squat', 'legs'),
    ex('Step up', 'legs'),
    ex('Reverse lunge', 'legs'),
    ex('Glute bridge', 'legs', 'Back as a burnout finisher'),
    ex('Plank', 'core'),
  ],
}

// ------------------------------------------------------------------ plans

export const PLANS = {
  sixmonthsback: {
    id: 'sixmonthsback',
    name: 'Six Months Back',
    owner: 'Gareth',
    weeks: 26,
    gymDays: [0, 2, 4], // Mon / Wed / Fri (0 = Monday)
    deloadWeeks: [8, 16, 24],
    testWeek: 26,
    kcal: 2300,
    macros: { protein: 180, carbs: 225, fat: 75 },
    stepsTarget: 8000,
    stepsNote: 'Outside means early or late — not the 2 pm sun.',
    restNote: 'Rest day. Steps still count, and the day between sessions is where the muscle is actually built.',
    phases: [
      {
        number: 1, name: 'Turn up', weeks: [1, 4],
        focus: 'Technique and showing up. Alternate sessions A and B, a day between them.',
        scheme: { sets: 2, reps: '10–12', effort: 'Stop 4–5 reps short of failure', rest: '90 s' },
        rotation: 'alternate',
        sessions: [GARETH_SESSION_A1, GARETH_SESSION_B1],
        cardio: [
          { title: 'Incline walk — 12 min', detail: '5–6% incline at about 5 km/h. No jogging before week 13.', logText: 'treadmill walk 12 min' },
        ],
        restCardio: null,
      },
      {
        number: 2, name: 'Build the base', weeks: [5, 12],
        focus: 'Load goes up. Same alternating sessions plus one isolation lift each.',
        scheme: { sets: 3, reps: '8–12', effort: 'Last set 2–3 reps short of failure', rest: '90 s' },
        rotation: 'alternate',
        sessions: [
          { ...GARETH_SESSION_A1, exercises: [...GARETH_SESSION_A1.exercises, ex('Lateral raise', 'push')] },
          { ...GARETH_SESSION_B1, exercises: [...GARETH_SESSION_B1.exercises, ex('Dumbbell curl', 'pull')] },
        ],
        cardio: [
          { title: 'Steady cardio — 20–25 min', detail: 'Incline walk, cross trainer or rower. Conversational pace.', logText: 'cross trainer 22 min' },
        ],
        restCardio: { title: 'Optional walk — 30 min', detail: 'Easy outdoor walk on one off day. Early, before the heat.', logText: 'walked 30 min', optional: true },
      },
      {
        number: 3, name: 'Get strong', weeks: [13, 20],
        focus: 'Three different sessions a week: legs & push, pull & core, full body.',
        scheme: { sets: 3, reps: '6–12', effort: 'Last set 1–2 reps short of failure', rest: '2 min on the big lifts' },
        rotation: 'weekly',
        sessions: [GARETH_SESSION_A3, GARETH_SESSION_B3, GARETH_SESSION_C3],
        cardio: [
          { title: 'Steady — 25 min', detail: 'Incline walk, cross trainer or rower.', logText: 'cross trainer 25 min' },
          { title: 'Intervals — 6–8 × 1 min hard / 2 min easy', detail: 'Rower or cross trainer. First jogging is allowed from here.', logText: 'rowing machine 20 min hard' },
          { title: 'Optional walk-run — 6 × (1 min jog / 3 min walk)', detail: 'Treadmill. Skip it if the knees complain.', logText: 'treadmill 24 min', optional: true },
        ],
        restCardio: { title: 'Optional walk — 30 min', detail: 'Easy outdoor walk. Early, before the heat.', logText: 'walked 30 min', optional: true },
      },
      {
        number: 4, name: 'Make it yours', weeks: [21, 26],
        focus: 'Heavier, plus one back-off set on your best lift each session.',
        scheme: { sets: 4, reps: '6–15', effort: 'Top set 1 rep short of failure, then one back-off set', rest: '2 min on the big lifts' },
        rotation: 'weekly',
        sessions: [GARETH_SESSION_A3, GARETH_SESSION_B3, GARETH_SESSION_C3],
        cardio: [
          { title: 'Steady — 30 min', detail: 'Your pick: incline walk, cross trainer or rower.', logText: 'cross trainer 30 min' },
          { title: 'Intervals — 8 × 1 min hard / 2 min easy', detail: 'Rower or cross trainer.', logText: 'rowing machine 24 min hard' },
          { title: 'Weekend 5 km walk', detail: 'Saturday or Sunday, outdoors, early.', logText: 'walked 5 km', optional: true },
        ],
        restCardio: { title: 'Weekend 5 km walk', detail: 'Outdoors, early, before the heat.', logText: 'walked 5 km', optional: true },
      },
    ],
    testSession: {
      title: 'Test week — see what six months bought',
      exercises: [
        ex('Goblet squat — heaviest clean set of 5', 'legs'),
        ex('Shoulder press — heaviest clean set of 5', 'push'),
        ex('Plank — longest hold', 'core'),
        ex('2,000 m row — fastest time', 'full'),
      ],
    },
    meals: {
      breakfast: [
        { name: 'Four-egg omelette', kcal: 520, protein: 40, desc: '4 eggs, spinach, half an onion, 30 g cheddar, slice of sourdough' },
        { name: 'Yoghurt bowl', kcal: 470, protein: 52, desc: '250 g Greek yoghurt, 30 g whey, 100 g blueberries, honey, 10 g almonds' },
        { name: 'Overnight oats', kcal: 530, protein: 42, desc: '60 g oats, 250 ml milk, 30 g whey, banana, cinnamon' },
        { name: 'Halloumi scramble', kcal: 560, protein: 42, desc: '3 eggs, 80 g grilled halloumi, rocket, one small pitta' },
      ],
      lunch: [
        { name: 'Chicken shawarma wrap', kcal: 620, protein: 55, desc: 'Wholemeal wrap, 180 g chicken thigh, garlic sauce, pickles, cabbage' },
        { name: 'Kofta wrap', kcal: 640, protein: 48, desc: '150 g lean beef kofta, wrap, mint yoghurt, red onion, lettuce' },
        { name: 'Tuna & cottage cheese on rye', kcal: 560, protein: 55, desc: '2 slices rye, tin of tuna, 100 g cottage cheese, cucumber salad' },
        { name: 'Chicken & rice bowl', kcal: 640, protein: 52, desc: '180 g chicken, 150 g rice, cucumber, pickled onion, garlic yoghurt' },
      ],
      dinner: [
        { name: 'Shish taouk plate', kcal: 700, protein: 58, desc: '250 g grilled chicken, 150 g rice, courgette, onion, garlic sauce' },
        { name: 'Salmon & potatoes', kcal: 720, protein: 45, desc: '180 g salmon, 250 g new potatoes, green beans, butter, lemon' },
        { name: 'Tomato-free chilli', kcal: 690, protein: 50, desc: 'Lean beef, peppers, kidney beans, paprika, over 150 g rice' },
        { name: 'Lamb chops', kcal: 740, protein: 48, desc: '3 grilled chops, roasted carrots and broccoli, small pitta' },
        { name: 'Chicken tikka', kcal: 700, protein: 60, desc: '250 g dry tikka, two roti, raita, side salad. Not the creamy curries' },
      ],
      snack: [
        { name: 'Skyr & almonds', kcal: 330, protein: 28, desc: '200 g skyr, 20 g almonds' },
        { name: 'Shake & fruit', kcal: 270, protein: 32, desc: '40 g whey in water, one banana' },
        { name: 'Biltong & apple', kcal: 260, protein: 27, desc: '50 g biltong, one apple' },
        { name: 'Cottage cheese & pineapple', kcal: 250, protein: 26, desc: '200 g cottage cheese, 100 g pineapple' },
        { name: 'Eggs & rice cakes', kcal: 300, protein: 21, desc: '3 boiled eggs, 2 rice cakes, salt' },
      ],
    },
    rules: [
      'Two sessions plus protein is still a passing week. The floor matters more than the ceiling.',
      'Add weight when you hit the top of the rep range on every set. At the 20 kg dumbbell ceiling: more reps, then slower tempo, then single-limb, then the stack machine.',
      'No jogging before week 13 — incline walking carries the cardio until then.',
      'Drinking night goes after the last session of the week, not before a training day.',
      'Weekly weigh-in, same morning. If the four-week average is flat, take 150 kcal off.',
      'No tomato, no mushroom — the meal bank is already built around that.',
    ],
  },

  sixmonthsstronger: {
    id: 'sixmonthsstronger',
    name: 'Six Months Stronger',
    owner: 'Katy',
    weeks: 26,
    gymDays: [0, 2, 4], // Mon / Wed / Fri (0 = Monday)
    deloadWeeks: [8, 16, 24],
    testWeek: 26,
    kcal: 1800,
    macros: { protein: 130, carbs: 185, fat: 60 },
    stepsTarget: 8000,
    stepsNote: 'Background movement — separate from the runs.',
    restNote: 'Rest day. The tape measure and the photos are the metric, not the scale.',
    phases: [
      {
        number: 1, name: 'Learn the movements', weeks: [1, 4],
        focus: 'Technique month: learn to feel your glutes working. Glute bridge before hip thrust, split squats with no weight.',
        scheme: { sets: 3, reps: '10–12', effort: 'Comfortable — stop 4 reps short of struggling', rest: '60–90 s' },
        rotation: 'weekly',
        sessions: [KATY_SESSION_A_LEARN, KATY_SESSION_B, KATY_SESSION_C],
        cardio: [
          null,
          { title: 'Easy run — 20–30 min', detail: 'After the weights. Keep running exactly as you do now.', logText: 'easy run 25 min' },
          null,
        ],
        restCardio: { title: 'Easy run — 30 min', detail: 'Weekend run, conversational pace.', logText: 'easy run 30 min', optional: true, weekend: true },
      },
      {
        number: 2, name: 'Add the weight', weeks: [5, 12],
        focus: 'The phase that changes your shape. Hip thrust replaces the bridge — build to the 20 kg dumbbell for sets of twelve.',
        scheme: { sets: 3, reps: '8–12', effort: 'Last set 2 reps short of failure', rest: '90 s — 2 min after hip thrusts' },
        rotation: 'weekly',
        sessions: [KATY_SESSION_A, KATY_SESSION_B, KATY_SESSION_C],
        cardio: [
          null,
          { title: 'Hills or intervals — 6–8 × 60–90 s uphill', detail: 'After the weights, so it stays 48 h from both leg days.', logText: 'ran 25 min hard' },
          null,
        ],
        restCardio: { title: 'Easy run — 30 min', detail: 'Weekend run. Easy means easy.', logText: 'easy run 30 min', optional: true, weekend: true },
      },
      {
        number: 3, name: 'Build the shape', weeks: [13, 20],
        focus: 'More glute volume, pauses at the hardest point, one hip-thrust set near failure. This is where the visible change happens.',
        scheme: { sets: 4, reps: '8–15', effort: 'Glute work to 1 rep short of failure on the last set', rest: '90 s — 2 min' },
        rotation: 'weekly',
        sessions: [KATY_SESSION_A_BUILD, KATY_SESSION_B, KATY_SESSION_C_LATE],
        cardio: [
          null,
          { title: 'Hills or intervals', detail: 'After the weights. Try 1.5-rep hip thrusts this phase.', logText: 'ran 25 min hard' },
          null,
        ],
        restCardio: { title: 'Easy run — 30 min', detail: 'Weekend run, easy.', logText: 'easy run 30 min', optional: true, weekend: true },
      },
      {
        number: 4, name: 'Own it', weeks: [21, 26],
        focus: 'Same sessions, heavier, one hard back-off set on your best exercise. Keep the ones you actually like forever.',
        scheme: { sets: 4, reps: '6–15', effort: 'Top set 1 rep short of failure, then a back-off set', rest: '2 min on the main lifts' },
        rotation: 'weekly',
        sessions: [KATY_SESSION_A_BUILD, KATY_SESSION_B, KATY_SESSION_C_LATE],
        cardio: [
          null,
          { title: 'Run — whatever you enjoy', detail: 'You have earned the right to just go for a run.', logText: 'ran 30 min' },
          null,
        ],
        restCardio: { title: 'Run — your choice', detail: 'Weekend run if you fancy it.', logText: 'easy run 30 min', optional: true, weekend: true },
      },
    ],
    testSession: {
      title: 'Test week — compare with week one',
      exercises: [
        ex('Hip thrust — heaviest set of 8', 'legs'),
        ex('Bulgarian split squat — deepest set of 10 each side', 'legs'),
        ex('Side plank — longest hold', 'core'),
        ex('Photos — same spot, same light, same clothes', 'full'),
      ],
    },
    meals: {
      breakfast: [
        { name: 'Yoghurt & berries', kcal: 395, protein: 40, desc: '200 g Greek yoghurt, 25 g whey, 100 g berries, 15 g granola' },
        { name: 'Eggs on toast', kcal: 400, protein: 26, desc: '3 scrambled eggs, seeded toast, spinach' },
        { name: 'Protein oats', kcal: 410, protein: 32, desc: '40 g oats, 200 ml milk, 25 g whey, half a banana, cinnamon' },
        { name: 'Cottage cheese bowl', kcal: 390, protein: 30, desc: '200 g cottage cheese, pineapple or peach, 15 g almonds, honey' },
      ],
      lunch: [
        { name: 'Chicken salad bowl', kcal: 500, protein: 45, desc: '150 g grilled chicken, big salad, 80 g quinoa, olive oil and lemon' },
        { name: 'Tuna jacket potato', kcal: 510, protein: 42, desc: 'Jacket potato, tin of tuna, sweetcorn, light mayo, side salad' },
        { name: 'Chicken wrap', kcal: 490, protein: 42, desc: 'Wholemeal wrap, 130 g chicken, salad, tzatziki' },
        { name: 'Prawn & rice bowl', kcal: 480, protein: 38, desc: '150 g prawns, 120 g rice, edamame, cucumber, soy and sesame' },
      ],
      dinner: [
        { name: 'Salmon & vegetables', kcal: 590, protein: 38, desc: '150 g salmon, 200 g new potatoes, tenderstem broccoli, lemon' },
        { name: 'Chicken stir fry', kcal: 610, protein: 48, desc: '180 g chicken, stir-fry veg, 120 g noodles, soy, garlic, ginger' },
        { name: 'Turkey mince bolognese', kcal: 620, protein: 45, desc: '150 g turkey mince, tomato and veg sauce, 70 g pasta, parmesan' },
        { name: 'Steak & salad', kcal: 615, protein: 45, desc: '180 g sirloin, large salad, 150 g sweet potato wedges' },
        { name: 'Chicken curry', kcal: 600, protein: 46, desc: '180 g chicken, tomato-yoghurt sauce, 120 g rice, spinach. Not creamy' },
      ],
      snack: [
        { name: 'Skyr & fruit', kcal: 200, protein: 20, desc: '170 g skyr, one apple' },
        { name: 'Protein shake', kcal: 250, protein: 26, desc: '30 g whey, plus a banana' },
        { name: 'Boiled eggs & oatcakes', kcal: 230, protein: 15, desc: '2 boiled eggs, 2 oatcakes' },
        { name: 'Edamame & cheese', kcal: 220, protein: 18, desc: '100 g edamame, one light cheese portion' },
        { name: 'Cottage cheese & crackers', kcal: 245, protein: 22, desc: '150 g cottage cheese, 3 rye crackers' },
      ],
    },
    rules: [
      'The bum is a building job, not a losing job. Expect the scale to move less than the mirror.',
      'Log weight and reps for every set. Hit the top of the rep range on all sets → next dumbbell up next session.',
      'If you cannot feel a glute exercise in your glutes, drop the weight and slow it down — do not add load.',
      'Two runs a week, one of them hills. More running is the slowest lever you have when the scale stalls.',
      'Weigh weekly, tape and photos monthly. Cycle water swings of 1–2 kg are noise, not fat.',
      'One night out a week sits comfortably inside the numbers. Two days of eating around it does not.',
    ],
  },
}

export const PLAN_LIST = Object.values(PLANS).map((plan) => ({
  id: plan.id,
  name: plan.name,
  owner: plan.owner,
  weeks: plan.weeks,
}))
