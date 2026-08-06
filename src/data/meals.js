/**
 * Meal templates used by the recommender.
 *
 * Each meal is a list of real foods with real weights, so its macros are
 * computed from the same database that scores your logged meals. Nothing here
 * is a vague suggestion like "have some chicken and veg" - if the app tells you
 * to eat something, it can tell you exactly what it costs you.
 *
 * Row format: [id, name, slot, components, tags, effortMinutes]
 *   components: "foodId:grams|foodId:grams"
 *   slot:       breakfast | lunch | dinner | snack
 */

// prettier-ignore
const ROWS = [
  // ------------------------------------------------------------- breakfast
  ['b_oats_whey', 'Protein porridge with berries', 'breakfast',
    'oats:60|milk_semi:250|whey_protein:25|berries_mixed:80', 'highprotein quick fibre budget', 8],
  ['b_eggs_toast', 'Scrambled eggs on wholemeal toast', 'breakfast',
    'egg:150|bread_wholemeal:72|butter:7|tomato:90', 'highprotein quick classic', 10],
  ['b_greek_granola', 'Greek yoghurt, granola and blueberries', 'breakfast',
    'greek_yoghurt:200|granola:35|blueberries:80', 'highprotein quick noprep', 3],
  ['b_omelette_cheese', 'Three-egg omelette with cheese and mushrooms', 'breakfast',
    'egg:150|cheddar:25|mushroom:80|olive_oil:7', 'highprotein lowcarb quick', 10],
  ['b_full_lean', 'Lean cooked breakfast', 'breakfast',
    'egg:100|bacon:50|baked_beans:200|mushroom:80|tomato:90|bread_wholemeal:36', 'highprotein classic weekend', 20],
  ['b_smoked_salmon_bagel', 'Smoked salmon and cream cheese bagel', 'breakfast',
    'bagel:95|smoked_salmon:70|cream_cheese:30|cucumber:40', 'highprotein omega3 quick', 5],
  ['b_shake_banana', 'Banana and peanut butter shake', 'breakfast',
    'whey_protein:30|milk_semi:300|banana:118|peanut_butter:16', 'highprotein quick portable', 3],
  ['b_cottage_toast', 'Cottage cheese on sourdough with tomato', 'breakfast',
    'cottage_cheese:150|bread_sourdough:100|tomato:90|olive_oil:5', 'highprotein quick budget', 5],
  ['b_overnight_oats', 'Overnight oats with chia and berries', 'breakfast',
    'oats:60|greek_yoghurt:150|chia:12|berries_mixed:80', 'highprotein fibre prepahead', 5],
  ['b_avocado_eggs', 'Poached eggs and avocado on toast', 'breakfast',
    'egg:100|avocado:75|bread_wholemeal:72', 'quick fibre veggie', 12],

  // ------------------------------------------------------------------ lunch
  ['l_chicken_rice_bowl', 'Chicken, rice and roasted veg bowl', 'lunch',
    'chicken_breast:170|rice_brown_cooked:180|broccoli:120|pepper_bell:80|olive_oil:10', 'highprotein mealprep balanced', 25],
  ['l_tuna_jacket', 'Tuna jacket potato with salad', 'lunch',
    'potato_jacket:280|tuna_tinned:112|mayonnaise:15|lettuce:60|cucumber:50', 'highprotein budget quick', 15],
  ['l_chicken_wrap', 'Chicken and salad wrap', 'lunch',
    'tortilla_wrap:62|chicken_breast:120|lettuce:40|tomato:60|hummus:30', 'highprotein quick portable', 8],
  ['l_lentil_soup', 'Lentil and vegetable soup with bread', 'lunch',
    'lentils:200|carrot:80|onion:60|bread_wholemeal:72|olive_oil:10', 'fibre veggie budget prepahead', 30],
  ['l_salmon_salad', 'Salmon, quinoa and greens salad', 'lunch',
    'salmon:140|quinoa_cooked:150|spinach:60|cucumber:60|olive_oil:10', 'highprotein omega3 balanced', 20],
  ['l_chicken_pasta', 'Chicken pesto pasta', 'lunch',
    'pasta_wholewheat:200|chicken_breast:140|pesto:25|tomato:90', 'highprotein mealprep', 20],
  ['l_burrito_bowl', 'Chicken burrito bowl', 'lunch',
    'chicken_thigh:150|rice_white_cooked:150|black_beans:120|pepper_bell:80|avocado:50', 'highprotein fibre balanced', 25],
  ['l_prawn_noodles', 'Prawn and vegetable noodles', 'lunch',
    'prawns:150|noodles_egg:180|green_beans:80|pepper_bell:80|soy_sauce:16', 'highprotein quick lowfat', 15],
  ['l_egg_salad_pitta', 'Egg salad pitta', 'lunch',
    'pitta:60|egg:150|mayonnaise:15|lettuce:40', 'highprotein quick budget', 10],
  ['l_chickpea_salad', 'Chickpea, feta and tomato salad', 'lunch',
    'chickpeas:180|feta:50|tomato:120|cucumber:80|olive_oil:12', 'veggie fibre noprep', 10],
  ['l_leftover_chilli', 'Beef chilli with rice', 'lunch',
    'beef_mince_5:150|kidney_beans:130|tomato_pasta_sauce:125|rice_brown_cooked:180', 'highprotein mealprep fibre', 35],
  ['l_ham_sandwich', 'Ham and cheese sandwich with fruit', 'lunch',
    'bread_wholemeal:72|ham:56|cheddar:30|lettuce:30|apple:180', 'quick budget portable', 5],

  // ----------------------------------------------------------------- dinner
  ['d_steak_potatoes', 'Steak with new potatoes and greens', 'dinner',
    'steak_sirloin:200|potato_boiled:200|asparagus:100|butter:10', 'highprotein classic', 25],
  ['d_salmon_sweet_potato', 'Baked salmon, sweet potato and broccoli', 'dinner',
    'salmon:150|sweet_potato:200|broccoli:120|olive_oil:10', 'highprotein omega3 balanced', 30],
  ['d_chicken_stirfry', 'Chicken and vegetable stir fry with rice', 'dinner',
    'chicken_breast:180|rice_white_cooked:180|pepper_bell:100|green_beans:80|soy_sauce:16|vegetable_oil:10', 'highprotein quick', 20],
  ['d_spag_bol', 'Spaghetti bolognese', 'dinner',
    'pasta_wholewheat:200|beef_mince_5:150|tomato_pasta_sauce:150|onion:60|parmesan:15', 'highprotein classic mealprep', 35],
  ['d_curry_chicken', 'Chicken curry with rice', 'dinner',
    'chicken_thigh:180|curry_sauce:150|rice_white_cooked:180|spinach:60', 'highprotein classic', 30],
  ['d_cod_potatoes', 'Baked cod with crushed potatoes and peas', 'dinner',
    'cod:180|potato_boiled:220|peas:100|olive_oil:10', 'highprotein lowfat lean', 30],
  ['d_pork_veg', 'Pork chop with roasted vegetables', 'dinner',
    'pork_chop:170|courgette:150|pepper_bell:100|potato_boiled:180|olive_oil:12', 'highprotein balanced', 35],
  ['d_turkey_meatballs', 'Turkey meatballs with tomato pasta', 'dinner',
    'turkey_breast:180|pasta_wholewheat:180|tomato_pasta_sauce:150|parmesan:15', 'highprotein lean mealprep', 30],
  ['d_tofu_stirfry', 'Tofu and edamame stir fry', 'dinner',
    'tofu:200|edamame:100|rice_brown_cooked:180|pepper_bell:80|soy_sauce:16|vegetable_oil:10', 'veggie highprotein fibre', 20],
  ['d_lamb_couscous', 'Lamb with couscous and salad', 'dinner',
    'lamb_chop:150|couscous_cooked:180|tomato:90|cucumber:60|olive_oil:10', 'highprotein classic', 25],
  ['d_fish_pie_light', 'Salmon and cod with mash and greens', 'dinner',
    'salmon:100|cod:100|potato_mash:220|green_beans:100', 'highprotein comfort', 40],
  ['d_chicken_traybake', 'Chicken and chickpea traybake', 'dinner',
    'chicken_thigh:200|chickpeas:150|pepper_bell:120|courgette:120|olive_oil:14', 'highprotein fibre onepan', 40],
  ['d_mackerel_salad', 'Grilled mackerel with warm potato salad', 'dinner',
    'mackerel:150|potato_boiled:200|spinach:60|mustard:10|olive_oil:8', 'omega3 highprotein', 25],
  ['d_beef_stirfry', 'Beef and broccoli with noodles', 'dinner',
    'mince_beef_cooked:170|broccoli:150|noodles_egg:180|soy_sauce:16|vegetable_oil:10', 'highprotein quick', 20],
  ['d_veggie_chilli', 'Bean chilli with rice', 'dinner',
    'black_beans:150|kidney_beans:130|tomato_pasta_sauce:150|rice_brown_cooked:180|avocado:50', 'veggie fibre budget', 30],
  ['d_sea_bass_style', 'White fish with couscous and roasted veg', 'dinner',
    'haddock:180|couscous_cooked:180|courgette:120|tomato:90|olive_oil:12', 'lean highprotein', 30],

  // ------------------------------------------------------------------ snack
  ['s_greek_berries', 'Greek yoghurt with berries', 'snack',
    'greek_yoghurt:170|berries_mixed:80', 'highprotein quick lowcal', 2],
  ['s_apple_pb', 'Apple with peanut butter', 'snack',
    'apple:180|peanut_butter:20', 'quick fibre portable', 2],
  ['s_shake', 'Protein shake', 'snack',
    'whey_protein:30|milk_semi:250', 'highprotein quick portable', 2],
  ['s_boiled_eggs', 'Two boiled eggs', 'snack',
    'egg:100', 'highprotein lowcarb prepahead', 10],
  ['s_cottage_cucumber', 'Cottage cheese with cucumber', 'snack',
    'cottage_cheese:150|cucumber:80', 'highprotein lowcal quick', 3],
  ['s_almonds', 'Handful of almonds', 'snack',
    'almonds:30', 'quick portable noprep', 1],
  ['s_hummus_veg', 'Hummus with carrot and pepper', 'snack',
    'hummus:60|carrot:80|pepper_bell:80', 'fibre veggie quick', 3],
  ['s_tuna_crackers', 'Tuna with oatcakes', 'snack',
    'tuna_tinned:112|pretzels:30', 'highprotein quick', 3],
  ['s_popcorn', 'Plain popcorn', 'snack',
    'popcorn:30', 'lowcal fibre quick', 3],
  ['s_dark_choc', 'Dark chocolate and an orange', 'snack',
    'chocolate_dark:20|orange:150', 'treat lowcal quick', 1],
  ['s_edamame', 'Edamame with sea salt', 'snack',
    'edamame:120', 'highprotein fibre veggie quick', 5],
  ['s_protein_bar', 'Protein bar', 'snack',
    'protein_bar:60', 'highprotein portable noprep', 0],
  ['s_banana_shake', 'Banana and a scoop of whey', 'snack',
    'banana:118|whey_protein:25|milk_semi:200', 'highprotein postworkout quick', 3],
  ['s_smoked_salmon_oatcakes', 'Smoked salmon on rye', 'snack',
    'smoked_salmon:60|bread_sourdough:50', 'highprotein omega3 quick', 3],
]

/** @typedef {{id:string,name:string,slot:string,components:Array<{foodId:string,grams:number}>,tags:string[],effortMinutes:number}} MealTemplate */

/** @type {MealTemplate[]} */
export const MEAL_TEMPLATES = ROWS.map(([id, name, slot, components, tags, effortMinutes]) => ({
  id,
  name,
  slot,
  components: String(components)
    .split('|')
    .filter(Boolean)
    .map((part) => {
      const [foodId, grams] = part.split(':')
      return { foodId, grams: Number(grams) }
    }),
  tags: String(tags).split(/\s+/).filter(Boolean),
  effortMinutes,
}))

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']
