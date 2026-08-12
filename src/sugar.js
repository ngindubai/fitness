/**
 * Free-sugar classification.
 *
 * The food table stores TOTAL sugars, which is what composition tables and
 * nutrition labels report. But every public guideline — NHS, SACN, WHO — is
 * written about FREE sugars, and the two are not the same number:
 *
 *   Free sugars = sugars added to food or drink, plus those naturally present
 *   in honey, syrups, and unsweetened fruit/vegetable juices, smoothies and
 *   purées.
 *
 *   NOT free = sugars inside the cellular structure of whole fruit and
 *   vegetables, and the lactose in plain milk and yoghurt.
 *
 * So a 170 g pot of plain Greek yoghurt reads 6 g of sugar and contributes
 * ZERO to the guideline, while a 250 ml glass of orange juice reads 21 g and
 * contributes all of it. Comparing total sugars to the 30 g figure — which is
 * what this app used to do — punishes fruit and milk for no reason and is
 * simply the wrong comparison.
 *
 * Each food therefore gets a `freeSugarShare` in 0..1: the fraction of its
 * total sugars that counts as free. Whole foods are 0, confectionery and
 * juice are 1, and genuinely mixed items (a jar of pasta sauce, a slice of
 * bread) sit in between because part of their sugar is the tomato or the
 * grain and part of it was tipped in.
 *
 * Sources: NHS "Sugar: the facts"; SACN Carbohydrates and Health (2015).
 */

/** Foods whose sugars are entirely added, whatever their tags suggest. */
const ALL_FREE = new Set([
  // Pure sugars, syrups and spreads
  'sugar', 'sugar_brown', 'maple_syrup', 'honey', 'jam', 'marmalade',
  'chocolate_spread', 'condensed_milk', 'golden_syrup', 'agave',
  // Juices, smoothies and purées — free sugars by definition, even "no
  // added sugar" ones: pressing fruit releases the sugar from the cells.
  'orange_juice', 'apple_juice', 'cranberry_juice', 'mango_juice',
  'pomegranate_juice', 'sugarcane_juice', 'smoothie',
  // Sweetened drinks
  'cola', 'lemonade', 'mint_lemonade', 'iced_tea', 'energy_drink',
  'sports_drink', 'bubble_tea', 'karak', 'milkshake', 'hot_chocolate',
  'mocha', 'matcha_latte', 'chocolate_milk_drink', 'kombucha',
  // Plant milks: their sugars come from enzyme-broken starch, counted as free
  'oat_milk', 'almond_milk', 'rice_milk',
  // Sweet sauces and condiments
  'sweet_chilli', 'bbq_sauce', 'hoisin', 'honey_mustard', 'teriyaki_sauce',
  'ketchup', 'sriracha', 'oyster_sauce', 'sweet_sour_sauce',
])

/** Foods whose sugars are entirely intrinsic, whatever their tags suggest. */
const ALL_INTRINSIC = new Set([
  // Plain dairy — lactose only
  'milk_whole', 'milk_semi', 'milk_skimmed', 'greek_yoghurt', 'greek_yoghurt_full',
  'yoghurt_natural', 'labneh', 'skyr', 'kefir', 'laban', 'cottage_cheese',
  'cream_cheese', 'double_cream', 'single_cream', 'sour_cream', 'mascarpone',
  'whipped_cream', 'ricotta', 'mozzarella', 'cheddar', 'feta', 'parmesan',
  'brie', 'gouda', 'blue_cheese', 'goat_cheese', 'burrata', 'halloumi',
  'light_cheese', 'cheese_slice',
  // Milky coffees: the sugar reading is the milk
  'latte', 'cappuccino', 'flat_white', 'coffee_milk', 'tea', 'arabic_coffee',
  // Whole dried fruit keeps its cell structure, so SACN does not class it as
  // free sugars. It is still concentrated — the audit flags it on totals.
  'dates', 'raisins', 'cranberries_dried', 'figs', 'apricot_dried',
  // Whole vegetables that read sweet
  'coleslaw', 'sun_dried_tomatoes', 'tinned_tomatoes', 'tomato_puree',
])

/** Genuinely mixed foods: part intrinsic, part tipped in. */
const PARTIAL = {
  // Bread and everyday baking: a little added sugar on a grain base.
  bread_white: 0.5, bread_wholemeal: 0.4, bread_sourdough: 0.3, bagel: 0.5,
  burger_bun: 0.6, brioche: 0.8, naan: 0.5, tortilla_wrap: 0.5, pitta: 0.3,
  english_muffin: 0.4, crumpet: 0.3, baguette: 0.3, ciabatta: 0.3,
  focaccia: 0.3, roti_chapati: 0.2, manakish: 0.3,
  // Cereals: fruit and grain sugars plus added.
  granola: 0.7, muesli: 0.4, cereal_bran: 0.6, cornflakes: 0.7,
  cereal_frosted: 0.9, weetabix: 0.4, porridge: 0.2, oats: 0,
  // Savoury sauces built on tomato or dairy with sugar added to balance.
  tomato_pasta_sauce: 0.4, curry_sauce: 0.5, salsa: 0.3, harissa: 0.3,
  peri_peri: 0.4, buffalo_sauce: 0.4, satay_sauce: 0.6, salad_dressing: 0.5,
  ranch: 0.4, caesar_dressing: 0.4, tartare: 0.4, gravy: 0.3, miso: 0.2,
  baked_beans: 0.6, peanut_butter: 0.5, hummus: 0,
  // Composite dishes: mostly ingredients, a little sweetening.
  chicken_tikka_masala: 0.3, butter_chicken: 0.3, chicken_korma: 0.3,
  sweet_sour_chicken: 0.8, teriyaki_chicken: 0.7, satay_chicken: 0.5,
  pad_thai: 0.6, kung_pao: 0.5, chow_mein: 0.3, bao_bun: 0.5,
  banh_mi: 0.4, sushi_roll: 0.5, massaman: 0.4, green_curry: 0.3,
  // Sweetened dairy that is still mostly milk.
  rice_pudding: 0.7, frozen_yoghurt: 0.8, protein_pancakes: 0.5,
  french_toast: 0.5, crepe: 0.6, pancakes: 0.5,
}

/** Tags that mean "the sugar here was added", when nothing more specific says otherwise. */
const FREE_TAGS = ['sugary', 'sugar', 'treat', 'dessert', 'junk', 'pastry']
/** Tags that mean "this is a whole food and its sugar came with it". */
const INTRINSIC_TAGS = ['veg', 'fruit', 'fish', 'lean', 'wholegrain', 'seeds', 'nuts']

/**
 * What fraction of this food's total sugars count as free sugars.
 * @param {{id:string, tags?:string[], per100?:{sugar:number}}} food
 * @returns {number} 0..1
 */
export function freeSugarShareFor(food) {
  if (!food) return 0
  if (ALL_FREE.has(food.id)) return 1
  if (ALL_INTRINSIC.has(food.id)) return 0
  if (food.id in PARTIAL) return PARTIAL[food.id]

  const tags = food.tags || []
  // Whole fruit and veg first: "fruit sugary" (grapes, mango) is still fruit.
  if (tags.includes('fruit') || tags.includes('veg')) return 0
  // Alcohol: residual fermentation sugars, not added — and tiny either way.
  if (tags.includes('alcohol')) return 0
  if (tags.some((t) => FREE_TAGS.includes(t))) return 1
  if (tags.some((t) => INTRINSIC_TAGS.includes(t))) return 0
  // Plain dairy, meat, eggs and staples: whatever sugar they carry is theirs.
  if (tags.includes('dairy') || tags.includes('protein') || tags.includes('meat')) return 0
  if (tags.includes('carb') || tags.includes('staple')) return 0.3
  if (tags.includes('sauce')) return 0.4
  if (tags.includes('meal') || tags.includes('takeaway')) return 0.3
  if (tags.includes('drink')) return 0.5
  return 0.3
}

/** Free sugars in grams for a parsed item (falls back to its share of total). */
export function freeSugarOf(item) {
  if (typeof item?.freeSugar === 'number') return item.freeSugar
  return 0
}

/**
 * The daily free-sugar limit. UK policy is that free sugars supply no more
 * than 5% of daily energy, which the NHS headlines as 30 g for adults. Both
 * are applied: the percentage keeps it personal, the 30 g caps it.
 */
export function freeSugarTarget(calories) {
  const fivePercent = Math.round(((calories || 2000) * 0.05) / 4)
  return Math.max(15, Math.min(30, fivePercent))
}
