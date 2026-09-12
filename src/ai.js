/**
 * Optional AI-written commentary.
 *
 * The app is fully functional without this — `coach.js` produces the daily
 * review from deterministic rules and costs nothing to run. Setting an
 * ANTHROPIC_API_KEY simply swaps the rules engine's findings for a version
 * written in prose, using the same underlying numbers.
 *
 * Everything here degrades gracefully: any failure returns null and the caller
 * falls back to the rules-based review.
 */

import Anthropic from '@anthropic-ai/sdk'
import { isHotClimate } from './engine.js'

const MODEL = 'claude-opus-5'

/**
 * Thinking is on by default on this model and `max_tokens` caps thinking plus
 * response text together, so the budget is set well above what the prose
 * itself needs. Effort is low deliberately: this is a short, well-specified
 * writing task, not a reasoning problem.
 */
const MAX_TOKENS = 4000
const EFFORT = 'low'

/**
 * Server-side fallbacks: if a safety classifier declines the request, the API
 * re-runs it on Anthropic's recommended fallback model inside the same call
 * rather than handing back a refusal.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function isAiConfigured(ctx) {
  return Boolean(ctx?.aiKey)
}

function client(ctx) {
  return new Anthropic({ apiKey: ctx.aiKey })
}

/** Pull the plain text out of a response, or null if the model declined. */
function textOf(response) {
  if (response.stop_reason === 'refusal') return null
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

const VOICE = `You are the user's fitness and nutrition coach. They have explicitly asked
for brutally honest feedback and do not want to be flattered or sugar-coated.

Rules:
- Lead with the verdict. No preamble, no "Great question", no restating their data back to them.
- Be blunt about bad days and specific about why. Use the actual numbers.
- Be equally honest about good days - do not manufacture criticism to seem tough.
- Never moralise, shame their body, or imply anything about their worth. Blunt about
  behaviour, never about the person.
- Calorie and exercise-burn figures are estimates with real error bars. Be decisive about
  the conclusion ("that is clearly a surplus") without pretending the number is exact.
- 120-180 words. Plain prose, no headings, no bullet lists, no emoji.`

/**
 * Rewrite the day's findings as prose.
 *
 * @returns {Promise<string|null>}
 */
export async function aiReview({ day, review, profile, ctx }) {
  if (!isAiConfigured(ctx)) return null

  const facts = {
    date: day.date,
    person: `${profile.age} years old, ${profile.weightKg} kg, ${isHotClimate(profile) ? 'training in a hot climate' : 'a temperate climate'}`,
    goal: day.targets.goal,
    waterMl: day.waterMl || 0,
    waterTargetMl: day.targets.waterMl || null,
    caloriesIn: day.caloriesIn,
    caloriesOut: day.caloriesOut,
    calorieTarget: day.targets.calories,
    netBalance: day.net,
    protein: `${day.nutrition.protein} g of a ${day.targets.protein} g target`,
    fibre: `${day.nutrition.fibre} g of a ${day.targets.fibre} g target`,
    alcoholKcal: day.alcoholKcal,
    training: day.training,
    ruleBasedFindings: review.findings.map((f) => `[${f.severity}] ${f.text}`),
    score: review.score,
  }

  const response = await client(ctx).beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: EFFORT },
    system: VOICE,
    messages: [
      {
        role: 'user',
        content:
          `Here is today's log, already analysed. Write the day's review.\n\n` +
          `${JSON.stringify(facts, null, 2)}\n\n` +
          `The findings list is what my rules engine concluded — use it as the substance ` +
          `and write it as one piece of prose. Do not invent facts that are not in the data.`,
      },
    ],
  })

  return textOf(response)
}

const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          why: { type: 'string' },
          estimatedKcal: { type: 'integer' },
          estimatedProtein: { type: 'integer' },
        },
        required: ['name', 'why', 'estimatedKcal', 'estimatedProtein'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
}

/**
 * Suggest meals outside the built-in template library, informed by what the
 * user actually eats.
 *
 * @returns {Promise<{name:string,why:string,estimatedKcal:number,estimatedProtein:number}[]|null>}
 */
export async function aiMealIdeas({ profile, remaining, taste, slot, ctx }) {
  if (!isAiConfigured(ctx)) return null

  const favourites = (taste?.favourites || []).slice(0, 15).map((f) => f.name)

  const response = await client(ctx).beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: MEAL_SCHEMA } },
    system:
      `You suggest meals for someone tracking their food. Suggest things they would ` +
      `plausibly cook or buy given what they already eat. Keep each "why" to one short ` +
      `sentence. Do not suggest anything that would blow their remaining calories.`,
    messages: [
      {
        role: 'user',
        content:
          `Suggest 3 ${slot || 'meal'} ideas.\n` +
          `Goal: ${profile.goalText || profile.goal}. Bodyweight: ${profile.weightKg} kg.\n` +
          `Calories left today: ${Math.round(remaining?.kcal ?? 0)}.\n` +
          `Protein still owed: ${Math.round(remaining?.protein ?? 0)} g.\n` +
          `Foods they eat often: ${favourites.length ? favourites.join(', ') : 'not enough history yet'}.`,
      },
    ],
  })

  const text = textOf(response)
  if (!text) return null
  try {
    return JSON.parse(text).ideas
  } catch {
    return null
  }
}
