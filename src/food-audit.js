/**
 * Day-of-food audit: where the calories actually went and what to do about
 * it. Pure rules over the food table — no AI anywhere:
 *
 *   CUT   — discretionary items (junk, treats, desserts, sugary drinks,
 *           alcohol) where removing the item IS the fix. Saving = its kcal.
 *   SWAP  — a curated substitution map (like-for-like at the SAME logged
 *           portion), with the saving computed from the two foods' per-100g
 *           numbers, so every claim is arithmetic, not opinion.
 *   KEEP  — the best value item on the plate (protein per kcal), named so
 *           good choices get reinforced, not just bad ones punished.
 *   NOTE  — day-level patterns: protein/fibre shortfalls, sugar load,
 *           alcohol units, and what the day would total if the advice
 *           was taken.
 */

import { FOODS_BY_ID } from './data/foods.js'

/**
 * Substitutions, best candidate first. Every pair is same-role food —
 * nobody is told to replace a burger with celery. Savings are computed at
 * the logged portion, and a swap is only shown when it actually saves
 * enough to matter (or buys meaningful protein).
 */
export const SWAPS = {
  // Meat & fish: leaner cut, same plate.
  beef_mince_20: ['beef_mince_5'],
  steak_ribeye: ['steak_sirloin', 'fillet_steak'],
  chicken_thigh: ['chicken_breast'],
  chicken_wing: ['chicken_breast'],
  chicken_drumstick: ['chicken_breast'],
  roast_chicken: ['chicken_breast'],
  pork_belly: ['pork_chop'],
  bacon: ['ham'],
  sausage_pork: ['turkey_mince'],
  battered_cod: ['cod'],
  fish_fingers: ['cod'],
  nuggets: ['chicken_breast'],

  // Dairy & fats.
  milk_whole: ['milk_semi'],
  greek_yoghurt_full: ['greek_yoghurt'],
  double_cream: ['single_cream'],
  whipped_cream: ['yoghurt_natural'],
  sour_cream: ['yoghurt_natural'],
  cream_cheese: ['cottage_cheese'],
  cheese_slice: ['light_cheese'],
  mayonnaise: ['yoghurt_natural', 'honey_mustard'],

  // Carbs: whole-grain or less-oiled version.
  bread_white: ['bread_wholemeal'],
  croissant: ['bread_wholemeal'],
  pain_au_chocolat: ['bread_wholemeal'],
  rice_white_cooked: ['rice_brown_cooked'],
  fried_rice: ['rice_brown_cooked'],
  pasta_cooked: ['pasta_wholewheat'],
  granola: ['porridge'],
  chips: ['potato_wedges', 'potato_jacket'],
  loaded_fries: ['potato_wedges'],
  roast_potatoes: ['potato_boiled'],
  potato_mash: ['potato_jacket'],

  // Takeaway & restaurant: the lighter order at the same shop.
  chicken_korma: ['chicken_tikka'],
  butter_chicken: ['chicken_tikka'],
  chicken_tikka_masala: ['chicken_tikka'],
  katsu_curry: ['teriyaki_chicken'],
  sweet_sour_chicken: ['teriyaki_chicken'],
  satay_chicken: ['teriyaki_chicken'],
  kebab_doner: ['shawarma_chicken'],
  big_burger: ['chicken_burger'],
  burger_cheese: ['chicken_burger'],
  pizza_pepperoni: ['pizza_cheese'],
  mac_cheese: ['pasta_bake'],
  steak_frites: ['fillet_steak'],

  // Snacks & sweet things: the version that halves the damage.
  crisps: ['popcorn'],
  tortilla_chips: ['popcorn'],
  chocolate_milk: ['chocolate_dark'],
  white_chocolate: ['chocolate_dark'],
  biscuits: ['oatcakes'],
  cookie: ['jaffa_cakes'],
  cake: ['jaffa_cakes'],
  doughnut: ['jaffa_cakes'],
  cheesecake: ['frozen_yoghurt'],
  apple_pie: ['frozen_yoghurt'],
  ice_cream: ['frozen_yoghurt'],
  rice_pudding: ['greek_yoghurt'],
  milkshake: ['smoothie'],

  // Drinks: same ritual, fewer calories.
  cola: ['cola_diet'],
  energy_drink: ['cola_diet'],
  latte: ['coffee_milk'],
  hot_chocolate: ['coffee_milk'],
  orange_juice: ['orange'],
  beer_lager: ['guinness_zero'],
  beer_strong: ['guinness_zero'],
  guinness: ['guinness_zero'],
  guinness_extra: ['guinness_zero'],
  wine_white: ['prosecco'],
  rose_wine: ['prosecco'],
}

const CUT_TAGS = new Set(['junk', 'treat', 'dessert', 'alcohol'])

/**
 * Discrete items compare per ITEM, not per 100 g — one burger against one
 * burger, one doughnut against two jaffa cakes. The value is how many units
 * of the replacement stand in for ONE unit of the original.
 */
export const UNIT_BASIS = {
  big_burger: 1,
  burger_cheese: 1,
  doughnut: 2,
  cookie: 2,
  cake: 2,
  // A bar of milk chocolate against two squares of dark: gram for gram dark
  // is MORE caloric — the entire saving is the portion, so it is priced as
  // one. That is the honest version of the classic advice.
  chocolate_milk: 2,
  white_chocolate: 1,
  // A glass of juice against the whole fruit: same sugars per 100 ml, but a
  // glass is 250 ml and an orange is one orange — with the fibre kept in.
  orange_juice: 1,
}

const round = (n) => Math.round(n)

function isCutWorthy(food, item) {
  if (!food || item.kcal < 80) return false
  const tags = food.tags || []
  if (tags.some((t) => CUT_TAGS.has(t))) return true
  if (tags.includes('sugary') && tags.includes('drink')) return true
  return false
}

/**
 * kcal (and macro deltas) of the swap. Weighable foods compare at the same
 * logged grams; discrete items (UNIT_BASIS) compare item-for-item.
 */
function swapMaths(item, from, to) {
  const grams = item.grams || from.unit.grams || 100
  const basisCount = UNIT_BASIS[from.id]
  if (basisCount) {
    const fromCount = Math.max(1, Math.round(grams / (from.unit.grams || grams)))
    const toGrams = fromCount * basisCount * (to.unit.grams || 100)
    return {
      saveKcal: round((item.kcal || 0) - (to.per100.kcal * toGrams) / 100),
      deltaProtein: round((to.per100.protein * toGrams) / 100 - (item.protein || 0)),
      deltaFibre: Math.round(((to.per100.fibre * toGrams) / 100 - (item.fibre || 0)) * 10) / 10,
      perItem: true,
    }
  }
  const scale = grams / 100
  return {
    saveKcal: round((from.per100.kcal - to.per100.kcal) * scale),
    deltaProtein: round((to.per100.protein - from.per100.protein) * scale),
    deltaFibre: Math.round((to.per100.fibre - from.per100.fibre) * scale * 10) / 10,
  }
}

/**
 * Audit one day's meals.
 * @param {Array} mealEntries entries of kind 'meal' (items carry foodId/kcal)
 * @param {object} day the built day (nutrition, targets, caloriesIn)
 * @returns {{findings:Array, potential:object, headline:string}}
 */
export function auditDay(mealEntries, day) {
  const items = mealEntries.flatMap((e) => e.items || [])
  const findings = []
  const flagged = new Set() // one finding per item name

  if (!items.length) {
    return {
      findings: [],
      potential: null,
      headline: 'Nothing logged yet — there is nothing to audit.',
    }
  }

  // Per-item passes, biggest calories first so the list leads with impact.
  const sorted = [...items].sort((a, b) => (b.kcal || 0) - (a.kcal || 0))
  for (const item of sorted) {
    const food = item.foodId ? FOODS_BY_ID.get(item.foodId) : null
    const key = (item.name || '').toLowerCase()
    if (flagged.has(key)) continue

    // SWAP beats CUT for the same item: gentler advice that survives contact
    // with real life. Only alcohol gets both framings via its note.
    const candidates = food ? (SWAPS[food.id] || []).map((id) => FOODS_BY_ID.get(id)).filter(Boolean) : []
    let best = null
    for (const to of candidates) {
      const maths = swapMaths(item, food, to)
      if (maths.saveKcal >= 40 || (maths.deltaProtein >= 8 && maths.saveKcal >= 0)) {
        best = { to, ...maths }
        break // candidates are ordered best-first
      }
    }
    if (best) {
      flagged.add(key)
      const gains = [
        best.saveKcal > 0 ? `save ~${best.saveKcal} kcal` : null,
        best.deltaProtein >= 5 ? `+${best.deltaProtein} g protein` : null,
        best.deltaFibre >= 2 ? `+${best.deltaFibre} g fibre` : null,
      ].filter(Boolean).join(', ')
      const basis = best.perItem
        ? (UNIT_BASIS[food.id] > 1 ? `${UNIT_BASIS[food.id]} of them for each one` : 'like for like')
        : 'Same portion'
      findings.push({
        kind: 'swap',
        item: item.name,
        itemKcal: round(item.kcal || 0),
        swapTo: best.to.name,
        saveKcal: Math.max(0, best.saveKcal),
        why: `${basis[0].toUpperCase()}${basis.slice(1)}, ${gains}.`,
      })
      continue
    }

    if (isCutWorthy(food, item)) {
      flagged.add(key)
      const isAlcohol = (food.tags || []).includes('alcohol')
      findings.push({
        kind: 'cut',
        item: item.name,
        itemKcal: round(item.kcal || 0),
        saveKcal: round(item.kcal || 0),
        why: isAlcohol
          ? `${round(item.kcal)} kcal that do nothing for recovery${item.units ? ` (and ${item.units} units)` : ''}. The zero-alcohol version keeps the ritual.`
          : `${round(item.kcal)} kcal of pure discretionary eating — nothing in it your day needs.`,
      })
      continue
    }

    // Fried food with no curated pair still deserves the honest generic.
    if (food && (food.tags || []).includes('fried') && item.kcal >= 150) {
      flagged.add(key)
      findings.push({
        kind: 'swap',
        item: item.name,
        itemKcal: round(item.kcal || 0),
        swapTo: null,
        saveKcal: round((item.kcal || 0) * 0.35),
        why: 'Fried. The grilled or baked version of the same dish usually costs about a third less.',
      })
    }
  }

  // HIGH FAT: name every item that is genuinely fat-heavy and say exactly
  // how much fat it carried at the logged portion — the number, not a vibe.
  // "High" = 17 g+ of fat in the portion, or fat supplying over 55% of the
  // item's calories with at least 10 g behind it.
  const fatty = sorted
    .filter((i) => {
      const fat = i.fat || 0
      const share = i.kcal > 0 ? (fat * 9) / i.kcal : 0
      return fat >= 17 || (share >= 0.55 && fat >= 10)
    })
    .sort((a, b) => (b.fat || 0) - (a.fat || 0))
    .slice(0, 6)
  for (const item of fatty) {
    const share = Math.round(((item.fat * 9) / item.kcal) * 100)
    findings.push({
      kind: 'fat',
      item: item.name,
      itemKcal: round(item.kcal || 0),
      fatG: Math.round((item.fat || 0) * 10) / 10,
      why: `${Math.round(item.fat)} g of fat in this portion — ${share}% of its ${round(item.kcal)} kcal. Shrink it, swap it, or make it the day's one indulgence.`,
    })
  }

  // KEEP: the best protein-per-calorie deal actually on the plate.
  const keeper = sorted
    .filter((i) => (i.protein || 0) >= 15 && i.kcal > 0)
    .sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)[0]
  if (keeper) {
    findings.push({
      kind: 'keep',
      item: keeper.name,
      itemKcal: round(keeper.kcal),
      why: `${round(keeper.protein)} g protein for ${round(keeper.kcal)} kcal — the best deal on today's plate. More of this.`,
    })
  }

  // Day-level notes from the totals.
  const n = day.nutrition
  const t = day.targets
  if (n.protein < t.protein * 0.8) {
    findings.push({
      kind: 'note',
      why: `Protein is ${round(t.protein - n.protein)} g short of your ${t.protein} g target — that is the first thing to fix, before any cutting.`,
    })
  }
  if (n.fibre < t.fibre * 0.6) {
    findings.push({
      kind: 'note',
      why: `Only ${round(n.fibre)} g fibre against a ${t.fibre} g target. Vegetables, oats, beans — pick one and add it.`,
    })
  }
  // Free sugars, not total: the NHS limit is about added sugar, honey,
  // syrups and juice — never the sugar inside whole fruit or plain milk.
  const freeSugar = n.freeSugar || 0
  if (freeSugar > t.freeSugar) {
    const worst = sorted
      .filter((i) => (i.freeSugar || 0) >= 8)
      .sort((a, b) => (b.freeSugar || 0) - (a.freeSugar || 0))
      .slice(0, 3)
      .map((i) => `${i.name} (${round(i.freeSugar)} g)`)
    findings.push({
      kind: 'note',
      why: `${round(freeSugar)} g of free sugars against the ${t.freeSugar} g NHS limit`
        + (worst.length ? ` — mostly ${worst.join(', ')}.` : '.')
        + ` Fruit and milk sugars are excluded, so this is all added sugar, syrup or juice.`,
    })
  }

  // The payoff line: what today becomes if the advice is taken.
  const totalSave = findings.filter((f) => f.kind === 'cut' || f.kind === 'swap')
    .reduce((sum, f) => sum + (f.saveKcal || 0), 0)
  const wouldBe = round(day.caloriesIn - totalSave)
  const potential = totalSave > 0
    ? {
        saveKcal: totalSave,
        caloriesIn: round(day.caloriesIn),
        wouldBe,
        target: t.calories,
        onTarget: wouldBe <= t.calories,
      }
    : null

  const actionable = findings.filter((f) => f.kind === 'cut' || f.kind === 'swap').length
  const headline = actionable
    ? `${round(day.caloriesIn).toLocaleString()} kcal in — ${actionable} change${actionable === 1 ? '' : 's'} would save ~${totalSave.toLocaleString()} kcal.`
    : `${round(day.caloriesIn).toLocaleString()} kcal in — nothing worth flagging. A clean day.`

  return { findings, potential, headline, fatTotal: round(n.fat || 0) }
}
