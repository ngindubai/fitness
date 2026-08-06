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
 *   muscles: 'muscle:share ...' — share 1 for prime movers, 0.3–0.7 for
 *            assisting muscles. Shares are standard anatomy, not lab data;
 *            they are for comparing weeks, not for surgery.
 */

// prettier-ignore
const ROWS = [
  // ------------------------------------------------------------ legs: squat
  ['squat', 'Back squat', 'squat|squats|back squat|barbell squat|smith squat|pause squat|high bar squat|low bar squat', 'legs', 'quads:1 glutes:0.8 hamstrings:0.4 lower_back:0.4 abs:0.3'],
  ['front_squat', 'Front squat', 'front squat|front squats|zercher squat', 'legs', 'quads:1 glutes:0.6 abs:0.5 lower_back:0.3'],
  ['goblet_squat', 'Goblet squat', 'goblet squat|goblet squats', 'legs', 'quads:1 glutes:0.7 abs:0.4 forearms:0.2'],
  ['hack_squat', 'Hack squat', 'hack squat|hack squats', 'legs', 'quads:1 glutes:0.5'],
  ['leg_press', 'Leg press', 'leg press|leg press machine|single leg press', 'legs', 'quads:1 glutes:0.6 hamstrings:0.3'],
  ['pistol_squat', 'Pistol squat', 'pistol squat|pistol squats|single leg squat', 'legs', 'quads:1 glutes:0.8 abs:0.4'],
  ['sumo_squat', 'Sumo squat', 'sumo squat|sumo squats|plie squat', 'legs', 'adductors:0.7 glutes:1 quads:0.7'],
  ['sissy_squat', 'Sissy squat', 'sissy squat|sissy squats', 'legs', 'quads:1'],
  ['wall_sit', 'Wall sit', 'wall sit|wall sits', 'legs', 'quads:1 glutes:0.3'],

  // ------------------------------------------------------------ legs: hinge
  ['deadlift', 'Deadlift', 'deadlift|deadlifts|conventional deadlift|sumo deadlift|trap bar deadlift|rack pull', 'full', 'glutes:1 hamstrings:0.9 lower_back:0.8 quads:0.5 traps:0.5 forearms:0.5 lats:0.4'],
  ['rdl', 'Romanian deadlift', 'rdl|romanian deadlift|romanian deadlifts|stiff leg deadlift|dumbbell romanian deadlift', 'legs', 'hamstrings:1 glutes:0.9 lower_back:0.5 forearms:0.3'],
  ['single_leg_rdl', 'Single-leg RDL', 'single leg rdl|single leg romanian deadlift|one leg rdl', 'legs', 'hamstrings:1 glutes:1 lower_back:0.3 abs:0.3'],
  ['good_morning', 'Good mornings', 'good morning|good mornings', 'legs', 'hamstrings:1 glutes:0.7 lower_back:0.7'],
  ['hip_thrust', 'Hip thrust', 'hip thrust|hip thrusts|barbell hip thrust', 'legs', 'glutes:1 hamstrings:0.4'],
  ['glute_bridge', 'Glute bridge', 'glute bridge|glute bridges', 'legs', 'glutes:1 hamstrings:0.3'],
  ['back_extension', 'Back extension', 'back extension|back extensions|hyperextension|hyperextensions|45 degree back extension', 'pull', 'lower_back:1 glutes:0.7 hamstrings:0.6'],
  ['kettlebell_swing', 'Kettlebell swing', 'kettlebell swing|kettlebell swings|kb swing|kb swings', 'full', 'glutes:1 hamstrings:0.8 lower_back:0.5 abs:0.3 forearms:0.3'],

  // ----------------------------------------------------------- legs: single
  ['lunge', 'Lunges', 'lunge|lunges|walking lunges|forward lunge', 'legs', 'quads:1 glutes:0.8 hamstrings:0.3'],
  ['reverse_lunge', 'Reverse lunge', 'reverse lunge|reverse lunges', 'legs', 'glutes:1 quads:0.8 hamstrings:0.3'],
  ['split_squat', 'Split squat', 'split squat|split squats', 'legs', 'quads:1 glutes:0.8'],
  ['bulgarian_split_squat', 'Bulgarian split squat', 'bulgarian split squat|bulgarian split squats|bulgarians|rear foot elevated split squat', 'legs', 'glutes:1 quads:0.9 hamstrings:0.3'],
  ['step_up', 'Step-ups', 'step ups|step up|weighted step ups', 'legs', 'glutes:1 quads:0.8'],
  ['lateral_lunge', 'Lateral lunge', 'lateral lunge|side lunge|lateral lunges|cossack squat', 'legs', 'glutes:1 quads:0.8 adductors:0.6'],
  ['curtsy_lunge', 'Curtsy lunge', 'curtsy lunge|curtsy lunges', 'legs', 'glutes:1 quads:0.6'],

  // --------------------------------------------------------- legs: machines
  ['leg_extension', 'Leg extension', 'leg extension|leg extensions|quad extension', 'legs', 'quads:1'],
  ['leg_curl', 'Leg curl', 'leg curl|leg curls|hamstring curl|hamstring curls|lying leg curl|seated leg curl|nordic curl', 'legs', 'hamstrings:1'],
  ['calf_raise', 'Calf raises', 'calf raise|calf raises|calves|standing calf raise|seated calf raise|donkey calf raise', 'legs', 'calves:1'],
  ['hip_abduction', 'Hip abduction', 'hip abduction|abductor|abductor machine|lateral band walk|band walk|clamshells', 'legs', 'glutes:1'],
  ['hip_adduction', 'Hip adduction', 'hip adduction|adductor|adductor machine', 'legs', 'adductors:1'],
  ['glute_kickback', 'Glute kickback', 'glute kickback|glute kickbacks|cable kickback|donkey kicks', 'legs', 'glutes:1'],

  // ------------------------------------------------------- push: horizontal
  ['bench', 'Bench press', 'bench|bench press|flat bench|barbell bench|paused bench', 'push', 'chest:1 triceps:0.6 front_delts:0.5'],
  ['close_grip_bench', 'Close-grip bench', 'close grip bench|close grip bench press|cgbp', 'push', 'triceps:1 chest:0.6 front_delts:0.4'],
  ['incline_bench', 'Incline bench press', 'incline bench|incline press|incline bench press|incline barbell', 'push', 'chest:1 front_delts:0.7 triceps:0.5'],
  ['decline_bench', 'Decline bench press', 'decline bench|decline press', 'push', 'chest:1 triceps:0.5'],
  ['db_press', 'Dumbbell bench press', 'dumbbell press|db press|dumbbell bench|db bench|dumbbell bench press', 'push', 'chest:1 triceps:0.6 front_delts:0.5'],
  ['incline_db_press', 'Incline dumbbell press', 'incline dumbbell press|incline db press|incline dumbbell bench', 'push', 'chest:1 front_delts:0.7 triceps:0.5'],
  ['chest_press_machine', 'Chest press (machine)', 'chest press|chest press machine|machine press|seated chest press', 'push', 'chest:1 triceps:0.5 front_delts:0.4'],
  ['press_up', 'Press-ups', 'press ups|press up|push ups|push up|pushups|pushup|diamond push ups|incline push ups|decline push ups', 'push', 'chest:1 triceps:0.6 front_delts:0.5 abs:0.3'],
  ['chest_fly', 'Chest fly', 'chest fly|chest flys|chest flyes|pec deck|cable crossover|cable fly|dumbbell fly|db fly', 'push', 'chest:1 front_delts:0.3'],
  ['dip', 'Dips', 'dip|dips|weighted dips|chest dips|bench dips', 'push', 'chest:0.8 triceps:1 front_delts:0.4'],
  ['svend_press', 'Svend press', 'svend press|plate press|plate squeeze press', 'push', 'chest:1 triceps:0.3'],

  // --------------------------------------------------------- push: vertical
  ['ohp', 'Overhead press', 'ohp|overhead press|shoulder press|military press|strict press|barbell shoulder press', 'push', 'front_delts:1 side_delts:0.6 triceps:0.6 traps:0.3 abs:0.3'],
  ['db_shoulder_press', 'Dumbbell shoulder press', 'dumbbell shoulder press|db shoulder press|seated dumbbell shoulder press|seated shoulder press|shoulder press machine', 'push', 'front_delts:1 side_delts:0.6 triceps:0.5'],
  ['arnold_press', 'Arnold press', 'arnold press|arnold presses', 'push', 'front_delts:1 side_delts:0.7 triceps:0.4'],
  ['push_press', 'Push press', 'push press|push presses', 'full', 'front_delts:1 triceps:0.6 quads:0.4 glutes:0.3'],
  ['landmine_press', 'Landmine press', 'landmine press|landmine', 'push', 'front_delts:1 chest:0.5 triceps:0.5 abs:0.3'],
  ['pike_pushup', 'Pike push-ups', 'pike push ups|pike push up|pike pushups|handstand push ups', 'push', 'front_delts:1 side_delts:0.5 triceps:0.7'],

  // -------------------------------------------------------- push: shoulders
  ['lateral_raise', 'Lateral raises', 'lateral raise|lateral raises|side raises|lat raises|cable lateral raise', 'push', 'side_delts:1 traps:0.2'],
  ['front_raise', 'Front raises', 'front raise|front raises|plate raise', 'push', 'front_delts:1'],
  ['upright_row', 'Upright row', 'upright row|upright rows', 'pull', 'side_delts:1 traps:0.7 biceps:0.3'],

  // ---------------------------------------------------------- push: triceps
  ['tricep_pushdown', 'Tricep pushdown', 'tricep pushdown|tricep pushdowns|pushdowns|rope pushdown|cable pushdown', 'push', 'triceps:1'],
  ['tricep_extension', 'Tricep extension', 'tricep extension|tricep extensions|overhead tricep extension|overhead extension|french press', 'push', 'triceps:1'],
  ['skull_crusher', 'Skull crushers', 'skull crushers|skullcrushers|skull crusher|lying tricep extension', 'push', 'triceps:1'],
  ['tricep_kickback', 'Tricep kickback', 'tricep kickback|tricep kickbacks|kickbacks', 'push', 'triceps:1'],

  // ------------------------------------------------------- pull: horizontal
  ['row', 'Barbell row', 'row|rows|barbell row|barbell rows|bent over row|bent over rows|pendlay row|yates row', 'pull', 'lats:1 mid_back:0.9 rear_delts:0.5 biceps:0.5 lower_back:0.4 forearms:0.3'],
  ['db_row', 'Dumbbell row', 'dumbbell row|dumbbell rows|db row|db rows|single arm row|one arm row|one arm dumbbell row|kroc row', 'pull', 'lats:1 mid_back:0.8 rear_delts:0.4 biceps:0.5 forearms:0.3'],
  ['cable_row', 'Seated cable row', 'cable row|cable rows|seated row|seated rows|machine row|low row', 'pull', 'mid_back:1 lats:0.8 rear_delts:0.4 biceps:0.5'],
  ['t_bar_row', 'T-bar row', 't bar row|t-bar row|tbar row|chest supported row|seal row', 'pull', 'mid_back:1 lats:0.9 rear_delts:0.4 biceps:0.5'],
  ['inverted_row', 'Inverted row', 'inverted row|inverted rows|australian pull ups|bodyweight row', 'pull', 'mid_back:1 lats:0.8 biceps:0.5 abs:0.3'],
  ['meadows_row', 'Meadows row', 'meadows row|landmine row', 'pull', 'lats:1 mid_back:0.8 rear_delts:0.4 biceps:0.4'],

  // --------------------------------------------------------- pull: vertical
  ['lat_pulldown', 'Lat pulldown', 'lat pulldown|lat pulldowns|pulldown|pulldowns|wide grip pulldown|close grip pulldown', 'pull', 'lats:1 biceps:0.5 mid_back:0.4 rear_delts:0.3'],
  ['pull_up', 'Pull-ups', 'pull ups|pull up|pullups|weighted pull ups|wide grip pull ups', 'pull', 'lats:1 biceps:0.6 mid_back:0.5 forearms:0.4 abs:0.3'],
  ['chin_up', 'Chin-ups', 'chin ups|chin up|chinups|weighted chin ups', 'pull', 'lats:1 biceps:0.8 mid_back:0.4 forearms:0.4'],
  ['straight_arm_pulldown', 'Straight-arm pulldown', 'straight arm pulldown|straight arm pulldowns|lat prayer', 'pull', 'lats:1 triceps:0.3'],
  ['pullover', 'Dumbbell pullover', 'pullover|pullovers|db pullover|dumbbell pullover|cable pullover', 'pull', 'lats:1 chest:0.5 triceps:0.3'],

  // -------------------------------------------------- pull: rear delt, traps
  ['face_pull', 'Face pulls', 'face pull|face pulls', 'pull', 'rear_delts:1 mid_back:0.5 traps:0.4'],
  ['rear_delt_fly', 'Rear delt fly', 'rear delt fly|rear delt flys|reverse fly|reverse flyes|reverse pec deck', 'pull', 'rear_delts:1 mid_back:0.4'],
  ['shrug', 'Shrugs', 'shrug|shrugs|barbell shrug|dumbbell shrug|trap bar shrug', 'pull', 'traps:1 forearms:0.3'],

  // ------------------------------------------------------------ pull: biceps
  ['curl', 'Bicep curls', 'curl|curls|bicep curl|bicep curls|dumbbell curl|barbell curl|ez bar curl|cable curl', 'pull', 'biceps:1 forearms:0.4'],
  ['hammer_curl', 'Hammer curls', 'hammer curl|hammer curls|rope hammer curl', 'pull', 'biceps:1 forearms:0.7'],
  ['preacher_curl', 'Preacher curls', 'preacher curl|preacher curls|spider curl|concentration curl', 'pull', 'biceps:1'],
  ['incline_curl', 'Incline curls', 'incline curl|incline curls|incline dumbbell curl', 'pull', 'biceps:1'],
  ['reverse_curl', 'Reverse curls', 'reverse curl|reverse curls', 'pull', 'forearms:1 biceps:0.5'],
  ['wrist_curl', 'Wrist curls', 'wrist curl|wrist curls|forearm curls|grip work|dead hang|dead hangs', 'pull', 'forearms:1'],

  // -------------------------------------------------------------------- core
  ['plank', 'Plank', 'plank|planks|weighted plank', 'core', 'abs:1 obliques:0.4 glutes:0.2'],
  ['side_plank', 'Side plank', 'side plank|side planks', 'core', 'obliques:1 abs:0.4'],
  ['crunch', 'Crunches', 'crunch|crunches|sit ups|sit up|situps|weighted crunch|decline sit ups', 'core', 'abs:1'],
  ['cable_crunch', 'Cable crunch', 'cable crunch|cable crunches|kneeling cable crunch', 'core', 'abs:1'],
  ['leg_raise', 'Leg raises', 'leg raise|leg raises|hanging leg raise|hanging leg raises|hanging knee raise|lying leg raises', 'core', 'abs:1 obliques:0.3'],
  ['ab_rollout', 'Ab rollout', 'ab rollout|ab rollouts|ab wheel', 'core', 'abs:1 lats:0.3 obliques:0.3'],
  ['russian_twist', 'Russian twists', 'russian twist|russian twists', 'core', 'obliques:1 abs:0.5'],
  ['dead_bug', 'Dead bug', 'dead bug|dead bugs|deadbug', 'core', 'abs:1 obliques:0.3'],
  ['bird_dog', 'Bird dog', 'bird dog|bird dogs', 'core', 'lower_back:1 abs:0.6 glutes:0.4'],
  ['pallof_press', 'Pallof press', 'pallof press|pallof', 'core', 'obliques:1 abs:0.6'],
  ['woodchop', 'Cable woodchop', 'woodchop|woodchops|cable chop|wood chop', 'core', 'obliques:1 abs:0.5'],
  ['mountain_climber', 'Mountain climbers', 'mountain climbers|mountain climber', 'core', 'abs:1 obliques:0.4 quads:0.4 front_delts:0.3'],
  ['hollow_hold', 'Hollow hold', 'hollow hold|hollow holds|hollow body', 'core', 'abs:1'],
  ['superman', 'Superman hold', 'superman|supermans|superman hold', 'core', 'lower_back:1 glutes:0.4'],

  // -------------------------------------------------------------------- full
  ['clean', 'Power clean', 'clean|power clean|cleans|hang clean', 'full', 'glutes:1 hamstrings:0.7 quads:0.6 traps:0.7 lower_back:0.5 forearms:0.4'],
  ['snatch', 'Snatch', 'snatch|snatches|power snatch', 'full', 'glutes:1 hamstrings:0.6 quads:0.6 traps:0.7 side_delts:0.5 lower_back:0.5'],
  ['thruster', 'Thrusters', 'thruster|thrusters', 'full', 'quads:1 glutes:0.8 front_delts:0.8 triceps:0.5'],
  ['burpee', 'Burpees', 'burpees|burpee', 'full', 'quads:1 chest:0.6 abs:0.5 glutes:0.5 triceps:0.4'],
  ['box_jump', 'Box jumps', 'box jumps|box jump', 'legs', 'quads:1 glutes:0.8 calves:0.6'],
  ['farmer_carry', 'Farmer carries', 'farmer carry|farmer carries|farmers walk|farmers carry|loaded carry|suitcase carry', 'full', 'forearms:1 traps:0.8 abs:0.5 obliques:0.4'],
  ['sled', 'Sled push/pull', 'sled|sled push|sled pull|prowler', 'full', 'quads:1 glutes:0.9 calves:0.5 abs:0.3'],
  ['battle_ropes', 'Battle ropes', 'battle ropes|battle rope', 'full', 'front_delts:1 side_delts:0.6 abs:0.5 forearms:0.5'],
  ['wall_ball', 'Wall balls', 'wall ball|wall balls', 'full', 'quads:1 glutes:0.7 front_delts:0.7'],
  ['turkish_getup', 'Turkish get-up', 'turkish get up|turkish getup|tgu', 'full', 'abs:1 obliques:0.7 front_delts:0.6 glutes:0.5'],
  ['med_ball_slam', 'Medicine ball slams', 'ball slams|med ball slams|medicine ball slams|slam ball', 'full', 'abs:1 lats:0.6 front_delts:0.4'],
  ['reverse_hyper', 'Reverse hyperextension', 'reverse hyper|reverse hyperextension|reverse hypers', 'legs', 'glutes:1 hamstrings:0.7 lower_back:0.5'],
  ['copenhagen_plank', 'Copenhagen plank', 'copenhagen plank|copenhagen planks', 'core', 'adductors:1 obliques:0.6'],
  ['jump_squat', 'Jump squats', 'jump squat|jump squats|squat jumps', 'legs', 'quads:1 glutes:0.8 calves:0.6'],
]

/** @typedef {{id:string,name:string,aliases:string[],group:string,muscles:Record<string,number>}} Exercise */

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
