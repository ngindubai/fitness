/**
 * Resistance exercise reference.
 *
 * These are the lifts the parser recognises when a phrase carries set/rep
 * notation ("bench 3x8 80kg", "squat 5 sets of 5 at 140"), and the menu the
 * exercise picker offers. Energy for lifting stays time-based (MET x minutes
 * — per-rep calorie claims are pseudo-science), so what this table adds is
 * identity, grouping, and now anatomy: which muscles each lift loads, so the
 * heat map can show what got trained and what got skipped.
 *
 * Row format: [id, name, aliases, group, muscles]
 *   group:   legs | push | pull | core | full
 *   muscles: 'muscle:tier ...' where the tier weights follow the standard
 *            practitioner convention for counting training volume:
 *              1    — primary mover (a set counts fully for this muscle)
 *              0.5  — secondary / synergist (counts half)
 *              0.25 — tertiary / stabiliser (counts a quarter)
 *            EMG research supports counting synergist work fractionally,
 *            but exact ratios are not settled science (Baz-Valle 2019,
 *            PMC6681288 recommends practitioner judgement) — so these are
 *            the accepted halving convention, applied consistently, and
 *            they exist to compare weeks, not to measure physiology.
 */

// prettier-ignore
const ROWS = [
  // ------------------------------------------------------------ legs: squat
  ['squat', 'Back squat', 'squat|squats|back squat|barbell squat|smith squat|pause squat|high bar squat|low bar squat', 'legs', 'quads:1 glutes:1 hamstrings:0.5 lower_back:0.5 abs:0.25'],
  ['front_squat', 'Front squat', 'front squat|front squats|zercher squat', 'legs', 'quads:1 glutes:0.5 abs:0.5 lower_back:0.25'],
  ['goblet_squat', 'Goblet squat', 'goblet squat|goblet squats', 'legs', 'quads:1 glutes:0.5 abs:0.5 forearms:0.25'],
  ['hack_squat', 'Hack squat', 'hack squat|hack squats', 'legs', 'quads:1 glutes:0.5'],
  ['leg_press', 'Leg press', 'leg press|leg press machine|single leg press', 'legs', 'quads:1 glutes:0.5 hamstrings:0.25'],
  ['pistol_squat', 'Pistol squat', 'pistol squat|pistol squats|single leg squat', 'legs', 'quads:1 glutes:1 abs:0.5'],
  ['sumo_squat', 'Sumo squat', 'sumo squat|sumo squats|plie squat', 'legs', 'adductors:0.5 glutes:1 quads:0.5'],
  ['sissy_squat', 'Sissy squat', 'sissy squat|sissy squats', 'legs', 'quads:1'],
  ['wall_sit', 'Wall sit', 'wall sit|wall sits', 'legs', 'quads:1 glutes:0.25'],

  // ------------------------------------------------------------ legs: hinge
  ['deadlift', 'Deadlift', 'deadlift|deadlifts|conventional deadlift|sumo deadlift|trap bar deadlift|rack pull', 'full', 'glutes:1 hamstrings:1 lower_back:1 quads:0.5 traps:0.5 forearms:0.5 lats:0.5'],
  ['rdl', 'Romanian deadlift', 'rdl|romanian deadlift|romanian deadlifts|stiff leg deadlift|dumbbell romanian deadlift', 'legs', 'hamstrings:1 glutes:1 lower_back:0.5 forearms:0.25'],
  ['single_leg_rdl', 'Single-leg RDL', 'single leg rdl|single leg romanian deadlift|one leg rdl', 'legs', 'hamstrings:1 glutes:1 lower_back:0.25 abs:0.25'],
  ['good_morning', 'Good mornings', 'good morning|good mornings', 'legs', 'hamstrings:1 glutes:0.5 lower_back:0.5'],
  ['hip_thrust', 'Hip thrust', 'hip thrust|hip thrusts|barbell hip thrust', 'legs', 'glutes:1 hamstrings:0.5'],
  ['glute_bridge', 'Glute bridge', 'glute bridge|glute bridges', 'legs', 'glutes:1 hamstrings:0.25'],
  ['back_extension', 'Back extension', 'back extension|back extensions|hyperextension|hyperextensions|45 degree back extension', 'pull', 'lower_back:1 glutes:0.5 hamstrings:0.5'],
  ['kettlebell_swing', 'Kettlebell swing', 'kettlebell swing|kettlebell swings|kb swing|kb swings', 'full', 'glutes:1 hamstrings:1 lower_back:0.5 abs:0.25 forearms:0.25'],

  // ----------------------------------------------------------- legs: single
  ['lunge', 'Lunges', 'lunge|lunges|walking lunges|forward lunge', 'legs', 'quads:1 glutes:1 hamstrings:0.25'],
  ['reverse_lunge', 'Reverse lunge', 'reverse lunge|reverse lunges', 'legs', 'glutes:1 quads:1 hamstrings:0.25'],
  ['split_squat', 'Split squat', 'split squat|split squats', 'legs', 'quads:1 glutes:1'],
  ['bulgarian_split_squat', 'Bulgarian split squat', 'bulgarian split squat|bulgarian split squats|bulgarians|rear foot elevated split squat', 'legs', 'glutes:1 quads:1 hamstrings:0.25'],
  ['step_up', 'Step-ups', 'step ups|step up|weighted step ups', 'legs', 'glutes:1 quads:1'],
  ['lateral_lunge', 'Lateral lunge', 'lateral lunge|side lunge|lateral lunges|cossack squat', 'legs', 'glutes:1 quads:1 adductors:0.5'],
  ['curtsy_lunge', 'Curtsy lunge', 'curtsy lunge|curtsy lunges', 'legs', 'glutes:1 quads:0.5'],

  // --------------------------------------------------------- legs: machines
  ['leg_extension', 'Leg extension', 'leg extension|leg extensions|quad extension', 'legs', 'quads:1'],
  ['leg_curl', 'Leg curl', 'leg curl|leg curls|hamstring curl|hamstring curls|lying leg curl|seated leg curl|nordic curl', 'legs', 'hamstrings:1'],
  ['calf_raise', 'Calf raises', 'calf raise|calf raises|calves|standing calf raise|seated calf raise|donkey calf raise', 'legs', 'calves:1'],
  ['hip_abduction', 'Hip abduction', 'hip abduction|abductor|abductor machine|lateral band walk|band walk|clamshells', 'legs', 'glutes:1'],
  ['hip_adduction', 'Hip adduction', 'hip adduction|adductor|adductor machine', 'legs', 'adductors:1'],
  ['glute_kickback', 'Glute kickback', 'glute kickback|glute kickbacks|cable kickback|donkey kicks', 'legs', 'glutes:1'],

  // ------------------------------------------------------- push: horizontal
  ['bench', 'Bench press', 'bench|bench press|flat bench|barbell bench|paused bench', 'push', 'chest:1 triceps:0.5 front_delts:0.5'],
  ['close_grip_bench', 'Close-grip bench', 'close grip bench|close grip bench press|cgbp', 'push', 'triceps:1 chest:0.5 front_delts:0.5'],
  ['incline_bench', 'Incline bench press', 'incline bench|incline press|incline bench press|incline barbell', 'push', 'chest:1 front_delts:0.5 triceps:0.5'],
  ['decline_bench', 'Decline bench press', 'decline bench|decline press', 'push', 'chest:1 triceps:0.5'],
  ['db_press', 'Dumbbell bench press', 'dumbbell press|db press|dumbbell bench|db bench|dumbbell bench press', 'push', 'chest:1 triceps:0.5 front_delts:0.5'],
  ['incline_db_press', 'Incline dumbbell press', 'incline dumbbell press|incline db press|incline dumbbell bench', 'push', 'chest:1 front_delts:0.5 triceps:0.5'],
  ['chest_press_machine', 'Chest press (machine)', 'chest press|chest press machine|machine press|seated chest press', 'push', 'chest:1 triceps:0.5 front_delts:0.5'],
  ['press_up', 'Press-ups', 'press ups|press up|push ups|push up|pushups|pushup|diamond push ups|incline push ups|decline push ups', 'push', 'chest:1 triceps:0.5 front_delts:0.5 abs:0.25'],
  ['chest_fly', 'Chest fly', 'chest fly|chest flys|chest flyes|pec deck|cable crossover|cable fly|dumbbell fly|db fly', 'push', 'chest:1 front_delts:0.25'],
  ['dip', 'Dips', 'dip|dips|weighted dips|chest dips|bench dips', 'push', 'chest:1 triceps:1 front_delts:0.5'],
  ['svend_press', 'Svend press', 'svend press|plate press|plate squeeze press', 'push', 'chest:1 triceps:0.25'],

  // --------------------------------------------------------- push: vertical
  ['ohp', 'Overhead press', 'ohp|overhead press|shoulder press|military press|strict press|barbell shoulder press', 'push', 'front_delts:1 side_delts:0.5 triceps:0.5 traps:0.25 abs:0.25'],
  ['db_shoulder_press', 'Dumbbell shoulder press', 'dumbbell shoulder press|db shoulder press|seated dumbbell shoulder press|seated shoulder press|shoulder press machine', 'push', 'front_delts:1 side_delts:0.5 triceps:0.5'],
  ['arnold_press', 'Arnold press', 'arnold press|arnold presses', 'push', 'front_delts:1 side_delts:0.5 triceps:0.5'],
  ['push_press', 'Push press', 'push press|push presses', 'full', 'front_delts:1 triceps:0.5 quads:0.5 glutes:0.25'],
  ['landmine_press', 'Landmine press', 'landmine press|landmine', 'push', 'front_delts:1 chest:0.5 triceps:0.5 abs:0.25'],
  ['pike_pushup', 'Pike push-ups', 'pike push ups|pike push up|pike pushups|handstand push ups', 'push', 'front_delts:1 side_delts:0.5 triceps:0.5'],

  // -------------------------------------------------------- push: shoulders
  ['lateral_raise', 'Lateral raises', 'lateral raise|lateral raises|side raises|lat raises|cable lateral raise', 'push', 'side_delts:1 traps:0.25'],
  ['front_raise', 'Front raises', 'front raise|front raises|plate raise', 'push', 'front_delts:1'],
  ['upright_row', 'Upright row', 'upright row|upright rows', 'pull', 'side_delts:1 traps:0.5 biceps:0.25'],

  // ---------------------------------------------------------- push: triceps
  ['tricep_pushdown', 'Tricep pushdown', 'tricep pushdown|tricep pushdowns|pushdowns|rope pushdown|cable pushdown', 'push', 'triceps:1'],
  ['tricep_extension', 'Tricep extension', 'tricep extension|tricep extensions|overhead tricep extension|overhead extension|french press', 'push', 'triceps:1'],
  ['skull_crusher', 'Skull crushers', 'skull crushers|skullcrushers|skull crusher|lying tricep extension', 'push', 'triceps:1'],
  ['tricep_kickback', 'Tricep kickback', 'tricep kickback|tricep kickbacks|kickbacks', 'push', 'triceps:1'],

  // ------------------------------------------------------- pull: horizontal
  ['row', 'Barbell row', 'row|rows|barbell row|barbell rows|bent over row|bent over rows|pendlay row|yates row', 'pull', 'lats:1 mid_back:1 rear_delts:0.5 biceps:0.5 lower_back:0.5 forearms:0.25'],
  ['db_row', 'Dumbbell row', 'dumbbell row|dumbbell rows|db row|db rows|single arm row|one arm row|one arm dumbbell row|kroc row', 'pull', 'lats:1 mid_back:1 rear_delts:0.5 biceps:0.5 forearms:0.25'],
  ['cable_row', 'Seated cable row', 'cable row|cable rows|seated row|seated rows|machine row|low row', 'pull', 'mid_back:1 lats:1 rear_delts:0.5 biceps:0.5'],
  ['t_bar_row', 'T-bar row', 't bar row|t-bar row|tbar row|chest supported row|seal row', 'pull', 'mid_back:1 lats:1 rear_delts:0.5 biceps:0.5'],
  ['inverted_row', 'Inverted row', 'inverted row|inverted rows|australian pull ups|bodyweight row', 'pull', 'mid_back:1 lats:1 biceps:0.5 abs:0.25'],
  ['meadows_row', 'Meadows row', 'meadows row|landmine row', 'pull', 'lats:1 mid_back:1 rear_delts:0.5 biceps:0.5'],

  // --------------------------------------------------------- pull: vertical
  ['lat_pulldown', 'Lat pulldown', 'lat pulldown|lat pulldowns|pulldown|pulldowns|wide grip pulldown|close grip pulldown', 'pull', 'lats:1 biceps:0.5 mid_back:0.5 rear_delts:0.25'],
  ['pull_up', 'Pull-ups', 'pull ups|pull up|pullups|weighted pull ups|wide grip pull ups', 'pull', 'lats:1 biceps:0.5 mid_back:0.5 forearms:0.5 abs:0.25'],
  ['chin_up', 'Chin-ups', 'chin ups|chin up|chinups|weighted chin ups', 'pull', 'lats:1 biceps:1 mid_back:0.5 forearms:0.5'],
  ['straight_arm_pulldown', 'Straight-arm pulldown', 'straight arm pulldown|straight arm pulldowns|lat prayer', 'pull', 'lats:1 triceps:0.25'],
  ['pullover', 'Dumbbell pullover', 'pullover|pullovers|db pullover|dumbbell pullover|cable pullover', 'pull', 'lats:1 chest:0.5 triceps:0.25'],

  // -------------------------------------------------- pull: rear delt, traps
  ['face_pull', 'Face pulls', 'face pull|face pulls', 'pull', 'rear_delts:1 mid_back:0.5 traps:0.5'],
  ['rear_delt_fly', 'Rear delt fly', 'rear delt fly|rear delt flys|reverse fly|reverse flyes|reverse pec deck', 'pull', 'rear_delts:1 mid_back:0.5'],
  ['shrug', 'Shrugs', 'shrug|shrugs|barbell shrug|dumbbell shrug|trap bar shrug', 'pull', 'traps:1 forearms:0.25'],

  // ------------------------------------------------------------ pull: biceps
  ['curl', 'Bicep curls', 'curl|curls|bicep curl|bicep curls|dumbbell curl|barbell curl|ez bar curl|cable curl', 'pull', 'biceps:1 forearms:0.5'],
  ['hammer_curl', 'Hammer curls', 'hammer curl|hammer curls|rope hammer curl', 'pull', 'biceps:1 forearms:0.5'],
  ['preacher_curl', 'Preacher curls', 'preacher curl|preacher curls|spider curl|concentration curl', 'pull', 'biceps:1'],
  ['incline_curl', 'Incline curls', 'incline curl|incline curls|incline dumbbell curl', 'pull', 'biceps:1'],
  ['reverse_curl', 'Reverse curls', 'reverse curl|reverse curls', 'pull', 'forearms:1 biceps:0.5'],
  ['wrist_curl', 'Wrist curls', 'wrist curl|wrist curls|forearm curls|grip work|dead hang|dead hangs', 'pull', 'forearms:1'],

  // -------------------------------------------------------------------- core
  ['plank', 'Plank', 'plank|planks|weighted plank', 'core', 'abs:1 obliques:0.5 glutes:0.25'],
  ['side_plank', 'Side plank', 'side plank|side planks', 'core', 'obliques:1 abs:0.5'],
  ['crunch', 'Crunches', 'crunch|crunches|sit ups|sit up|situps|weighted crunch|decline sit ups', 'core', 'abs:1'],
  ['cable_crunch', 'Cable crunch', 'cable crunch|cable crunches|kneeling cable crunch', 'core', 'abs:1'],
  ['leg_raise', 'Leg raises', 'leg raise|leg raises|hanging leg raise|hanging leg raises|hanging knee raise|lying leg raises', 'core', 'abs:1 obliques:0.25'],
  ['ab_rollout', 'Ab rollout', 'ab rollout|ab rollouts|ab wheel', 'core', 'abs:1 lats:0.25 obliques:0.25'],
  ['russian_twist', 'Russian twists', 'russian twist|russian twists', 'core', 'obliques:1 abs:0.5'],
  ['dead_bug', 'Dead bug', 'dead bug|dead bugs|deadbug', 'core', 'abs:1 obliques:0.25'],
  ['bird_dog', 'Bird dog', 'bird dog|bird dogs', 'core', 'lower_back:1 abs:0.5 glutes:0.5'],
  ['pallof_press', 'Pallof press', 'pallof press|pallof', 'core', 'obliques:1 abs:0.5'],
  ['woodchop', 'Cable woodchop', 'woodchop|woodchops|cable chop|wood chop', 'core', 'obliques:1 abs:0.5'],
  ['mountain_climber', 'Mountain climbers', 'mountain climbers|mountain climber', 'core', 'abs:1 obliques:0.5 quads:0.5 front_delts:0.25'],
  ['hollow_hold', 'Hollow hold', 'hollow hold|hollow holds|hollow body', 'core', 'abs:1'],
  ['superman', 'Superman hold', 'superman|supermans|superman hold', 'core', 'lower_back:1 glutes:0.5'],

  // -------------------------------------------------------------------- full
  ['clean', 'Power clean', 'clean|power clean|cleans|hang clean', 'full', 'glutes:1 hamstrings:0.5 quads:0.5 traps:0.5 lower_back:0.5 forearms:0.5'],
  ['snatch', 'Snatch', 'snatch|snatches|power snatch', 'full', 'glutes:1 hamstrings:0.5 quads:0.5 traps:0.5 side_delts:0.5 lower_back:0.5'],
  ['thruster', 'Thrusters', 'thruster|thrusters', 'full', 'quads:1 glutes:1 front_delts:1 triceps:0.5'],
  ['burpee', 'Burpees', 'burpees|burpee', 'full', 'quads:1 chest:0.5 abs:0.5 glutes:0.5 triceps:0.5'],
  ['box_jump', 'Box jumps', 'box jumps|box jump', 'legs', 'quads:1 glutes:1 calves:0.5'],
  ['farmer_carry', 'Farmer carries', 'farmer carry|farmer carries|farmers walk|farmers carry|loaded carry|suitcase carry', 'full', 'forearms:1 traps:1 abs:0.5 obliques:0.5'],
  ['sled', 'Sled push/pull', 'sled|sled push|sled pull|prowler', 'full', 'quads:1 glutes:1 calves:0.5 abs:0.25'],
  ['battle_ropes', 'Battle ropes', 'battle ropes|battle rope', 'full', 'front_delts:1 side_delts:0.5 abs:0.5 forearms:0.5'],
  ['wall_ball', 'Wall balls', 'wall ball|wall balls', 'full', 'quads:1 glutes:0.5 front_delts:0.5'],
  ['turkish_getup', 'Turkish get-up', 'turkish get up|turkish getup|tgu', 'full', 'abs:1 obliques:0.5 front_delts:0.5 glutes:0.5'],
  ['med_ball_slam', 'Medicine ball slams', 'ball slams|med ball slams|medicine ball slams|slam ball', 'full', 'abs:1 lats:0.5 front_delts:0.5'],
  ['reverse_hyper', 'Reverse hyperextension', 'reverse hyper|reverse hyperextension|reverse hypers', 'legs', 'glutes:1 hamstrings:0.5 lower_back:0.5'],
  ['copenhagen_plank', 'Copenhagen plank', 'copenhagen plank|copenhagen planks', 'core', 'adductors:1 obliques:0.5'],
  ['jump_squat', 'Jump squats', 'jump squat|jump squats|squat jumps', 'legs', 'quads:1 glutes:1 calves:0.5'],
]

/** @typedef {{id:string,name:string,aliases:string[],group:string,muscles:Record<string,number>,met:number}} Exercise */

/**
 * Energy cost per exercise, in METs, from the 2011 Compendium of Physical
 * Activities (Ainsworth et al., MSSE 43(8) — official supplementary table).
 * The compendium prices lifting by class, not by named lift, so every
 * exercise here is assigned its class value:
 *
 *   8.0  code 02020/02040 — vigorous calisthenics & kettlebell/ballistic
 *        conditioning (burpees, swings, jumps, slams, ropes)
 *   6.0  code 02050 — vigorous free-weight lifting, power lifting style
 *        (heavy ground-based barbell compounds, loaded carries, sled)
 *   5.0  code 02052 — resistance training, squats, slow or explosive effort
 *        (all other multi-joint compound lifts)
 *   3.8  code 02022 — moderate calisthenics (push-ups, pull-ups, dips)
 *   3.5  code 02054 — resistance training, multiple exercises, 8–15 reps
 *        (single-joint isolation and machine pump work)
 *   2.8  code 02024 — light calisthenics (floor core work, holds)
 *
 * Energy still = MET × time (≈3 min a set including rest), never per-rep —
 * the calorie difference between lifts is the muscle mass moved, which is
 * exactly what these classes encode.
 */
const MET_CLASSES = {
  8.0: ['kettlebell_swing', 'burpee', 'box_jump', 'jump_squat', 'mountain_climber',
    'battle_ropes', 'wall_ball', 'med_ball_slam'],
  6.0: ['squat', 'front_squat', 'deadlift', 'clean', 'snatch', 'thruster', 'push_press',
    'sled', 'farmer_carry'],
  5.0: ['goblet_squat', 'hack_squat', 'leg_press', 'pistol_squat', 'sumo_squat',
    'rdl', 'single_leg_rdl', 'good_morning', 'hip_thrust',
    'lunge', 'reverse_lunge', 'split_squat', 'bulgarian_split_squat', 'step_up',
    'lateral_lunge', 'curtsy_lunge',
    'bench', 'close_grip_bench', 'incline_bench', 'decline_bench', 'db_press',
    'incline_db_press', 'chest_press_machine',
    'ohp', 'db_shoulder_press', 'arnold_press', 'landmine_press',
    'row', 'db_row', 'cable_row', 't_bar_row', 'meadows_row', 'lat_pulldown',
    'turkish_getup'],
  3.8: ['press_up', 'dip', 'pike_pushup', 'inverted_row', 'pull_up', 'chin_up', 'ab_rollout'],
  3.5: ['sissy_squat', 'wall_sit', 'glute_bridge', 'back_extension',
    'leg_extension', 'leg_curl', 'calf_raise', 'hip_abduction', 'hip_adduction',
    'glute_kickback', 'chest_fly', 'svend_press', 'lateral_raise', 'front_raise',
    'upright_row', 'tricep_pushdown', 'tricep_extension', 'skull_crusher',
    'tricep_kickback', 'straight_arm_pulldown', 'pullover', 'face_pull',
    'rear_delt_fly', 'shrug', 'curl', 'hammer_curl', 'preacher_curl',
    'incline_curl', 'reverse_curl', 'wrist_curl', 'reverse_hyper',
    'cable_crunch', 'woodchop', 'russian_twist', 'leg_raise', 'pallof_press'],
  2.8: ['plank', 'side_plank', 'crunch', 'dead_bug', 'bird_dog', 'hollow_hold',
    'superman', 'copenhagen_plank'],
}

const MET_BY_ID = new Map()
for (const [met, ids] of Object.entries(MET_CLASSES)) {
  for (const id of ids) MET_BY_ID.set(id, Number(met))
}

function parseMuscles(spec) {
  const out = {}
  for (const part of String(spec || '').split(/\s+/).filter(Boolean)) {
    const [muscle, share] = part.split(':')
    out[muscle] = Number(share) || 1
  }
  return out
}

/** @type {Exercise[]} */
export const EXERCISES = ROWS.map(([id, name, aliases, group, muscles]) => ({
  id,
  name,
  aliases: String(aliases).split('|').filter(Boolean),
  group,
  muscles: parseMuscles(muscles),
  // Unlisted ids default to the compendium's general lifting class (02054);
  // a test asserts the map actually covers everything so this never hides.
  met: MET_BY_ID.get(id) ?? 3.5,
}))

export const EXERCISES_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

/** The 1st / 2nd / 3rd muscle groups of an exercise, by tier weight. */
export function muscleTiers(exercise) {
  const tiers = { primary: [], secondary: [], tertiary: [] }
  for (const [muscle, share] of Object.entries(exercise.muscles)) {
    if (share === 1) tiers.primary.push(muscle)
    else if (share === 0.5) tiers.secondary.push(muscle)
    else tiers.tertiary.push(muscle)
  }
  return tiers
}

/** Longest alias first so "incline bench" wins over "bench". */
export const EXERCISE_ALIAS_INDEX = (() => {
  const entries = []
  for (const exercise of EXERCISES) {
    const terms = new Set([exercise.name.toLowerCase(), ...exercise.aliases.map((a) => a.toLowerCase())])
    for (const term of terms) entries.push({ term, exercise })
  }
  entries.sort((a, b) => b.term.length - a.term.length)
  return entries
})()

export const MUSCLE_GROUPS = ['legs', 'push', 'pull', 'core', 'full']

/**
 * The exercise a free-text name refers to, or null. Used by the plan engine
 * and recommenders, which know names ("Goblet squat") rather than ids.
 */
export function exerciseByName(name) {
  const lower = String(name || '').toLowerCase()
  if (!lower) return null
  for (const { term, exercise } of EXERCISE_ALIAS_INDEX) {
    if (lower.includes(term)) return exercise
  }
  return null
}
