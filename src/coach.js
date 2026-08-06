/**
 * The coach.
 *
 * House style: say the number, say what it means, stop. No praise sandwiches,
 * no "great effort!" on a day that was not a great effort, and equally no
 * manufactured criticism on a day that was genuinely good. The one thing this
 * file must never do is flatter the user into thinking a bad day was fine.
 *
 * It must also never pretend the estimates are more precise than they are. The
 * honest position is "your intake was roughly X, which is clearly above target"
 * - blunt about the conclusion, truthful about the error bars.
 */

const SEVERITY_ORDER = { critical: 0, bad: 1, warn: 2, note: 3, good: 4 }

function finding(severity, code, text) {
  return { severity, code, text }
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-GB')
}

/** Deterministic pick so a given day always reads the same way. */
function pick(options, seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return options[hash % options.length]
}

// --------------------------------------------------------------- day scoring

/**
 * Score the day out of 100. Weightings reflect what actually drives results:
 * energy balance and protein dominate body composition, training consistency
 * matters next, and food quality is the tiebreaker.
 */
function scoreDay(day) {
  const { targets, adherence, nutrition, training } = day
  const goal = targets.goal

  // Calories - 35 points. For fat loss, being under target is fine down to a
  // point; being over is what stalls progress.
  let calorieScore
  const pct = adherence.caloriePct
  if (!day.caloriesIn) calorieScore = 0
  else if (goal === 'lose') {
    if (pct <= 105) calorieScore = 35
    else if (pct <= 115) calorieScore = 25
    else if (pct <= 130) calorieScore = 14
    else if (pct <= 150) calorieScore = 6
    else calorieScore = 0
    if (pct < 70) calorieScore = 20 // too aggressive is its own problem
  } else if (goal === 'gain') {
    calorieScore = pct >= 95 && pct <= 115 ? 35 : pct >= 85 ? 24 : 12
  } else {
    calorieScore = Math.abs(pct - 100) <= 10 ? 35 : Math.abs(pct - 100) <= 20 ? 22 : 10
  }

  // Protein - 25 points, the single most protective variable in a deficit.
  const pPct = adherence.proteinPct
  const proteinScore = pPct >= 95 ? 25 : pPct >= 80 ? 19 : pPct >= 60 ? 11 : pPct >= 40 ? 5 : 0

  // Training - 25 points.
  let trainingScore = 0
  if (training.minutes >= 20) trainingScore += 10
  if (training.equivalentModerateMinutes >= 30) trainingScore += 8
  if (training.strengthMinutes >= 20) trainingScore += 7
  trainingScore = Math.min(25, trainingScore)

  // Food quality - 15 points from fibre and from how much of the day was
  // junk, alcohol or added sugar.
  let qualityScore = 0
  qualityScore += adherence.fibrePct >= 80 ? 7 : adherence.fibrePct >= 50 ? 4 : 1
  const junkShare = day.caloriesIn
    ? ((day.tagKcal.junk || 0) + (day.tagKcal.alcohol || 0)) / day.caloriesIn
    : 0
  qualityScore += junkShare < 0.1 ? 8 : junkShare < 0.2 ? 5 : junkShare < 0.35 ? 2 : 0

  return Math.round(calorieScore + proteinScore + trainingScore + qualityScore)
}

const VERDICTS = [
  { min: 85, label: 'Excellent', line: 'Genuinely good day. Do it again.' },
  { min: 70, label: 'Solid', line: 'Good day with one or two loose ends.' },
  { min: 55, label: 'Mediocre', line: 'Not a disaster, not progress either.' },
  { min: 40, label: 'Poor', line: 'This is the kind of day that stalls you.' },
  { min: 20, label: 'Bad', line: 'Nothing about today moved you forward.' },
  { min: 0, label: 'Write-off', line: 'Today worked against you on every axis.' },
]

// ------------------------------------------------------------- day narrative

/**
 * Produce the brutally honest daily review.
 *
 * @param {ReturnType<import('./engine.js').buildDay>} day
 * @param {object} profile
 * @param {object[]} [recentDays] earlier days, oldest first, for context
 */
export function reviewDay(day, profile, recentDays = []) {
  const findings = []
  const { targets, adherence, nutrition, training } = day
  const goal = targets.goal
  const seed = day.date || 'x'

  if (!day.logged) {
    return {
      score: 0,
      verdict: 'Nothing logged',
      headline: 'You logged nothing today. I cannot review a blank page.',
      findings: [
        finding('bad', 'no_log',
          'An empty day is not a rest day, it is a gap in the data. If you ate, log it - ' +
          'the days people skip logging are, reliably, the days they would rather not look at.'),
      ],
      summary: 'No data.',
      estimates: null,
    }
  }

  // ----------------------------------------------------------- energy balance
  const over = day.caloriesIn - targets.calories
  const pct = adherence.caloriePct

  if (goal === 'lose') {
    if (over > 0 && day.net > 0) {
      findings.push(
        finding('critical', 'surplus',
          `You ate roughly ${fmt(day.caloriesIn)} kcal and burned roughly ${fmt(day.caloriesOut)}. ` +
          `That is a surplus of about ${fmt(day.net)} kcal. You did not lose fat today - on these ` +
          `numbers you gained a little. Calling this "a slip" does not change the arithmetic.`)
      )
    } else if (over > 250) {
      findings.push(
        finding('bad', 'over_target',
          `${fmt(day.caloriesIn)} kcal against a ${fmt(targets.calories)} target - about ` +
          `${fmt(over)} over. You are still in a deficit against maintenance, but you have ` +
          `roughly halved the day's progress. Repeat this four times a week and your ` +
          `"deficit" is a rounding error.`)
      )
    } else if (over > 0) {
      findings.push(
        finding('note', 'slightly_over',
          `${fmt(day.caloriesIn)} kcal versus a ${fmt(targets.calories)} target. ` +
          `${fmt(over)} over is inside the margin of error on both sides of this calculation. ` +
          `Fine. Do not make a habit of aiming for the ceiling.`)
      )
    } else if (pct < 65) {
      findings.push(
        finding('bad', 'under_eating',
          `Only ${fmt(day.caloriesIn)} kcal against a ${fmt(targets.calories)} target. ` +
          `Undereating this hard is not discipline, it is a setup for a binge and for losing ` +
          `muscle alongside fat. Either you did not log everything, or you need to eat more.`)
      )
    } else {
      findings.push(
        finding('good', 'on_target',
          `${fmt(day.caloriesIn)} kcal in, roughly ${fmt(day.caloriesOut)} out - a deficit of ` +
          `about ${fmt(day.deficit)} kcal. That is what the plan asks for. ` +
          `${pick(['Nothing to fix here.', 'This is the boring, effective version.', 'Exactly the point.'], seed)}`)
      )
    }
  } else if (goal === 'gain') {
    if (day.net < 0) {
      findings.push(
        finding('bad', 'gain_deficit',
          `You are trying to build and you ate at a ${fmt(-day.net)} kcal deficit. ` +
          `You cannot build tissue out of nothing. Eat more.`)
      )
    } else {
      findings.push(
        finding('good', 'gain_surplus',
          `${fmt(day.caloriesIn)} kcal in against roughly ${fmt(day.caloriesOut)} out - a ` +
          `${fmt(day.net)} kcal surplus. Appropriate for the goal.`)
      )
    }
  } else if (Math.abs(day.net) > 400) {
    findings.push(
      finding('warn', 'maintenance_drift',
        `You are aiming to maintain and finished ${day.net > 0 ? fmt(day.net) + ' over' : fmt(-day.net) + ' under'}. ` +
        `Maintenance is a range, not a knife-edge, but this is outside it.`)
    )
  } else {
    findings.push(
      finding('good', 'maintenance_ok',
        `${fmt(day.caloriesIn)} in, ${fmt(day.caloriesOut)} out. Balanced, which is the goal.`)
    )
  }

  // ------------------------------------------------------------------ protein
  const proteinGap = targets.protein - nutrition.protein
  if (adherence.proteinPct < 60) {
    findings.push(
      finding('bad', 'protein_low',
        `Protein came in at ${fmt(nutrition.protein)} g against a ${fmt(targets.protein)} g target - ` +
        `you are ${fmt(proteinGap)} g short. In a deficit, low protein is how you end up ` +
        `lighter and softer rather than lighter and leaner. This is the easiest thing on ` +
        `this list to fix and you did not do it.`)
    )
  } else if (adherence.proteinPct < 85) {
    findings.push(
      finding('warn', 'protein_mid',
        `${fmt(nutrition.protein)} g protein, ${fmt(proteinGap)} g under target. ` +
        `Close is not the same as done - a tin of tuna or a scoop of whey covers this.`)
    )
  } else {
    findings.push(
      finding('good', 'protein_ok',
        `Protein at ${fmt(nutrition.protein)} g hits the ${fmt(targets.protein)} g target. ` +
        `That is the variable that protects your muscle while you diet, and you got it right.`)
    )
  }

  // ----------------------------------------------------------------- training
  if (training.minutes === 0) {
    const restStreak = countTrailing(recentDays, (d) => d.training?.minutes === 0) + 1
    if (restStreak >= 3) {
      findings.push(
        finding('critical', 'no_training_streak',
          `${restStreak} days in a row with no training logged. That is not recovery, that is a ` +
          `habit forming. Whatever the reason, the calendar does not care about it.`)
      )
    } else {
      findings.push(
        finding('warn', 'no_training',
          `No training logged. One rest day is fine and often useful - just be honest with ` +
          `yourself about whether it was planned or whether the day got away from you.`)
      )
    }
  } else {
    const parts = []
    if (training.cardioMinutes) parts.push(`${training.cardioMinutes} min cardio`)
    if (training.strengthMinutes) parts.push(`${training.strengthMinutes} min strength`)
    findings.push(
      finding('good', 'trained',
        `${parts.join(' and ') || `${training.minutes} min of work`}, worth roughly ` +
        `${fmt(training.kcal)} kcal net. Treat that number as approximate - exercise burn ` +
        `estimates run optimistic, so do not spend it twice.`)
    )

    // Only worth saying when the overshoot is big enough to matter — otherwise
    // this contradicts the "inside the margin of error" note above it.
    if (training.kcal > 0 && over > 250 && goal === 'lose') {
      findings.push(
        finding('bad', 'ate_back',
          `You trained and then ate past target anyway. The session bought you about ` +
          `${fmt(training.kcal)} kcal and you spent roughly ${fmt(over)} of it. ` +
          `You cannot outrun a fork.`)
      )
    }
  }

  const strengthDaysRecent = recentDays.slice(-6).filter((d) => d.training?.strengthMinutes > 0).length
  if (training.strengthMinutes === 0 && strengthDaysRecent === 0 && recentDays.length >= 5) {
    findings.push(
      finding('bad', 'no_strength_week',
        `No resistance training in the last week. Cardio alone in a deficit costs you muscle. ` +
        `Two sessions a week is the minimum that changes anything.`)
    )
  }

  // ------------------------------------------------------- heat & hydration
  if (profile.climate === 'hot' && training.outdoorMinutes > 0) {
    findings.push(
      finding('note', 'heat',
        `${training.outdoorMinutes} min of that was outdoors in serious heat, so the burn ` +
        `estimate carries a modest heat uplift. The bigger cost of heat is fluid, not calories.`)
    )
  }

  const waterTarget = targets.waterMl || 0
  if (waterTarget > 0) {
    if (day.waterMl > 0 && day.waterMl < waterTarget * 0.5) {
      findings.push(
        finding('warn', 'water_low',
          `${(day.waterMl / 1000).toFixed(1)} L of water against a ~${(waterTarget / 1000).toFixed(1)} L day. ` +
          `At your size${profile.climate === 'hot' ? ' in this climate' : ''}, that is not close. ` +
          `Dehydration reads as hunger and fatigue - both of which you will then eat.`)
      )
    } else if (day.waterMl >= waterTarget * 0.9) {
      findings.push(
        finding('good', 'water_ok',
          `${(day.waterMl / 1000).toFixed(1)} L of water - target met. Unglamorous and important.`)
      )
    } else if (day.waterMl === 0 && training.minutes > 0 && profile.climate === 'hot') {
      findings.push(
        finding('note', 'water_untracked',
          `You trained in a hot climate and logged no water. If you drank, tap it in - ` +
          `hydration is the one estimate here that costs nothing to get right.`)
      )
    }
  }

  // ------------------------------------------------------------------ alcohol
  if (day.alcoholKcal > 0) {
    const share = Math.round((day.alcoholKcal / day.caloriesIn) * 100)
    // Units are the number the drinking guideline is written in, so lead with
    // them when we have them - "2.4 units" lands differently to "210 kcal".
    const units = day.alcoholUnits ? `${day.alcoholUnits} unit${day.alcoholUnits === 1 ? '' : 's'}, ` : ''
    if (day.alcoholKcal > 500) {
      findings.push(
        finding('bad', 'alcohol_heavy',
          `${units}${fmt(day.alcoholKcal)} kcal of that was alcohol - ${share}% of your intake, and ` +
          `not one gram of it is protein, fibre or anything your body needed. It also blunts ` +
          `muscle protein synthesis for about a day and wrecks the sleep that your recovery ` +
          `depends on. This was the single most expensive decision of your day.`)
      )
    } else {
      findings.push(
        finding('warn', 'alcohol',
          `${units}${fmt(day.alcoholKcal)} kcal from alcohol (${share}% of intake). Not fatal, but it ` +
          `is the cheapest place to find calories back when you want them.`)
      )
    }
    if (day.training.strengthMinutes > 0 && day.alcoholUnits >= 4) {
      findings.push(
        finding('warn', 'alcohol_after_lifting',
          `You lifted today and then drank ${day.alcoholUnits} units. Alcohol blunts the repair ` +
          `response for roughly 24 hours, so this is the session you got the least out of. ` +
          `If the drinking is happening anyway, put it after the last session of the week.`)
      )
    }
  }

  // --------------------------------------------------------- quality signals
  const junkKcal = (day.tagKcal.junk || 0) + (day.tagKcal.sugary || 0)
  if (day.caloriesIn > 0 && junkKcal / day.caloriesIn > 0.3) {
    findings.push(
      finding('bad', 'junk_heavy',
        `Roughly ${Math.round((junkKcal / day.caloriesIn) * 100)}% of today's calories came from ` +
        `processed and sugary food. That is why you were hungry again two hours later - ` +
        `same calories, a fraction of the fullness.`)
    )
  }

  if (adherence.fibrePct < 50) {
    findings.push(
      finding('warn', 'fibre_low',
        `Fibre at ${fmt(nutrition.fibre)} g against ${fmt(targets.fibre)} g. Low fibre makes a ` +
        `deficit feel far worse than it needs to. Vegetables, beans, oats - cheap fix.`)
    )
  } else if (adherence.fibrePct >= 90) {
    findings.push(
      finding('good', 'fibre_ok', `Fibre at ${fmt(nutrition.fibre)} g. That is doing quiet work for your appetite.`)
    )
  }

  // ------------------------------------------------------- data quality flags
  if (day.unrecognisedItems > 0) {
    findings.push(
      finding('note', 'unrecognised',
        `${day.unrecognisedItems} item${day.unrecognisedItems > 1 ? 's' : ''} could not be matched ` +
        `to the food database, so ${day.unrecognisedItems > 1 ? 'their' : 'its'} calories are missing ` +
        `from the total. Your real intake is higher than the number above.`)
    )
  }

  if (day.caloriesIn > 0 && day.caloriesIn < targets.bmr * 0.9 && day.mealCount <= 2) {
    findings.push(
      finding('warn', 'underlogged',
        `${fmt(day.caloriesIn)} kcal across ${day.mealCount} meal${day.mealCount === 1 ? '' : 's'} is ` +
        `below your resting metabolic rate. Either today was genuinely unusual, or - far more ` +
        `likely - you stopped logging partway through. Untracked days are how deficits quietly disappear.`)
    )
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const score = scoreDay(day)
  const verdict = VERDICTS.find((v) => score >= v.min)
  const worst = findings[0]

  return {
    score,
    verdict: verdict.label,
    headline: buildHeadline(day, score, verdict, worst),
    findings,
    summary: verdict.line,
    estimates: {
      caloriesIn: day.caloriesIn,
      caloriesOut: day.caloriesOut,
      net: day.net,
      projectedKgPerWeek: day.projectedKgPerWeek,
    },
  }
}

function buildHeadline(day, score, verdict, worst) {
  const balance =
    day.net > 0
      ? `${fmt(day.net)} kcal surplus`
      : `${fmt(-day.net)} kcal deficit`
  // The verdict word is rendered beside this, so don't repeat it here.
  return `${score}/100. Roughly ${fmt(day.caloriesIn)} in, ${fmt(day.caloriesOut)} out, ${balance}.`
}

function countTrailing(days, predicate) {
  let count = 0
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (predicate(days[i])) count += 1
    else break
  }
  return count
}

// ---------------------------------------------------------- weekly narrative

/**
 * The weekly review is where the truth actually lives. Daily energy balance is
 * noisy - water, glycogen and gut contents swamp a few hundred calories - so
 * this is the number that should drive decisions.
 */
export function reviewWeek(week, profile, days = []) {
  const findings = []
  if (!week.loggedDays) {
    return {
      headline: 'Nothing logged this week.',
      findings: [finding('bad', 'no_data', 'Seven blank days. There is nothing to review.')],
      consistency: 0,
    }
  }

  const consistency = Math.round((week.loggedDays / week.days) * 100)

  if (consistency < 60) {
    findings.push(
      finding('critical', 'consistency',
        `You logged ${week.loggedDays} of ${week.days} days. Any conclusion drawn from this is ` +
        `guesswork, and the unlogged days are almost never the good ones. Fix the logging before ` +
        `you change anything else.`)
    )
  } else if (consistency < 90) {
    findings.push(
      finding('warn', 'consistency_ok',
        `${week.loggedDays} of ${week.days} days logged. Good enough to see a trend, not good ` +
        `enough to trust the averages.`)
    )
  } else {
    findings.push(
      finding('good', 'consistency_good',
        `${week.loggedDays} of ${week.days} days logged. That is the part most people fail at.`)
    )
  }

  const target = profile.goal === 'lose' ? -Math.abs(profile.rateKgPerWeek || 0.5) : 0
  const actual = week.projectedKgPerWeek

  if (profile.goal === 'lose') {
    if (actual > 0) {
      findings.push(
        finding('critical', 'week_gaining',
          `Average balance was a ${fmt(week.avgNet)} kcal daily surplus. Across the week that ` +
          `projects to gaining about ${Math.abs(actual)} kg, not losing. Whatever you believe ` +
          `you are doing, the log says otherwise.`)
      )
    } else if (Math.abs(actual) < Math.abs(target) * 0.5) {
      findings.push(
        finding('bad', 'week_slow',
          `Projected loss is about ${Math.abs(actual)} kg/week against a ${Math.abs(target)} kg target. ` +
          `You are moving, barely. At this rate the goal is months further away than you think.`)
      )
    } else if (Math.abs(actual) > Math.abs(target) * 1.8) {
      findings.push(
        finding('warn', 'week_fast',
          `Projected loss of about ${Math.abs(actual)} kg/week is faster than the ` +
          `0.5-1% of bodyweight per week that holds up long term. Fast loss costs muscle and ` +
          `rebounds. Eat a bit more.`)
      )
    } else {
      findings.push(
        finding('good', 'week_on_track',
          `Average daily deficit of ${fmt(-week.avgNet)} kcal, projecting about ` +
          `${Math.abs(actual)} kg/week. That is on plan. Keep it dull and repeat it.`)
      )
    }
  }

  const proteinTargetG = Math.round(profile.weightKg * (profile.goal === 'lose' ? 2.0 : 1.6))
  if (week.avgProtein < proteinTargetG * 0.8) {
    findings.push(
      finding('bad', 'week_protein',
        `Protein averaged ${fmt(week.avgProtein)} g/day against roughly ${fmt(proteinTargetG)} g. ` +
        `A week of that in a deficit and some of what you have lost is muscle.`)
    )
  }

  if (week.strengthDays < 2) {
    findings.push(
      finding('bad', 'week_strength',
        `${week.strengthDays} resistance session${week.strengthDays === 1 ? '' : 's'} this week. ` +
        `Two is the floor if you want to keep the muscle you have.`)
    )
  }

  const totalVolume = days.reduce((sum, d) => sum + (d.training?.volumeKg || 0), 0)
  if (totalVolume > 0) {
    findings.push(
      finding('good', 'week_volume',
        `${totalVolume.toLocaleString('en-GB')} kg moved under the bar this week. Volume is the ` +
        `number to push up slowly - same lifts, a little more each week.`)
    )
  }

  if (week.equivalentModerateMinutes < 150) {
    findings.push(
      finding('warn', 'week_cardio',
        `${week.equivalentModerateMinutes} moderate-equivalent minutes against the 150/week ` +
        `public health minimum. That minimum is a floor for basic health, not a training plan.`)
    )
  } else {
    findings.push(
      finding('good', 'week_cardio_ok',
        `${week.equivalentModerateMinutes} moderate-equivalent minutes, clearing the 150/week guideline.`)
    )
  }

  if (week.alcoholDays >= 3) {
    findings.push(
      finding('bad', 'week_alcohol',
        `Alcohol on ${week.alcoholDays} of ${week.loggedDays} logged days. This is the pattern ` +
        `that quietly cancels an otherwise decent week.`)
    )
  }

  // The UK guideline is 14 units a week for everyone, spread over three or
  // more days, with drink-free days in between. It is a health limit, not a
  // fat-loss one - worth stating separately from the calorie arithmetic.
  const units = week.alcoholUnits || 0
  if (units > 14) {
    findings.push(
      finding('bad', 'week_units_over',
        `${units} units this week, against the 14-unit weekly guideline. That is ` +
        `${Math.round((units / 14 - 1) * 100)}% over, and roughly ${fmt(Math.round(units * 80))} kcal ` +
        `you drank rather than ate.`)
    )
  } else if (units >= 10) {
    findings.push(
      finding('warn', 'week_units',
        `${units} units this week. Under the 14-unit guideline, but not by much - and the ` +
        `calories that come with the drinking are rarely in the glass.`)
    )
  } else if (units > 0) {
    findings.push(
      finding('good', 'week_units_ok',
        `${units} units this week, comfortably inside the 14-unit guideline.`)
    )
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return {
    headline:
      `${week.loggedDays} days logged, averaging ${fmt(week.avgIn)} kcal in and ${fmt(week.avgOut)} out. ` +
      `Trend: ${actual > 0 ? '+' : ''}${actual} kg/week.`,
    findings,
    consistency,
  }
}

export { scoreDay }
