/**
 * Resistance exercise reference.
 *
 * These are the lifts the parser recognises when a phrase carries set/rep
 * notation ("bench 3x8 80kg", "squat 5 sets of 5 at 140"). Energy for lifting
 * stays time-based (MET x minutes — per-rep calorie claims are pseudo-science),
 * so what this table adds is identity and grouping: which lift, which movement
 * pattern, so weekly volume can be tracked per group.
 *
 * Row format: [id, name, aliases, group]
 *   group: legs | push | pull | core | full
 */

// prettier-ignore
const ROWS = [
  // -------------------------------------------------------------------- legs
  ['squat', 'Back squat', 'squat|squats|back squat|barbell squat|goblet squat|smith squat|pause squat', 'legs'],
  ['front_squat', 'Front squat', 'front squat|front squats', 'legs'],
  ['hack_squat', 'Hack squat', 'hack squat', 'legs'],
  ['leg_press', 'Leg press', 'leg press', 'legs'],
  ['deadlift', 'Deadlift', 'deadlift|deadlifts|conventional deadlift|sumo deadlift|trap bar deadlift|rack pull', 'full'],
  ['rdl', 'Romanian deadlift', 'rdl|romanian deadlift|romanian deadlifts|stiff leg deadlift', 'legs'],
  ['hip_thrust', 'Hip thrust', 'hip thrust|hip thrusts|glute bridge', 'legs'],
  ['lunge', 'Lunges', 'lunge|lunges|walking lunges|split squat|bulgarian split squat', 'legs'],
  ['leg_extension', 'Leg extension', 'leg extension|leg extensions', 'legs'],
  ['leg_curl', 'Leg curl', 'leg curl|leg curls|hamstring curl|hamstring curls', 'legs'],
  ['calf_raise', 'Calf raises', 'calf raise|calf raises|calves', 'legs'],
  ['good_morning', 'Good mornings', 'good morning|good mornings', 'legs'],

  // -------------------------------------------------------------------- push
  ['bench', 'Bench press', 'bench|bench press|flat bench|barbell bench|close grip bench|decline bench|paused bench', 'push'],
  ['incline_bench', 'Incline bench press', 'incline bench|incline press|incline bench press', 'push'],
  ['db_press', 'Dumbbell press', 'dumbbell press|db press|dumbbell bench|db bench', 'push'],
  ['ohp', 'Overhead press', 'ohp|overhead press|shoulder press|shoulder press machine|military press|strict press|arnold press', 'push'],
  ['dip', 'Dips', 'dip|dips|weighted dips', 'push'],
  ['press_up', 'Press-ups', 'press ups|press up|push ups|push up|pushups', 'push'],
  ['chest_fly', 'Chest fly', 'chest fly|chest flys|chest flyes|pec deck|cable crossover|cable fly', 'push'],
  ['lateral_raise', 'Lateral raises', 'lateral raise|lateral raises|side raises|lat raises', 'push'],
  ['tricep_pushdown', 'Tricep pushdown', 'tricep pushdown|tricep pushdowns|pushdowns|tricep extension|tricep extensions|skull crushers|skullcrushers', 'push'],

  // -------------------------------------------------------------------- pull
  ['row', 'Barbell row', 'row|rows|barbell row|barbell rows|bent over row|bent over rows|pendlay row|t bar row|chest supported row', 'pull'],
  ['db_row', 'Dumbbell row', 'dumbbell row|dumbbell rows|db row|db rows|single arm row', 'pull'],
  ['cable_row', 'Cable row', 'cable row|cable rows|seated row|seated rows|machine row', 'pull'],
  ['lat_pulldown', 'Lat pulldown', 'lat pulldown|lat pulldowns|pulldown|pulldowns', 'pull'],
  ['pull_up', 'Pull-ups', 'pull ups|pull up|pullups|weighted pull ups', 'pull'],
  ['chin_up', 'Chin-ups', 'chin ups|chin up|chinups', 'pull'],
  ['curl', 'Bicep curls', 'curl|curls|bicep curl|bicep curls|hammer curl|hammer curls|ez bar curl|preacher curl', 'pull'],
  ['face_pull', 'Face pulls', 'face pull|face pulls', 'pull'],
  ['shrug', 'Shrugs', 'shrug|shrugs', 'pull'],
  ['rear_delt_fly', 'Rear delt fly', 'rear delt fly|rear delt flys|reverse fly|reverse flyes', 'pull'],

  ['chest_press_machine', 'Chest press (machine)', 'chest press|chest press machine|machine press', 'push'],
  ['hip_abduction', 'Hip abduction/adduction', 'hip abduction|hip adduction|abductor|adductor|abductor machine', 'legs'],
  ['back_extension', 'Back extension', 'back extension|back extensions|hyperextension|hyperextensions|45 degree back extension', 'pull'],
  ['step_up', 'Step-ups', 'step ups|step up|weighted step ups', 'legs'],
  ['box_jump', 'Box jumps', 'box jumps|box jump', 'legs'],
  ['burpee', 'Burpees', 'burpees|burpee', 'full'],
  ['pullover', 'Dumbbell pullover', 'pullover|pullovers|db pullover|dumbbell pullover', 'pull'],
  ['landmine_press', 'Landmine press', 'landmine press|landmine', 'push'],
  ['upright_row', 'Upright row', 'upright row|upright rows', 'pull'],
  ['glute_kickback', 'Glute kickback', 'glute kickback|glute kickbacks|cable kickback|donkey kicks', 'legs'],

  // -------------------------------------------------------------------- core
  ['plank', 'Plank', 'plank|planks', 'core'],
  ['crunch', 'Crunches', 'crunch|crunches|sit ups|sit up|situps', 'core'],
  ['leg_raise', 'Leg raises', 'leg raise|leg raises|hanging leg raise|hanging leg raises', 'core'],
  ['ab_rollout', 'Ab rollout', 'ab rollout|ab rollouts|ab wheel', 'core'],
  ['russian_twist', 'Russian twists', 'russian twist|russian twists', 'core'],
  ['cable_crunch', 'Cable crunch', 'cable crunch|cable crunches', 'core'],

  // -------------------------------------------------------------------- full
  ['clean', 'Power clean', 'clean|power clean|cleans|hang clean', 'full'],
  ['snatch', 'Snatch', 'snatch|snatches|power snatch', 'full'],
  ['thruster', 'Thrusters', 'thruster|thrusters', 'full'],
  ['farmer_carry', 'Farmer carries', 'farmer carry|farmer carries|farmers walk|farmers carry|loaded carry', 'full'],
  ['sled', 'Sled push/pull', 'sled|sled push|sled pull|prowler', 'full'],
]

/** @typedef {{id:string,name:string,aliases:string[],group:string}} Exercise */

/** @type {Exercise[]} */
export const EXERCISES = ROWS.map(([id, name, aliases, group]) => ({
  id,
  name,
  aliases: String(aliases).split('|').filter(Boolean),
  group,
}))

export const EXERCISES_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

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
