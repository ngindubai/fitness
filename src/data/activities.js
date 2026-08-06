/**
 * Physical activity reference database.
 *
 * MET values follow the 2024 Adult Compendium of Physical Activities
 * (https://pacompendium.com). A MET is a multiple of resting metabolic rate,
 * so energy cost is roughly:  kcal = MET x weight_kg x hours.
 *
 * Row format: [id, name, aliases, met, tags, defaultMinutes]
 *
 * `tags` drive the coaching logic:
 *   cardio    - raises heart rate for a sustained period
 *   strength  - resistance work that drives muscle retention
 *   mobility  - flexibility / recovery work
 *   neat      - incidental daily movement rather than deliberate training
 *   vigorous  - counts double toward the WHO weekly activity target
 */

// prettier-ignore
const ROWS = [
  // ------------------------------------------------------------------ walking
  ['walk_slow', 'Walking (slow, 2-2.4 mph)', 'slow walk|stroll|strolling|dog walk|walking the dog', 2.8, 'cardio neat', 30],
  ['walk_moderate', 'Walking (moderate, 3 mph)', 'walk|walking|walked|went for a walk', 3.5, 'cardio neat', 30],
  ['walk_brisk', 'Walking (brisk, 3.5-4 mph)', 'brisk walk|fast walk|walked briskly|power walk|brisk walking', 4.5, 'cardio', 30],
  ['walk_very_brisk', 'Walking (very brisk, 4-4.4 mph)', 'very brisk walk|marching', 5.5, 'cardio', 30],
  ['hiking', 'Hiking', 'hike|hiking|hiked|rambling|trekking', 6.0, 'cardio vigorous', 90],
  ['stairs', 'Stair climbing', 'stairs|stair climbing|stairmaster|step machine', 9.3, 'cardio vigorous', 15],

  // ------------------------------------------------------------------ running
  ['jog', 'Jogging (general)', 'jog|jogging|jogged|easy run|slow run', 7.5, 'cardio vigorous', 30],
  ['run_5mph', 'Running (5 mph / 12 min mile)', 'run 5mph|12 minute mile', 8.5, 'cardio vigorous', 30],
  ['run_6mph', 'Running (6 mph / 10 min mile)', 'run|running|ran|went for a run|6mph|10 minute mile', 9.3, 'cardio vigorous', 30],
  ['run_7mph', 'Running (7 mph / 8.5 min mile)', 'fast run|7mph|tempo run', 11.0, 'cardio vigorous', 30],
  ['run_8mph', 'Running (8 mph / 7.5 min mile)', '8mph|hard run', 12.0, 'cardio vigorous', 30],
  ['run_9mph', 'Running (9 mph / 6.5 min mile)', '9mph|race pace run', 13.0, 'cardio vigorous', 25],
  ['run_10mph', 'Running (10 mph / 6 min mile)', '10mph|sprint pace', 14.8, 'cardio vigorous', 20],
  ['trail_run', 'Trail / cross-country running', 'trail run|cross country run|off road run', 9.3, 'cardio vigorous', 45],
  ['treadmill', 'Treadmill running', 'treadmill|treadmill run', 9.0, 'cardio vigorous', 30],
  ['parkrun', 'Parkrun (5 km)', 'parkrun|park run|5k|5km', 9.3, 'cardio vigorous', 28],
  ['marathon', 'Marathon / long run', 'marathon|long run|half marathon', 9.0, 'cardio vigorous', 120],

  // ------------------------------------------------------------------ cycling
  ['cycle_leisure', 'Cycling (leisure, <10 mph)', 'leisure cycle|easy bike ride|pootle', 4.0, 'cardio', 45],
  ['cycle_light', 'Cycling (light, 10-12 mph)', 'cycle|cycling|cycled|bike|biked|bike ride|riding', 6.8, 'cardio', 45],
  ['cycle_moderate', 'Cycling (moderate, 12-14 mph)', 'moderate cycling|road bike|road cycling', 8.0, 'cardio vigorous', 60],
  ['cycle_vigorous', 'Cycling (vigorous, 14-16 mph)', 'fast cycling|hard ride', 10.0, 'cardio vigorous', 60],
  ['cycle_racing', 'Cycling (racing, 16-19 mph)', 'racing bike|bike race|time trial', 12.0, 'cardio vigorous', 60],
  ['mtb', 'Mountain biking', 'mountain bike|mtb|mountain biking', 8.5, 'cardio vigorous', 60],
  ['spin_class', 'Spin / RPM class', 'spin|spin class|rpm|peloton', 9.0, 'cardio vigorous', 45],
  ['stationary_bike', 'Stationary bike (moderate)', 'exercise bike|stationary bike|static bike|watt bike', 6.8, 'cardio', 30],

  // ------------------------------------------------------------------ gym
  ['weights_light', 'Weight training (light / moderate)', 'weights|lifting|lifted|gym|weight training|resistance training|lift', 3.5, 'strength', 45],
  ['weights_vigorous', 'Weight training (vigorous)', 'heavy lifting|heavy weights|powerlifting|hard gym session', 6.0, 'strength vigorous', 60],
  ['bodyweight', 'Bodyweight circuit', 'bodyweight|calisthenics|press ups|push ups|pull ups|squats|home workout', 5.0, 'strength', 30],
  ['crossfit', 'CrossFit / functional training', 'crossfit|functional training|wod|metcon|hyrox', 8.0, 'strength cardio vigorous', 45],
  ['circuit_training', 'Circuit training', 'circuits|circuit training|bootcamp|f45|barrys|barry s', 7.5, 'strength cardio vigorous', 45],
  ['hiit', 'HIIT session', 'hiit|interval training|intervals|tabata', 8.8, 'cardio vigorous', 25],
  ['assault_bike', 'Assault / air bike', 'assault bike|air bike|airbike|echo bike', 10.0, 'cardio vigorous', 15],
  ['rowing_machine', 'Rowing machine (moderate)', 'rowing|rowed|rower|erg|row machine|concept2', 7.0, 'cardio strength vigorous', 30],
  ['rowing_hard', 'Rowing machine (vigorous)', 'hard rowing|rowing intervals', 8.5, 'cardio strength vigorous', 30],
  ['elliptical', 'Elliptical / cross trainer', 'elliptical|cross trainer|crosstrainer', 5.0, 'cardio', 30],
  ['ski_erg', 'Ski erg', 'ski erg|skierg', 7.0, 'cardio strength vigorous', 20],
  ['battle_ropes', 'Battle ropes', 'battle ropes|ropes', 8.0, 'strength cardio vigorous', 15],
  ['kettlebell', 'Kettlebell training', 'kettlebell|kettlebells|kb swings', 8.0, 'strength cardio vigorous', 30],

  // ------------------------------------------------------------------ sports
  ['football', 'Football (casual)', 'football|soccer|played football|5 a side|five a side|kickabout', 7.0, 'cardio vigorous', 60],
  ['football_comp', 'Football (competitive)', 'competitive football|match|football match', 10.0, 'cardio vigorous', 90],
  ['rugby', 'Rugby', 'rugby', 8.3, 'cardio strength vigorous', 80],
  ['basketball', 'Basketball', 'basketball|hoops', 6.5, 'cardio vigorous', 60],
  ['tennis', 'Tennis (singles)', 'tennis', 7.3, 'cardio vigorous', 60],
  ['padel', 'Padel / squash', 'padel|padel tennis|paddle tennis|squash|racquetball', 7.3, 'cardio vigorous', 45],
  ['pickleball', 'Pickleball', 'pickleball', 6.0, 'cardio', 45],
  ['badminton', 'Badminton', 'badminton', 5.5, 'cardio', 45],
  ['golf', 'Golf (walking, carrying clubs)', 'golf|round of golf|golfing', 4.8, 'cardio neat', 240],
  ['swim_moderate', 'Swimming (moderate laps)', 'swim|swimming|swam|laps|lengths', 5.8, 'cardio', 30],
  ['swim_vigorous', 'Swimming (vigorous / freestyle fast)', 'hard swim|front crawl|fast swimming', 9.8, 'cardio vigorous', 30],
  ['climbing', 'Rock climbing / bouldering', 'climbing|bouldering|rock climbing', 7.5, 'strength cardio vigorous', 60],
  ['boxing', 'Boxing / bag work', 'boxing|boxed|bag work|punchbag|sparring', 7.8, 'cardio strength vigorous', 30],
  ['martial_arts', 'Martial arts', 'martial arts|karate|judo|bjj|jiu jitsu|mma', 10.3, 'cardio strength vigorous', 60],
  ['skiing', 'Skiing / snowboarding', 'skiing|ski|snowboarding|snowboard', 7.0, 'cardio vigorous', 180],
  ['surfing', 'Surfing', 'surf|surfing', 5.0, 'cardio', 90],
  ['paddleboard', 'Paddleboarding / kayaking', 'paddleboard|sup|kayak|kayaking|canoeing', 5.5, 'cardio strength', 60],
  ['dancing', 'Dancing', 'dancing|dance|zumba', 7.3, 'cardio', 45],
  ['skipping', 'Skipping / jump rope', 'skipping|skipped|jump rope|jumping rope', 11.0, 'cardio vigorous', 15],

  // ---------------------------------------------------- mobility & recovery
  ['yoga', 'Yoga (hatha)', 'yoga', 3.0, 'mobility', 45],
  ['yoga_power', 'Power / vinyasa yoga', 'power yoga|vinyasa|hot yoga|bikram', 4.0, 'mobility strength', 60],
  ['pilates', 'Pilates', 'pilates', 3.0, 'mobility strength', 45],
  ['stretching', 'Stretching / mobility', 'stretch|stretching|mobility|foam rolling', 2.3, 'mobility', 15],
  ['sauna', 'Sauna', 'sauna|steam room', 1.5, 'mobility', 20],

  // ------------------------------------------------------------------ NEAT
  ['gardening', 'Gardening', 'gardening|garden|mowing|weeding', 3.8, 'neat', 60],
  ['housework', 'Housework / cleaning', 'housework|cleaning|hoovering|vacuuming|tidying', 3.3, 'neat', 45],
  ['diy', 'DIY / manual work', 'diy|decorating|painting|building|manual work', 4.5, 'neat', 90],
  ['shopping', 'Shopping (walking round)', 'shopping|food shop', 2.3, 'neat', 45],
  ['playing_kids', 'Playing with children', 'playing with kids|kids|playing with children', 4.0, 'neat', 45],
]

/** @typedef {{id:string,name:string,aliases:string[],met:number,tags:string[],defaultMinutes:number}} Activity */

/** @type {Activity[]} */
export const ACTIVITIES = ROWS.map(([id, name, aliases, met, tags, defaultMinutes]) => ({
  id,
  name,
  aliases: String(aliases).split('|').filter(Boolean),
  met,
  tags: String(tags).split(/\s+/).filter(Boolean),
  defaultMinutes,
}))

export const ACTIVITIES_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]))

/** Longest alias first, so "brisk walk" beats "walk". */
export const ACTIVITY_ALIAS_INDEX = (() => {
  /** @type {Array<{term:string, activity:Activity}>} */
  const entries = []
  for (const activity of ACTIVITIES) {
    const terms = new Set([
      activity.name.toLowerCase(),
      ...activity.aliases.map((a) => a.toLowerCase()),
    ])
    for (const term of terms) entries.push({ term, activity })
  }
  entries.sort((a, b) => b.term.length - a.term.length)
  return entries
})()

/**
 * Pace-aware running lookup. When someone logs a distance and a time we can do
 * far better than a generic "running" MET, so map the resulting speed onto the
 * compendium's running ladder.
 */
const RUN_LADDER = [
  [4.0, 6.0], [4.3, 6.5], [4.8, 7.8], [5.2, 8.5], [5.8, 9.0], [6.3, 9.3],
  [6.7, 10.5], [7.0, 11.0], [7.5, 11.8], [8.0, 12.0], [8.6, 12.5], [9.0, 13.0],
  [10.0, 14.8], [11.0, 16.8], [12.0, 18.5], [13.0, 19.8], [14.0, 23.0],
]

const CYCLE_LADDER = [
  [10.0, 4.0], [12.0, 6.8], [14.0, 8.0], [16.0, 10.0], [20.0, 12.0], [99, 16.8],
]

const WALK_LADDER = [
  [2.0, 2.3], [2.5, 2.8], [2.8, 3.0], [3.5, 3.8], [4.0, 4.8], [4.5, 5.5],
  [5.0, 7.0], [99, 8.5],
]

/**
 * @param {'run'|'cycle'|'walk'} mode
 * @param {number} mph
 * @returns {number} MET value for that speed
 */
export function metForSpeed(mode, mph) {
  const ladder = mode === 'run' ? RUN_LADDER : mode === 'cycle' ? CYCLE_LADDER : WALK_LADDER
  for (const [speed, met] of ladder) {
    if (mph <= speed) return met
  }
  return ladder[ladder.length - 1][1]
}
