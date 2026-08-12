/**
 * Food reference database.
 *
 * Compact row format keeps this file reviewable:
 *   [id, name, aliases, kcal, protein, carbs, fat, fibre, sugar, unitName, unitGrams, tags]
 *
 * All macros are per 100 g (or per 100 ml for liquids).
 * `unitGrams` is the weight of one natural portion ("1 egg", "1 slice"), used
 * when someone logs "2 eggs" instead of "100g egg".
 *
 * Values are drawn from standard composition tables (USDA FoodData Central and
 * McCance & Widdowson for UK-specific items). They are reference averages —
 * good enough for trend tracking, not laboratory figures.
 */

import { freeSugarShareFor } from '../sugar.js'

// prettier-ignore
const ROWS = [
  // ---------------------------------------------------------------- poultry
  ['chicken_breast', 'Chicken breast (skinless)', 'chicken|chicken breast|grilled chicken|breast', 165, 31, 0, 3.6, 0, 0, 'breast', 174, 'protein lean meat'],
  ['chicken_thigh', 'Chicken thigh (skinless)', 'chicken thigh|thigh', 209, 26, 0, 10.9, 0, 0, 'thigh', 95, 'protein meat'],
  ['chicken_wing', 'Chicken wings', 'chicken wing|wings|buffalo wings', 290, 27, 0, 19.5, 0, 0, 'wing', 34, 'protein meat'],
  ['roast_chicken', 'Roast chicken (with skin)', 'roast chicken|rotisserie chicken', 220, 27, 0, 12.5, 0, 0, 'portion', 150, 'protein meat'],
  ['turkey_breast', 'Turkey breast', 'turkey|turkey breast', 135, 30, 0, 1, 0, 0, 'portion', 120, 'protein lean meat'],
  ['duck_breast', 'Duck breast', 'duck|duck breast', 201, 24, 0, 11, 0, 0, 'breast', 180, 'protein meat'],

  // ------------------------------------------------------------- red meat
  ['beef_mince_5', 'Beef mince (5% fat)', 'lean mince|beef mince|lean beef mince|5% mince', 137, 21, 0, 5, 0, 0, 'portion', 125, 'protein meat'],
  ['beef_mince_20', 'Beef mince (20% fat)', 'mince|ground beef|regular mince', 254, 17, 0, 20, 0, 0, 'portion', 125, 'protein meat'],
  ['steak_sirloin', 'Sirloin steak', 'steak|sirloin|sirloin steak', 206, 29, 0, 9.6, 0, 0, 'steak', 200, 'protein meat'],
  ['steak_ribeye', 'Ribeye steak', 'ribeye|rib eye|ribeye steak', 291, 24, 0, 21.8, 0, 0, 'steak', 250, 'protein meat'],
  ['beef_brisket', 'Beef brisket', 'brisket', 250, 26, 0, 16, 0, 0, 'portion', 150, 'protein meat'],
  ['pork_chop', 'Pork chop', 'pork|pork chop|chop', 231, 26, 0, 14, 0, 0, 'chop', 150, 'protein meat'],
  ['pork_belly', 'Pork belly', 'pork belly|belly pork', 518, 9.3, 0, 53, 0, 0, 'portion', 150, 'protein meat fatty'],
  ['bacon', 'Bacon (grilled)', 'bacon|rasher|rashers|streaky bacon|back bacon', 541, 37, 1.4, 42, 0, 0, 'rasher', 25, 'protein meat processed'],
  ['sausage_pork', 'Pork sausage', 'sausage|sausages|banger|bangers', 297, 13, 10, 23, 0.7, 1.5, 'sausage', 57, 'protein meat processed'],
  ['lamb_chop', 'Lamb chop', 'lamb|lamb chop', 294, 25, 0, 21, 0, 0, 'chop', 120, 'protein meat'],
  ['ham', 'Ham (sliced)', 'ham|sliced ham|gammon', 145, 21, 1.5, 5.5, 0, 1.2, 'slice', 28, 'protein meat processed'],
  ['salami', 'Salami', 'salami|pepperoni', 407, 22, 2.4, 34, 0, 0.7, 'slice', 10, 'protein meat processed'],
  ['mince_beef_cooked', 'Beef, stewing (cooked)', 'stewing beef|beef stew meat|braising steak', 217, 30, 0, 10.5, 0, 0, 'portion', 150, 'protein meat'],

  // ------------------------------------------------------------------ fish
  ['salmon', 'Salmon fillet', 'salmon|salmon fillet', 208, 20, 0, 13, 0, 0, 'fillet', 140, 'protein fish omega3'],
  ['smoked_salmon', 'Smoked salmon', 'smoked salmon|lox', 117, 18, 0, 4.3, 0, 0, 'portion', 50, 'protein fish omega3'],
  ['tuna_tinned', 'Tuna (tinned in water)', 'tuna|tinned tuna|canned tuna', 116, 26, 0, 0.8, 0, 0, 'tin', 112, 'protein fish lean'],
  ['tuna_steak', 'Tuna steak', 'tuna steak|fresh tuna', 144, 30, 0, 1, 0, 0, 'steak', 150, 'protein fish lean'],
  ['cod', 'Cod fillet', 'cod|white fish|cod fillet', 82, 18, 0, 0.7, 0, 0, 'fillet', 150, 'protein fish lean'],
  ['haddock', 'Haddock', 'haddock', 90, 20, 0, 0.6, 0, 0, 'fillet', 150, 'protein fish lean'],
  ['mackerel', 'Mackerel', 'mackerel', 205, 19, 0, 13.9, 0, 0, 'fillet', 100, 'protein fish omega3'],
  ['sardines', 'Sardines (tinned)', 'sardines|tinned sardines', 208, 25, 0, 11.5, 0, 0, 'tin', 90, 'protein fish omega3'],
  ['prawns', 'Prawns', 'prawns|shrimp|king prawns', 99, 24, 0.2, 0.3, 0, 0, 'portion', 100, 'protein fish lean'],
  ['fish_fingers', 'Fish fingers', 'fish fingers|fish sticks', 220, 12, 19, 11, 1.2, 1, 'finger', 28, 'protein processed'],
  ['battered_cod', 'Battered cod (fried)', 'battered cod|fried fish|fish and chips fish', 247, 16, 15, 14, 0.6, 0.5, 'fillet', 200, 'protein fried'],

  // ---------------------------------------------------------- eggs & dairy
  ['egg', 'Egg (whole)', 'egg|eggs|boiled egg|poached egg|scrambled egg', 143, 12.6, 0.7, 9.5, 0, 0.4, 'egg', 50, 'protein breakfast'],
  ['egg_white', 'Egg white', 'egg white|egg whites', 52, 11, 0.7, 0.2, 0, 0.7, 'white', 33, 'protein lean'],
  ['milk_whole', 'Whole milk', 'whole milk|full fat milk|milk', 61, 3.2, 4.8, 3.3, 0, 4.8, 'glass', 250, 'dairy drink'],
  ['milk_semi', 'Semi-skimmed milk', 'semi skimmed milk|semi-skimmed|2% milk|skimmed milk', 47, 3.5, 4.8, 1.7, 0, 4.8, 'glass', 250, 'dairy drink'],
  ['greek_yoghurt', 'Greek yoghurt (0% fat)', 'greek yoghurt|greek yogurt|fat free yoghurt|yoghurt|yogurt', 59, 10, 3.6, 0.4, 0, 3.6, 'pot', 170, 'protein dairy breakfast'],
  ['greek_yoghurt_full', 'Greek yoghurt (full fat)', 'full fat greek yoghurt|full fat yoghurt', 97, 9, 4, 5, 0, 4, 'pot', 170, 'protein dairy'],
  ['cheddar', 'Cheddar cheese', 'cheddar|cheese|grated cheese', 416, 25, 0.1, 34.9, 0, 0.1, 'slice', 30, 'dairy fatty'],
  ['mozzarella', 'Mozzarella', 'mozzarella', 280, 22, 2.2, 20, 0, 1, 'ball', 125, 'dairy'],
  ['feta', 'Feta cheese', 'feta', 264, 14, 4.1, 21, 0, 4.1, 'portion', 30, 'dairy'],
  ['parmesan', 'Parmesan', 'parmesan|parmigiano', 431, 38, 4.1, 29, 0, 0.9, 'portion', 15, 'dairy'],
  ['cream_cheese', 'Cream cheese', 'cream cheese|philadelphia', 342, 6, 4.1, 34, 0, 3.2, 'portion', 30, 'dairy fatty'],
  ['cottage_cheese', 'Cottage cheese', 'cottage cheese', 98, 11, 3.4, 4.3, 0, 2.7, 'pot', 150, 'protein dairy'],
  ['butter', 'Butter', 'butter', 717, 0.9, 0.1, 81, 0, 0.1, 'pat', 10, 'fat'],
  ['double_cream', 'Double cream', 'double cream|heavy cream', 449, 1.7, 2.7, 48, 0, 2.7, 'portion', 30, 'dairy fatty'],

  // ------------------------------------------------------- grains & breads
  ['bread_white', 'White bread', 'white bread|bread|toast|white toast|slice of bread', 265, 9, 49, 3.2, 2.7, 5, 'slice', 36, 'carb'],
  ['bread_wholemeal', 'Wholemeal bread', 'wholemeal bread|wholemeal toast|brown bread|brown toast|wholegrain bread|wholegrain toast|wholewheat bread|granary|seeded bread', 247, 13, 41, 3.4, 7, 4.3, 'slice', 36, 'carb fibre'],
  ['bread_sourdough', 'Sourdough bread', 'sourdough', 289, 12, 56, 1.8, 2.4, 2.5, 'slice', 50, 'carb'],
  ['bagel', 'Bagel', 'bagel', 250, 10, 48, 1.5, 2, 5, 'bagel', 95, 'carb'],
  ['croissant', 'Croissant', 'croissant', 406, 8, 46, 21, 2.6, 11, 'croissant', 60, 'carb pastry treat'],
  ['rice_white_cooked', 'White rice (cooked)', 'rice|white rice|boiled rice|basmati', 130, 2.7, 28, 0.3, 0.4, 0.1, 'portion', 180, 'carb'],
  ['rice_brown_cooked', 'Brown rice (cooked)', 'brown rice|wholegrain rice', 123, 2.7, 26, 1, 1.6, 0.4, 'portion', 180, 'carb fibre'],
  ['pasta_cooked', 'Pasta (cooked)', 'pasta|spaghetti|penne|fusilli|tagliatelle', 158, 5.8, 31, 0.9, 1.8, 0.6, 'portion', 220, 'carb'],
  ['pasta_wholewheat', 'Wholewheat pasta (cooked)', 'wholewheat pasta|wholemeal pasta|brown pasta', 124, 5.3, 27, 0.5, 4.5, 0.6, 'portion', 220, 'carb fibre'],
  ['noodles_egg', 'Egg noodles (cooked)', 'noodles|egg noodles', 138, 4.5, 25, 2.1, 1.2, 0.4, 'portion', 180, 'carb'],
  ['oats', 'Porridge oats (dry)', 'oats|oatmeal|rolled oats|dry oats', 379, 13, 68, 6.5, 10, 1, 'serving', 40, 'carb fibre breakfast'],
  ['granola', 'Granola', 'granola', 471, 10, 64, 20, 7, 21, 'serving', 50, 'carb breakfast sugary'],
  ['cereal_bran', 'Bran flakes', 'bran flakes|branflakes|fibre cereal', 330, 10, 67, 2, 15, 16, 'bowl', 40, 'carb fibre breakfast'],
  ['cereal_frosted', 'Frosted flakes', 'frosted flakes|frosties|sugary cereal|coco pops', 384, 4.5, 89, 0.6, 1.5, 37, 'bowl', 40, 'carb breakfast sugary'],
  ['weetabix', 'Weetabix', 'weetabix', 362, 12, 69, 2, 10, 4.4, 'biscuit', 19, 'carb fibre breakfast'],
  ['couscous_cooked', 'Couscous (cooked)', 'couscous', 112, 3.8, 23, 0.2, 1.4, 0.1, 'portion', 180, 'carb'],
  ['quinoa_cooked', 'Quinoa (cooked)', 'quinoa', 120, 4.4, 21, 1.9, 2.8, 0.9, 'portion', 180, 'carb fibre'],
  ['tortilla_wrap', 'Tortilla wrap', 'wrap|tortilla|flour tortilla', 310, 8, 52, 7, 3, 2, 'wrap', 62, 'carb'],
  ['pitta', 'Pitta bread', 'pitta|pita|pitta bread', 275, 9, 55, 1.2, 2.2, 1.6, 'pitta', 60, 'carb'],
  ['naan', 'Naan bread', 'naan|naan bread', 336, 9, 50, 11, 2.2, 3.2, 'naan', 90, 'carb'],
  ['potato_boiled', 'Potato (boiled)', 'potato|potatoes|boiled potato|new potatoes', 87, 1.8, 20, 0.1, 1.8, 0.9, 'potato', 150, 'carb'],
  ['potato_jacket', 'Jacket potato', 'jacket potato|baked potato', 93, 2.5, 21, 0.1, 2.2, 1.2, 'potato', 250, 'carb'],
  ['potato_mash', 'Mashed potato (with butter)', 'mash|mashed potato', 113, 2, 17, 4.2, 1.5, 1.5, 'portion', 200, 'carb'],
  ['chips', 'Chips / fries (deep fried)', 'chips|fries|french fries', 312, 3.4, 41, 15, 3.8, 0.3, 'portion', 165, 'carb fried treat'],
  ['sweet_potato', 'Sweet potato (baked)', 'sweet potato|sweet potatoes', 90, 2, 21, 0.1, 3.3, 6.5, 'potato', 150, 'carb fibre'],
  ['hash_brown', 'Hash brown', 'hash brown|hash browns', 265, 3, 31, 14, 2.5, 0.5, 'piece', 55, 'carb fried'],

  // ------------------------------------------------- legumes, nuts & seeds
  ['baked_beans', 'Baked beans', 'baked beans|beans on toast beans', 78, 4.7, 12.9, 0.6, 3.7, 5, 'half tin', 205, 'carb protein fibre'],
  ['black_beans', 'Black beans (cooked)', 'black beans', 132, 8.9, 24, 0.5, 8.7, 0.3, 'portion', 130, 'protein fibre'],
  ['chickpeas', 'Chickpeas (cooked)', 'chickpeas|garbanzo', 164, 8.9, 27, 2.6, 7.6, 4.8, 'portion', 130, 'protein fibre'],
  ['lentils', 'Lentils (cooked)', 'lentils|red lentils|puy lentils', 116, 9, 20, 0.4, 7.9, 1.8, 'portion', 150, 'protein fibre'],
  ['kidney_beans', 'Kidney beans (cooked)', 'kidney beans', 127, 8.7, 23, 0.5, 6.4, 0.3, 'portion', 130, 'protein fibre'],
  ['hummus', 'Hummus', 'hummus|houmous', 166, 7.9, 14, 9.6, 6, 0.3, 'portion', 50, 'fat protein'],
  ['peanut_butter', 'Peanut butter', 'peanut butter|pb', 588, 25, 20, 50, 6, 9, 'tbsp', 16, 'fat protein'],
  ['peanuts', 'Peanuts', 'peanuts', 567, 26, 16, 49, 8.5, 4.7, 'handful', 30, 'fat protein snack'],
  ['almonds', 'Almonds', 'almonds|almond', 579, 21, 22, 50, 12.5, 4.4, 'handful', 30, 'fat protein snack'],
  ['walnuts', 'Walnuts', 'walnuts', 654, 15, 14, 65, 6.7, 2.6, 'handful', 30, 'fat snack omega3'],
  ['cashews', 'Cashews', 'cashews|cashew nuts', 553, 18, 30, 44, 3.3, 5.9, 'handful', 30, 'fat protein snack'],
  ['mixed_nuts', 'Mixed nuts', 'mixed nuts|nuts', 607, 20, 21, 54, 7, 4.2, 'handful', 30, 'fat protein snack'],
  ['chia', 'Chia seeds', 'chia|chia seeds', 486, 17, 42, 31, 34, 0, 'tbsp', 12, 'fat fibre omega3'],
  ['tofu', 'Tofu (firm)', 'tofu', 144, 17, 2.8, 8.7, 2.3, 0.6, 'portion', 100, 'protein veg'],
  ['tempeh', 'Tempeh', 'tempeh', 192, 20, 7.6, 11, 0, 0, 'portion', 100, 'protein veg'],
  ['edamame', 'Edamame', 'edamame|soy beans', 121, 12, 8.9, 5.2, 5.2, 2.2, 'portion', 100, 'protein fibre veg'],

  // ------------------------------------------------------------ vegetables
  ['broccoli', 'Broccoli', 'broccoli', 35, 2.4, 7.2, 0.4, 3.3, 1.4, 'portion', 85, 'veg fibre'],
  ['spinach', 'Spinach', 'spinach', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 'portion', 80, 'veg fibre'],
  ['kale', 'Kale', 'kale', 49, 4.3, 8.8, 0.9, 3.6, 2.3, 'portion', 80, 'veg fibre'],
  ['carrot', 'Carrot', 'carrot|carrots', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 'carrot', 60, 'veg fibre'],
  ['tomato', 'Tomato', 'tomato|tomatoes', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 'tomato', 90, 'veg'],
  ['cucumber', 'Cucumber', 'cucumber', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 'portion', 80, 'veg'],
  ['lettuce', 'Lettuce / salad leaves', 'lettuce|salad|salad leaves|mixed leaves', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 'portion', 60, 'veg'],
  ['onion', 'Onion', 'onion|onions', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 'onion', 110, 'veg'],
  ['pepper_bell', 'Bell pepper', 'pepper|peppers|bell pepper|red pepper', 31, 1, 6, 0.3, 2.1, 4.2, 'pepper', 120, 'veg fibre'],
  ['mushroom', 'Mushrooms', 'mushroom|mushrooms', 22, 3.1, 3.3, 0.3, 1, 2, 'portion', 80, 'veg'],
  ['courgette', 'Courgette', 'courgette|zucchini', 17, 1.2, 3.1, 0.3, 1, 2.5, 'courgette', 200, 'veg'],
  ['aubergine', 'Aubergine', 'aubergine|eggplant', 25, 1, 6, 0.2, 3, 3.5, 'portion', 100, 'veg fibre'],
  ['peas', 'Peas', 'peas|garden peas', 81, 5.4, 14, 0.4, 5.7, 5.7, 'portion', 80, 'veg fibre'],
  ['sweetcorn', 'Sweetcorn', 'sweetcorn|corn', 86, 3.3, 19, 1.4, 2, 3.2, 'portion', 80, 'veg'],
  ['green_beans', 'Green beans', 'green beans|runner beans', 31, 1.8, 7, 0.1, 2.7, 3.3, 'portion', 80, 'veg fibre'],
  ['cauliflower', 'Cauliflower', 'cauliflower', 25, 1.9, 5, 0.3, 2, 1.9, 'portion', 85, 'veg fibre'],
  ['cabbage', 'Cabbage', 'cabbage', 25, 1.3, 5.8, 0.1, 2.5, 3.2, 'portion', 80, 'veg fibre'],
  ['asparagus', 'Asparagus', 'asparagus', 20, 2.2, 3.9, 0.1, 2.1, 1.9, 'portion', 80, 'veg fibre'],
  ['avocado', 'Avocado', 'avocado', 160, 2, 8.5, 14.7, 6.7, 0.7, 'avocado', 150, 'fat fibre'],
  ['coleslaw', 'Coleslaw', 'coleslaw', 152, 1.2, 12, 11, 1.5, 9, 'portion', 60, 'veg fatty'],

  // ---------------------------------------------------------------- fruits
  ['banana', 'Banana', 'banana|bananas', 89, 1.1, 23, 0.3, 2.6, 12, 'banana', 118, 'fruit carb'],
  ['apple', 'Apple', 'apple|apples', 52, 0.3, 14, 0.2, 2.4, 10, 'apple', 180, 'fruit fibre'],
  ['orange', 'Orange', 'orange|oranges', 47, 0.9, 12, 0.1, 2.4, 9, 'orange', 150, 'fruit fibre'],
  ['berries_mixed', 'Mixed berries', 'berries|mixed berries', 43, 1.1, 10, 0.4, 4.5, 5.5, 'portion', 100, 'fruit fibre'],
  ['blueberries', 'Blueberries', 'blueberries', 57, 0.7, 14, 0.3, 2.4, 10, 'portion', 100, 'fruit'],
  ['strawberries', 'Strawberries', 'strawberries', 32, 0.7, 7.7, 0.3, 2, 4.9, 'portion', 100, 'fruit fibre'],
  ['grapes', 'Grapes', 'grapes', 69, 0.7, 18, 0.2, 0.9, 16, 'portion', 100, 'fruit sugary'],
  ['pineapple', 'Pineapple', 'pineapple', 50, 0.5, 13, 0.1, 1.4, 10, 'portion', 100, 'fruit'],
  ['mango', 'Mango', 'mango', 60, 0.8, 15, 0.4, 1.6, 14, 'portion', 165, 'fruit sugary'],
  ['pear', 'Pear', 'pear|pears', 57, 0.4, 15, 0.1, 3.1, 10, 'pear', 178, 'fruit fibre'],
  ['melon', 'Melon', 'melon|honeydew|cantaloupe|rockmelon', 34, 0.6, 8, 0.2, 0.9, 8, 'portion', 150, 'fruit'],
  ['dates', 'Dates', 'dates|medjool dates', 277, 1.8, 75, 0.2, 6.7, 66, 'date', 24, 'fruit sugary'],
  ['raisins', 'Raisins', 'raisins|sultanas', 299, 3.1, 79, 0.5, 3.7, 59, 'handful', 30, 'fruit sugary'],

  // --------------------------------------------------------- fats & sauces
  ['olive_oil', 'Olive oil', 'olive oil|oil', 884, 0, 0, 100, 0, 0, 'tbsp', 14, 'fat'],
  ['vegetable_oil', 'Vegetable oil', 'vegetable oil|sunflower oil|rapeseed oil', 884, 0, 0, 100, 0, 0, 'tbsp', 14, 'fat'],
  ['mayonnaise', 'Mayonnaise', 'mayo|mayonnaise', 680, 1, 0.6, 75, 0, 0.6, 'tbsp', 15, 'fat'],
  ['ketchup', 'Ketchup', 'ketchup|tomato sauce', 112, 1.2, 26, 0.1, 0.3, 22, 'tbsp', 17, 'sauce sugary'],
  ['brown_sauce', 'Brown sauce', 'brown sauce|hp sauce', 130, 1, 30, 0.1, 1, 25, 'tbsp', 17, 'sauce sugary'],
  ['mustard', 'Mustard', 'mustard', 66, 4.4, 5.8, 3.3, 3.3, 0.9, 'tsp', 5, 'sauce'],
  ['soy_sauce', 'Soy sauce', 'soy sauce|soya sauce', 53, 8.1, 4.9, 0.6, 0.8, 0.4, 'tbsp', 16, 'sauce'],
  ['gravy', 'Gravy', 'gravy', 40, 1, 6, 1.4, 0.2, 1, 'portion', 70, 'sauce'],
  ['pesto', 'Pesto', 'pesto', 450, 5, 6, 45, 2, 3, 'tbsp', 16, 'fat sauce'],
  ['salad_dressing', 'Salad dressing (vinaigrette)', 'dressing|salad dressing|vinaigrette', 449, 0.3, 2.5, 50, 0, 2.5, 'tbsp', 15, 'fat sauce'],
  ['curry_sauce', 'Curry sauce (jar)', 'curry sauce|tikka masala sauce', 120, 2, 9, 8, 1.5, 6, 'portion', 150, 'sauce'],
  ['tomato_pasta_sauce', 'Tomato pasta sauce', 'pasta sauce|tomato sauce jar|marinara', 55, 1.6, 8.5, 1.5, 1.6, 6, 'portion', 125, 'sauce'],

  // -------------------------------------------------- snacks, sweets, junk
  ['crisps', 'Crisps / potato chips', 'crisps|potato chips|packet of crisps', 536, 6.6, 53, 34, 4.4, 0.6, 'packet', 25, 'snack junk fried'],
  ['chocolate_milk', 'Milk chocolate', 'chocolate|milk chocolate|choc', 535, 7.6, 59, 30, 3.4, 52, 'bar', 45, 'snack junk sugary'],
  ['chocolate_dark', 'Dark chocolate (70%)', 'dark chocolate', 598, 7.8, 46, 43, 11, 24, 'square', 10, 'snack sugary'],
  ['biscuits', 'Biscuits', 'biscuit|biscuits|digestive|digestives', 471, 6, 65, 21, 2.5, 28, 'biscuit', 15, 'snack junk sugary'],
  ['cake', 'Cake (sponge, iced)', 'cake|sponge cake|birthday cake', 371, 4.3, 53, 16, 1, 36, 'slice', 80, 'snack junk sugary'],
  ['doughnut', 'Doughnut', 'doughnut|donut', 452, 5, 51, 25, 1.5, 23, 'doughnut', 60, 'snack junk sugary'],
  ['muffin', 'Muffin', 'muffin|blueberry muffin', 377, 5.5, 51, 17, 1.7, 28, 'muffin', 110, 'snack junk sugary'],
  ['flapjack', 'Flapjack', 'flapjack', 460, 5, 60, 22, 3, 33, 'piece', 70, 'snack sugary'],
  ['ice_cream', 'Ice cream', 'ice cream|icecream', 207, 3.5, 24, 11, 0.7, 21, 'scoop', 66, 'snack junk sugary'],
  ['protein_bar', 'Protein bar', 'protein bar', 350, 30, 33, 10, 5, 5, 'bar', 60, 'protein snack'],
  ['cereal_bar', 'Cereal bar', 'cereal bar|granola bar', 400, 5, 65, 13, 3, 30, 'bar', 35, 'snack sugary'],
  ['popcorn', 'Popcorn (plain)', 'popcorn', 387, 13, 78, 4.5, 15, 0.9, 'bowl', 30, 'snack fibre'],
  ['pretzels', 'Pretzels', 'pretzels', 384, 10, 80, 3, 3, 2.5, 'handful', 30, 'snack'],
  ['nachos', 'Nachos with cheese', 'nachos', 306, 8, 32, 17, 3, 2, 'portion', 150, 'snack junk'],
  ['sausage_roll', 'Sausage roll', 'sausage roll', 371, 9.5, 26, 25, 1.3, 1.4, 'roll', 130, 'junk pastry'],
  ['pork_pie', 'Pork pie', 'pork pie', 376, 11, 24, 26, 1, 1, 'pie', 140, 'junk pastry'],
  ['pasty', 'Cornish pasty', 'pasty|cornish pasty', 285, 8, 25, 17, 1.8, 1.5, 'pasty', 220, 'junk pastry'],
  ['scotch_egg', 'Scotch egg', 'scotch egg', 280, 12, 16, 18, 1, 1, 'egg', 120, 'junk'],

  // ----------------------------------------------------- takeaway & eating out
  ['pizza_cheese', 'Pizza (cheese & tomato)', 'pizza|margherita|cheese pizza', 266, 11, 33, 10, 2.3, 3.6, 'slice', 107, 'junk carb'],
  ['pizza_pepperoni', 'Pizza (pepperoni)', 'pepperoni pizza', 298, 13, 30, 14, 2.2, 3.4, 'slice', 111, 'junk carb'],
  ['burger_cheese', 'Cheeseburger (fast food)', 'cheeseburger|burger|hamburger', 303, 15, 26, 15, 1.5, 6, 'burger', 165, 'junk protein'],
  ['big_burger', 'Large double burger', 'big mac|whopper|double cheeseburger|quarter pounder', 257, 13, 20, 14, 1.4, 4.5, 'burger', 220, 'junk protein'],
  ['kebab_doner', 'Doner kebab', 'kebab|doner|doner kebab', 215, 15, 12, 12, 1.5, 1.5, 'kebab', 350, 'junk protein'],
  ['chicken_tikka_masala', 'Chicken tikka masala', 'tikka masala|chicken tikka masala|curry', 155, 11, 6, 10, 1, 3.5, 'portion', 350, 'takeaway protein'],
  ['chicken_korma', 'Chicken korma', 'korma|chicken korma', 187, 10, 8, 14, 1.2, 4, 'portion', 350, 'takeaway'],
  ['sweet_sour_chicken', 'Sweet & sour chicken', 'sweet and sour|sweet and sour chicken', 176, 8, 22, 6.5, 0.8, 15, 'portion', 350, 'takeaway sugary'],
  ['chow_mein', 'Chicken chow mein', 'chow mein|chicken chow mein', 145, 8, 17, 5, 1.5, 2, 'portion', 350, 'takeaway'],
  ['fried_rice', 'Egg fried rice', 'fried rice|egg fried rice', 163, 4.5, 24, 5.5, 1, 1, 'portion', 250, 'takeaway carb'],
  ['spring_roll', 'Spring roll', 'spring roll|spring rolls', 240, 5, 27, 12, 2, 2, 'roll', 60, 'takeaway fried'],
  ['sushi_roll', 'Sushi (mixed roll)', 'sushi|maki|sushi roll', 143, 5.8, 27, 1.3, 1.2, 4, 'piece', 30, 'takeaway'],
  ['burrito', 'Burrito', 'burrito', 206, 9, 26, 7.5, 3, 2, 'burrito', 330, 'takeaway carb'],
  ['sandwich_shop', 'Shop sandwich (average)', 'sandwich|meal deal sandwich|butty', 230, 11, 24, 10, 2, 3, 'sandwich', 180, 'carb'],
  ['full_english', 'Full English breakfast', 'full english|fry up|full breakfast|cooked breakfast', 220, 12, 12, 14, 2, 3, 'plate', 450, 'breakfast junk'],

  // ---------------------------------------------------------------- drinks
  ['coffee_black', 'Coffee (black)', 'coffee|black coffee|americano|espresso', 2, 0.1, 0, 0, 0, 0, 'cup', 240, 'drink zero'],
  ['coffee_milk', 'Coffee with milk', 'white coffee|coffee with milk|coffee with a splash of milk', 26, 1.4, 2.1, 1.4, 0, 2.1, 'cup', 240, 'drink'],
  ['latte', 'Latte', 'latte|spanish latte|iced latte', 48, 2.6, 4.2, 2.4, 0, 4.2, 'cup', 300, 'drink dairy'],
  ['tea', 'Tea with milk', 'tea|cup of tea|brew|builders tea', 13, 0.7, 1.1, 0.7, 0, 1.1, 'cup', 240, 'drink'],
  ['tea_black', 'Tea (no milk) / green tea', 'green tea|black tea|herbal tea|peppermint tea', 1, 0, 0.2, 0, 0, 0, 'cup', 240, 'drink zero'],
  ['water', 'Water', 'water|sparkling water', 0, 0, 0, 0, 0, 0, 'glass', 250, 'drink zero'],
  ['cola', 'Cola (regular)', 'cola|coke|pepsi|fizzy drink|soda', 42, 0, 10.6, 0, 0, 10.6, 'can', 330, 'drink sugary junk'],
  ['cola_diet', 'Diet cola', 'diet coke|coke zero|diet cola|sugar free cola', 0.4, 0, 0.1, 0, 0, 0, 'can', 330, 'drink zero'],
  ['orange_juice', 'Orange juice', 'orange juice|oj|fruit juice', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 'glass', 250, 'drink sugary'],
  ['smoothie', 'Fruit smoothie', 'smoothie', 60, 1, 14, 0.3, 1.5, 12, 'bottle', 250, 'drink sugary'],
  ['energy_drink', 'Energy drink', 'energy drink|red bull|monster', 45, 0, 11, 0, 0, 11, 'can', 250, 'drink sugary'],
  ['sports_drink', 'Sports drink', 'lucozade|gatorade|sports drink|isotonic', 27, 0, 6.5, 0, 0, 6.4, 'bottle', 500, 'drink sugary'],
  ['milkshake', 'Milkshake', 'milkshake|shake', 112, 3.5, 18, 3, 0, 17, 'cup', 300, 'drink sugary junk'],

  // --------------------------------------------------------------- alcohol
  ['beer_lager', 'Lager / beer (4.5%)', 'beer|lager|pint|pint of lager|ale', 43, 0.5, 3.6, 0, 0, 0.3, 'pint', 568, 'alcohol drink beer'],
  ['beer_strong', 'Strong beer / IPA (6%)', 'ipa|craft beer|strong beer|pale ale', 57, 0.6, 4.5, 0, 0, 0.4, 'pint', 568, 'alcohol drink beer'],
  ['cider', 'Cider', 'cider', 45, 0, 5.3, 0, 0, 5.3, 'pint', 568, 'alcohol drink beer sugary'],
  ['wine_red', 'Red wine', 'red wine|wine|glass of wine|merlot|shiraz|syrah|malbec|rioja|cabernet|cab sav|cabernet sauvignon|pinot noir|tempranillo|chianti|claret', 85, 0.1, 2.6, 0, 0, 0.6, 'glass', 175, 'alcohol drink wine'],
  ['wine_white', 'White wine', 'white wine|sauvignon blanc|chardonnay|pinot grigio|pinot gris|riesling|albarino|chenin blanc|verdejo', 82, 0.1, 2.6, 0, 0, 1, 'glass', 175, 'alcohol drink wine'],

  // Stouts and craft cans. Serving size matters more than the per-100 ml
  // figures here: a 330 ml can logged as a 568 ml pint overstates by 70%.
  ['guinness', 'Guinness Draught (4.2%)', 'guinness|guinness draught|draught guinness|stout|dry stout', 37, 0.3, 3.2, 0, 0, 0.2, 'pint', 568, 'alcohol drink beer'],
  ['guinness_extra', 'Guinness Extra Stout (5.6%)', 'guinness extra|guinness extra stout|extra stout|foreign extra', 46, 0.3, 4.2, 0, 0, 0.3, 'bottle', 330, 'alcohol drink beer'],
  ['guinness_zero', 'Guinness 0.0', 'guinness 0.0|guinness zero|guinness 0|guinness nitro zero', 16, 0.3, 3.4, 0, 0, 0.2, 'pint', 568, 'drink beer zero'],
  ['brewdog_punk', 'BrewDog Punk IPA (5.4%)', 'brewdog|brew dog|punk ipa|brewdog punk', 45, 0.4, 3.5, 0, 0, 0.2, 'can', 330, 'alcohol drink beer'],
  ['brewdog_hazy', 'BrewDog Hazy Jane (5%)', 'hazy jane|brewdog hazy', 44, 0.4, 3.6, 0, 0, 0.3, 'can', 330, 'alcohol drink beer'],
  ['lost_lager', 'BrewDog Lost Lager (4.7%)', 'lost lager|brewdog lager', 40, 0.3, 2.8, 0, 0, 0.2, 'can', 330, 'alcohol drink beer'],
  ['brewdog_af', 'BrewDog Punk AF (0.5%)', 'punk af|brewdog af|alcohol free beer|non alcoholic beer|af beer', 15, 0.4, 3.2, 0, 0, 0.5, 'can', 330, 'drink beer zero'],
  ['spirits', 'Spirits (40%)', 'vodka|gin|whisky|whiskey|rum|spirits|shot', 231, 0, 0, 0, 0, 0, 'single', 25, 'alcohol drink'],
  ['cocktail', 'Cocktail (average)', 'cocktail|mojito|margarita', 160, 0.2, 18, 0, 0, 17, 'glass', 200, 'alcohol drink sugary'],
  ['gin_tonic', 'Gin & tonic', 'gin and tonic|g and t|gin tonic', 60, 0, 6, 0, 0, 6, 'glass', 250, 'alcohol drink'],

  // --------------------------------------------- middle east & south asia
  ['shawarma_chicken', 'Chicken shawarma (wrap)', 'chicken shawarma|shawarma|shwarma|shawarma wrap|chicken shawarma wrap', 200, 14, 19, 8, 1.5, 2, 'wrap', 250, 'takeaway protein'],
  ['shawarma_meat', 'Meat shawarma (wrap)', 'meat shawarma|beef shawarma|lamb shawarma|shawarma plate|shawarma meat', 225, 15, 17, 11, 1.4, 2, 'wrap', 250, 'takeaway protein'],
  ['falafel', 'Falafel', 'falafel|felafel|falafel sandwich', 333, 13.3, 31.8, 17.8, 4.9, 2, 'piece', 25, 'veg protein fried'],
  ['halloumi', 'Halloumi (grilled)', 'halloumi|haloumi|grilled halloumi|halloumi cheese', 321, 22, 2.2, 25, 0, 2, 'portion', 80, 'dairy protein'],
  ['labneh', 'Labneh', 'labneh|labaneh|strained yoghurt', 160, 8, 5, 12, 0, 4.5, 'portion', 60, 'dairy protein breakfast'],
  ['manakish', 'Manakish (zaatar)', 'manakish|manakeesh|zaatar bread|zaatar manakish|cheese manakish', 280, 8, 38, 11, 2.5, 2, 'piece', 150, 'carb breakfast'],
  ['biryani', 'Chicken biryani', 'biryani|chicken biryani|lamb biryani|briyani', 150, 8, 18, 5, 1, 1.5, 'portion', 400, 'takeaway carb protein'],
  ['kabsa', 'Kabsa / mandi (chicken & rice)', 'kabsa|mandi|machboos|majboos|chicken mandi|lamb mandi|chicken kabsa', 160, 10, 19, 5, 1, 1, 'portion', 400, 'takeaway carb protein'],
  ['tabbouleh', 'Tabbouleh', 'tabbouleh|tabouleh|tabouli', 130, 3, 17, 6, 3.5, 2.5, 'portion', 150, 'veg fibre'],
  ['fattoush', 'Fattoush', 'fattoush|fatoush|fattoush salad', 90, 2, 10, 5, 2, 3, 'portion', 200, 'veg fibre'],
  ['moutabal', 'Moutabal / baba ganoush', 'moutabal|mutabal|baba ganoush|baba ghanoush|eggplant dip', 130, 2.5, 8, 10, 3, 4, 'portion', 80, 'veg fat'],
  ['kibbeh', 'Kibbeh (fried)', 'kibbeh|kibbe|kubbeh', 250, 12, 20, 14, 2, 1, 'piece', 60, 'protein fried'],
  ['kofta', 'Kofta / kebab skewer', 'kofta|kofte|kafta|kofta kebab|meat skewer', 250, 17, 6, 17, 1, 1.5, 'skewer', 100, 'protein meat'],
  ['mixed_grill', 'Mixed grill (meats)', 'mixed grill|meat platter|grill platter|mashawi', 220, 22, 2, 14, 0.5, 1, 'portion', 300, 'protein meat'],
  ['shakshuka', 'Shakshuka', 'shakshuka|shakshouka|eggs in tomato', 118, 7, 6, 7.5, 1.8, 4, 'portion', 300, 'protein breakfast'],
  ['foul', 'Foul medames', 'foul|ful|foul medames|ful medames|fava beans', 110, 7.6, 16, 2.5, 5, 1, 'portion', 250, 'protein fibre breakfast'],
  ['samosa', 'Samosa', 'samosa|samosas|sambousek', 260, 5, 28, 14, 2.5, 2, 'piece', 60, 'fried snack'],
  ['dal', 'Dal / lentil curry', 'dal|daal|dhal|lentil curry|dal tadka', 110, 6, 14, 3, 4, 1.5, 'portion', 250, 'protein fibre veg'],
  ['butter_chicken', 'Butter chicken', 'butter chicken|chicken makhani|murgh makhani', 165, 13, 5, 10.5, 0.8, 3.5, 'portion', 350, 'takeaway protein'],
  ['chicken_tikka', 'Chicken tikka (grilled)', 'chicken tikka|tandoori chicken|tandoori|tikka skewer', 150, 22, 3, 6, 0.5, 1.5, 'portion', 200, 'protein lean'],
  ['paneer', 'Paneer', 'paneer|paneer tikka|paneer curry', 300, 20, 4, 23, 0, 3, 'portion', 150, 'dairy protein veg'],
  ['karak', 'Karak chai', 'karak|karak chai|karak tea|masala chai|chai latte', 60, 1.6, 9, 2, 0, 8.5, 'cup', 200, 'drink sugary'],
  ['laban', 'Laban (drinking yoghurt)', 'laban|ayran|buttermilk drink', 40, 3.3, 4.9, 1, 0, 4.9, 'bottle', 250, 'dairy drink'],
  ['lassi', 'Lassi (sweet/mango)', 'lassi|mango lassi|sweet lassi', 90, 2.5, 15, 2, 0.3, 14, 'glass', 300, 'dairy drink sugary'],
  ['kunafa', 'Kunafa', 'kunafa|knafeh|kunafeh|kanafeh', 350, 6, 40, 18, 1, 26, 'portion', 120, 'sugary junk treat'],
  ['baklava', 'Baklava', 'baklava|baclava|baklawa', 430, 6, 50, 24, 2.5, 30, 'piece', 40, 'sugary junk treat'],
  ['luqaimat', 'Luqaimat (sweet dumplings)', 'luqaimat|lugaimat|awameh', 380, 4, 55, 16, 1, 28, 'piece', 20, 'sugary junk treat'],
  ['sugarcane_juice', 'Sugarcane juice', 'sugarcane juice|sugar cane juice', 60, 0, 15, 0, 0, 14, 'glass', 300, 'drink sugary'],

  // ------------------------------------------------- asian & bowl food
  ['ramen', 'Ramen (bowl)', 'ramen|ramen bowl|noodle soup', 120, 5, 16, 4, 1, 1.5, 'bowl', 500, 'takeaway carb'],
  ['pho', 'Pho (bowl)', 'pho|pho bo|vietnamese noodle soup', 85, 6, 10, 2, 0.6, 1, 'bowl', 500, 'takeaway lean'],
  ['pad_thai', 'Pad thai', 'pad thai|padthai', 180, 8, 22, 7, 1.5, 6, 'portion', 400, 'takeaway carb'],
  ['poke_bowl', 'Poke bowl', 'poke|poke bowl|salmon poke|tuna poke', 130, 8, 16, 4, 1.5, 3, 'bowl', 400, 'protein balanced'],
  ['acai_bowl', 'Acai bowl', 'acai|acai bowl', 110, 2, 22, 2.5, 3, 15, 'bowl', 350, 'fruit sugary breakfast'],
  ['dumplings', 'Dumplings / gyoza', 'dumplings|gyoza|dim sum|momos', 190, 8, 25, 6, 1.5, 1.5, 'piece', 35, 'takeaway'],
  ['katsu_curry', 'Chicken katsu curry', 'katsu|katsu curry|chicken katsu', 175, 9, 20, 7, 1.2, 3, 'portion', 450, 'takeaway fried'],

  // -------------------------------------------------- western gaps
  ['skyr', 'Skyr / protein yoghurt', 'skyr|protein yoghurt|protein yogurt|high protein yoghurt', 63, 11, 4, 0.2, 0, 3.5, 'pot', 170, 'protein dairy breakfast'],
  ['nuggets', 'Chicken nuggets', 'chicken nuggets|nuggets|mcnuggets|chicken tenders|chicken strips', 296, 15, 16, 18, 1, 0.5, 'nugget', 17, 'junk fried protein'],
  ['chicken_burger', 'Chicken burger (fried)', 'chicken burger|mcchicken|zinger|chicken sandwich fried', 230, 12, 24, 10, 1.5, 4, 'burger', 190, 'junk protein'],
  ['fillet_steak', 'Fillet steak', 'fillet steak|filet|tenderloin|beef fillet', 190, 28, 0, 8.5, 0, 0, 'steak', 200, 'protein lean meat'],
  ['rice_cakes', 'Rice cakes', 'rice cake|rice cakes', 387, 8, 81, 3, 3, 1, 'cake', 9, 'carb snack'],
  ['oat_milk', 'Oat milk', 'oat milk|oatmilk', 45, 1, 7, 1.5, 0.8, 4, 'glass', 250, 'drink'],
  ['almond_milk', 'Almond milk (unsweetened)', 'almond milk', 15, 0.6, 0.6, 1.2, 0.4, 0.2, 'glass', 250, 'drink'],
  ['hammour', 'Hammour (white fish)', 'hammour|hamour|grouper', 90, 19, 0, 1, 0, 0, 'fillet', 180, 'protein fish lean'],
  ['loaded_fries', 'Loaded fries', 'loaded fries|cheese fries|shawarma fries|dirty fries', 290, 8, 30, 15, 2.5, 1.5, 'portion', 300, 'junk fried'],
  ['wings_fried', 'Fried chicken wings (breaded)', 'fried wings|fried chicken|kfc|breaded wings', 320, 19, 12, 22, 0.8, 0.5, 'piece', 45, 'junk fried protein'],
  ['omelette', 'Omelette (plain, cooked in oil)', 'omelette|omelet|egg white omelette', 175, 11, 1, 14, 0, 0.5, 'omelette', 180, 'protein breakfast'],
  ['protein_pancakes', 'Protein pancakes', 'protein pancakes|protein pancake', 200, 15, 22, 5, 1.5, 5, 'stack', 200, 'protein breakfast'],
  ['pancakes', 'Pancakes with syrup', 'pancakes|pancake', 280, 6, 42, 10, 1, 18, 'stack', 200, 'sugary breakfast treat'],
  ['caesar_salad', 'Chicken caesar salad', 'caesar salad|chicken caesar|caesar', 150, 12, 5, 9, 1.2, 2, 'bowl', 300, 'protein'],
  ['club_sandwich', 'Club sandwich', 'club sandwich|chicken club', 240, 13, 22, 11, 1.5, 3, 'sandwich', 280, 'carb protein'],
  ['steak_frites', 'Steak and chips (plate)', 'steak and chips|steak frites|steak dinner', 230, 17, 15, 11, 1.4, 0.5, 'plate', 450, 'protein meat'],

  // ---------------------------------------------------------- supplements
  ['whey_protein', 'Whey protein powder', 'whey|protein powder|protein shake|whey protein', 400, 80, 8, 6, 1, 5, 'scoop', 30, 'protein supplement'],
  ['casein_protein', 'Casein protein powder', 'casein', 370, 78, 6, 3, 1, 4, 'scoop', 30, 'protein supplement'],
  ['creatine', 'Creatine monohydrate', 'creatine', 0, 0, 0, 0, 0, 0, 'scoop', 5, 'supplement zero'],
  ['mass_gainer', 'Mass gainer shake', 'mass gainer|weight gainer', 380, 20, 65, 4, 2, 20, 'scoop', 100, 'supplement carb'],

  // ---------------------------------------------- raw larder (for cooking)
  // Dry weights and cooking staples, so a from-scratch cook can log what
  // actually went in the pan rather than guessing at the finished plate.
  ['flour_plain', 'Plain flour', 'flour|plain flour|all purpose flour|self raising flour|self-raising flour|bread flour', 364, 10, 76, 1, 2.7, 0.3, 'tablespoon', 25, 'carb baking'],
  ['cornflour', 'Cornflour', 'cornflour|corn starch|cornstarch', 381, 0.3, 91, 0.1, 0.9, 0, 'tablespoon', 10, 'carb baking'],
  ['breadcrumbs', 'Breadcrumbs', 'breadcrumbs|panko|bread crumbs', 395, 13, 72, 5.3, 4.5, 6.2, 'tablespoon', 15, 'carb'],
  ['sugar', 'Sugar (white)', 'sugar|white sugar|caster sugar|granulated sugar|icing sugar', 400, 0, 100, 0, 0, 100, 'teaspoon', 4, 'sugar'],
  ['sugar_brown', 'Brown sugar', 'brown sugar|demerara|muscovado', 380, 0, 98, 0, 0, 97, 'teaspoon', 4, 'sugar'],
  ['honey', 'Honey', 'honey', 304, 0.3, 82, 0, 0, 82, 'tablespoon', 21, 'sugar natural'],
  ['maple_syrup', 'Maple syrup', 'maple syrup|golden syrup|syrup', 260, 0, 67, 0, 0, 60, 'tablespoon', 20, 'sugar'],
  ['cocoa_powder', 'Cocoa powder', 'cocoa|cocoa powder|cacao', 228, 20, 12, 14, 33, 1.8, 'tablespoon', 8, 'baking'],
  ['dark_choc_chips', 'Chocolate chips / baking chocolate', 'chocolate chips|choc chips|baking chocolate|cooking chocolate', 500, 5, 60, 27, 7, 48, 'tablespoon', 15, 'sugar treat'],
  ['desiccated_coconut', 'Desiccated coconut', 'desiccated coconut|shredded coconut|coconut flakes', 660, 6.9, 24, 65, 16, 7.4, 'tablespoon', 10, 'fat'],
  ['rice_dry', 'Rice (dry, uncooked)', 'dry rice|uncooked rice|rice dry|basmati dry|rice uncooked', 356, 7.5, 78, 1.1, 1.4, 0.1, 'portion', 75, 'carb staple'],
  ['pasta_dry', 'Pasta (dry, uncooked)', 'dry pasta|uncooked pasta|pasta dry|dry spaghetti|spaghetti dry|dry weight pasta', 371, 13, 75, 1.5, 3, 2.7, 'portion', 75, 'carb staple'],
  ['quinoa_dry', 'Quinoa (dry, uncooked)', 'dry quinoa|quinoa dry|uncooked quinoa', 368, 14, 64, 6.1, 7, 0, 'portion', 60, 'carb wholegrain'],
  ['couscous_dry', 'Couscous (dry)', 'dry couscous|couscous dry|uncooked couscous', 376, 13, 77, 0.6, 5, 0, 'portion', 60, 'carb staple'],
  ['noodles_dry', 'Noodles (dry)', 'dry noodles|noodles dry|ramen noodles dry|rice noodles', 380, 11, 76, 2, 3, 1, 'nest', 65, 'carb staple'],
  ['turkey_mince', 'Turkey mince', 'turkey mince|minced turkey|ground turkey', 148, 20, 0, 7.7, 0, 0, 'portion', 125, 'protein lean meat'],
  ['lamb_mince', 'Lamb mince', 'lamb mince|minced lamb|ground lamb', 277, 17, 0, 23, 0, 0, 'portion', 125, 'protein meat'],
  ['pork_mince', 'Pork mince', 'pork mince|minced pork|ground pork', 263, 17, 0, 21, 0, 0, 'portion', 125, 'protein meat'],
  ['chicken_mince', 'Chicken mince', 'chicken mince|minced chicken|ground chicken', 143, 18, 0, 8, 0, 0, 'portion', 125, 'protein lean meat'],
  ['garlic', 'Garlic', 'garlic|garlic clove|garlic cloves|minced garlic', 149, 6.4, 33, 0.5, 2.1, 1, 'clove', 3, 'veg aromatic'],
  ['ginger', 'Ginger (fresh)', 'ginger|fresh ginger|ginger root', 80, 1.8, 18, 0.8, 2, 1.7, 'thumb', 15, 'veg aromatic'],
  ['chilli_fresh', 'Chilli (fresh)', 'fresh chilli|red chilli|green chilli|jalapeno|chilli pepper', 40, 1.9, 8.8, 0.4, 1.5, 5.3, 'chilli', 14, 'veg aromatic'],
  ['chilli_con_carne', 'Chilli con carne (no rice)', 'chilli|chili|chilli con carne|chili con carne|bowl of chilli', 120, 11, 8, 4.5, 2.5, 2, 'bowl', 350, 'protein meal'],
  ['spring_onion', 'Spring onion', 'spring onion|spring onions|scallion|green onion', 32, 1.8, 7.3, 0.2, 2.6, 2.3, 'stalk', 15, 'veg'],
  ['leek', 'Leek', 'leek|leeks', 61, 1.5, 14, 0.3, 1.8, 3.9, 'leek', 90, 'veg'],
  ['celery', 'Celery', 'celery|celery stick', 16, 0.7, 3, 0.2, 1.6, 1.3, 'stick', 40, 'veg'],
  ['lemon', 'Lemon', 'lemon|lemon juice|juice of a lemon', 29, 1.1, 9.3, 0.3, 2.8, 2.5, 'lemon', 58, 'fruit'],
  ['lime', 'Lime', 'lime|lime juice', 30, 0.7, 11, 0.2, 2.8, 1.7, 'lime', 44, 'fruit'],
  ['butternut_squash', 'Butternut squash', 'butternut squash|butternut|pumpkin', 45, 1, 12, 0.1, 2, 2.2, 'portion', 150, 'veg'],
  ['beetroot', 'Beetroot', 'beetroot|beets', 43, 1.6, 10, 0.2, 2.8, 6.8, 'beet', 80, 'veg'],
  ['tinned_tomatoes', 'Tinned tomatoes (chopped)', 'tinned tomatoes|chopped tomatoes|canned tomatoes|passata|tomato sauce tin', 32, 1.6, 7, 0.3, 1.9, 4.4, 'tin', 400, 'veg sauce'],
  ['tomato_puree', 'Tomato purée', 'tomato puree|tomato paste|puree', 82, 4.3, 19, 0.5, 4.1, 12, 'tablespoon', 15, 'veg sauce'],
  ['coconut_milk', 'Coconut milk (tinned)', 'coconut milk|tinned coconut milk|coconut cream', 197, 2, 2.8, 20, 0, 2.8, 'tin', 400, 'fat sauce'],
  ['stock_cube', 'Stock cube / broth', 'stock|stock cube|chicken stock|beef stock|vegetable stock|broth|bouillon', 20, 1.5, 2.5, 0.5, 0, 0.5, 'cube made up (500ml)', 500, 'sauce'],
  ['coconut_oil', 'Coconut oil', 'coconut oil', 892, 0, 0, 99, 0, 0, 'tablespoon', 14, 'fat oil'],
  ['ghee', 'Ghee', 'ghee|clarified butter', 900, 0, 0, 100, 0, 0, 'tablespoon', 13, 'fat oil'],
  ['sesame_oil', 'Sesame oil', 'sesame oil', 884, 0, 0, 100, 0, 0, 'tablespoon', 14, 'fat oil'],
  ['single_cream', 'Single cream', 'single cream|light cream|cooking cream', 193, 2.6, 4, 18, 0, 4, 'portion', 30, 'dairy fatty'],
  ['sour_cream', 'Sour cream / crème fraîche', 'sour cream|soured cream|creme fraiche', 193, 2.9, 3.5, 18.5, 0, 3.5, 'tablespoon', 30, 'dairy fatty'],
  ['yoghurt_natural', 'Natural yoghurt', 'natural yoghurt|plain yoghurt|natural yogurt', 61, 4.8, 6, 1.7, 0, 6, 'pot', 150, 'dairy'],
  ['tahini', 'Tahini', 'tahini|sesame paste', 595, 17, 21, 54, 9.3, 0.5, 'tablespoon', 15, 'fat'],
  ['sesame_seeds', 'Sesame seeds', 'sesame seeds|sesame', 573, 18, 23, 50, 12, 0.3, 'tablespoon', 9, 'fat seeds'],
  ['pumpkin_seeds', 'Pumpkin seeds', 'pumpkin seeds|pepitas', 559, 30, 11, 49, 6, 1.4, 'tablespoon', 10, 'protein seeds'],
  ['sunflower_seeds', 'Sunflower seeds', 'sunflower seeds', 584, 21, 20, 51, 8.6, 2.6, 'tablespoon', 10, 'fat seeds'],
  ['flaxseed', 'Flaxseed (ground)', 'flaxseed|flax|linseed|ground flaxseed', 534, 18, 29, 42, 27, 1.6, 'tablespoon', 10, 'fat seeds omega3'],
  ['pine_nuts', 'Pine nuts', 'pine nuts', 673, 14, 13, 68, 3.7, 3.6, 'tablespoon', 10, 'fat nuts'],
  ['fish_sauce', 'Fish sauce', 'fish sauce|nam pla', 35, 5, 3.6, 0, 0, 3.6, 'tablespoon', 18, 'sauce'],
  ['oyster_sauce', 'Oyster sauce', 'oyster sauce', 51, 1.4, 11, 0.3, 0, 6, 'tablespoon', 18, 'sauce'],
  ['sriracha', 'Sriracha / hot sauce', 'sriracha|hot sauce|chilli sauce|tabasco', 93, 1.9, 19, 0.9, 2.2, 15, 'tablespoon', 17, 'sauce'],
  ['vinegar', 'Vinegar (any)', 'vinegar|balsamic|balsamic vinegar|apple cider vinegar|rice vinegar', 19, 0, 0.9, 0, 0, 0.4, 'tablespoon', 15, 'sauce zero'],
  ['olives', 'Olives', 'olives|black olives|green olives', 115, 0.8, 6, 11, 3.2, 0, 'portion', 30, 'fat'],
  ['sun_dried_tomatoes', 'Sun-dried tomatoes (in oil)', 'sun dried tomatoes|sundried tomatoes', 213, 5.1, 23, 14, 5.8, 16, 'portion', 30, 'veg fatty'],
  ['capers', 'Capers', 'capers', 23, 2.4, 5, 0.9, 3.2, 0.4, 'tablespoon', 9, 'sauce zero'],

  // ------------------------------------------------- sauces & condiments II
  ['satay_sauce', 'Satay / peanut sauce', 'satay sauce|peanut sauce|peanut dip', 210, 7, 12, 15, 2, 8, 'tablespoon', 20, 'sauce fatty'],
  ['sweet_chilli', 'Sweet chilli sauce', 'sweet chilli|sweet chili|sweet chilli sauce', 230, 0.5, 55, 0.5, 0.5, 50, 'tablespoon', 20, 'sauce sugar'],
  ['bbq_sauce', 'BBQ sauce', 'bbq sauce|barbecue sauce|bbq', 165, 1, 40, 0.3, 0.6, 33, 'tablespoon', 18, 'sauce sugar'],
  ['hoisin', 'Hoisin sauce', 'hoisin|hoisin sauce', 220, 3, 44, 3.4, 3, 30, 'tablespoon', 18, 'sauce sugar'],
  ['teriyaki_sauce', 'Teriyaki sauce', 'teriyaki sauce|teriyaki marinade', 89, 6, 16, 0, 0, 14, 'tablespoon', 18, 'sauce'],
  ['buffalo_sauce', 'Buffalo hot sauce', 'buffalo sauce|franks|wing sauce', 30, 0.5, 2, 2.5, 0, 1, 'tablespoon', 17, 'sauce'],
  ['ranch', 'Ranch dressing', 'ranch|ranch dressing', 430, 1, 6, 45, 0, 3, 'tablespoon', 15, 'sauce fatty'],
  ['caesar_dressing', 'Caesar dressing', 'caesar dressing', 450, 2, 4, 47, 0, 3, 'tablespoon', 15, 'sauce fatty'],
  ['tartare', 'Tartare sauce', 'tartare|tartar sauce|tartare sauce', 480, 1, 6, 50, 0, 3, 'tablespoon', 15, 'sauce fatty'],
  ['honey_mustard', 'Honey mustard', 'honey mustard', 300, 1.5, 30, 19, 0.5, 26, 'tablespoon', 15, 'sauce sugar'],
  ['tzatziki', 'Tzatziki', 'tzatziki|cacik', 95, 4, 4, 7, 0.3, 3, 'tablespoon', 30, 'sauce dairy'],
  ['guacamole', 'Guacamole', 'guacamole|guac', 155, 2, 8, 13, 5, 1, 'tablespoon', 30, 'sauce fat'],
  ['salsa', 'Salsa', 'salsa|pico de gallo', 30, 1.4, 6, 0.2, 1.5, 4, 'tablespoon', 30, 'sauce veg'],
  ['toum', 'Garlic sauce (toum)', 'garlic sauce|toum|garlic dip|garlic mayo', 480, 1, 8, 50, 0.5, 2, 'tablespoon', 15, 'sauce fatty'],
  ['peri_peri', 'Peri peri sauce', 'peri peri|piri piri|peri peri sauce', 60, 1, 7, 3, 1.5, 4, 'tablespoon', 15, 'sauce'],
  ['aioli', 'Aioli', 'aioli', 500, 1, 4, 53, 0, 1, 'tablespoon', 15, 'sauce fatty'],
  ['chilli_oil', 'Chilli oil / crispy chilli', 'chilli oil|chili oil|chilli crisp|crispy chilli oil', 700, 2, 6, 74, 2, 0, 'tablespoon', 12, 'fat oil'],
  ['harissa', 'Harissa', 'harissa|harissa paste', 90, 3, 12, 3.5, 4, 6, 'tablespoon', 15, 'sauce'],
  ['miso', 'Miso paste', 'miso|miso paste', 200, 12, 26, 6, 5, 6, 'tablespoon', 17, 'sauce'],
  ['gochujang', 'Gochujang', 'gochujang', 180, 4, 38, 1.5, 2, 20, 'tablespoon', 18, 'sauce'],
  ['jam', 'Jam / marmalade', 'jam|marmalade|strawberry jam|raspberry jam', 260, 0.4, 64, 0, 1, 60, 'tablespoon', 15, 'sugar spread'],
  ['chocolate_spread', 'Chocolate hazelnut spread', 'nutella|chocolate spread|hazelnut spread', 540, 6, 57, 31, 3, 55, 'tablespoon', 18, 'sugar spread'],
  ['marmite', 'Marmite', 'marmite|yeast extract|vegemite', 250, 34, 24, 0.5, 3, 1, 'teaspoon', 4, 'spread'],

  // ------------------------------------------------------- breads & bakery II
  ['baguette', 'Baguette', 'baguette|french stick|french bread', 270, 9, 55, 1.5, 2.5, 3, 'portion', 80, 'carb bread'],
  ['ciabatta', 'Ciabatta', 'ciabatta|ciabatta roll', 270, 9, 52, 3.5, 2.5, 1.5, 'roll', 90, 'carb bread'],
  ['focaccia', 'Focaccia', 'focaccia', 300, 8, 47, 9, 2.5, 1.5, 'slice', 80, 'carb bread'],
  ['brioche', 'Brioche', 'brioche|brioche bun|brioche roll', 375, 8, 50, 16, 2, 12, 'slice', 40, 'carb bread sugar'],
  ['burger_bun', 'Burger bun', 'burger bun|bap|bun', 280, 9, 50, 5, 2.3, 6, 'bun', 60, 'carb bread'],
  ['english_muffin', 'English muffin', 'english muffin|breakfast muffin', 235, 9, 44, 2, 2.5, 3, 'muffin', 60, 'carb bread'],
  ['crumpet', 'Crumpet', 'crumpet|crumpets', 190, 6, 39, 1, 2, 2, 'crumpet', 55, 'carb bread'],
  ['scone', 'Scone', 'scone|scones', 360, 7, 55, 12.5, 2, 12, 'scone', 70, 'carb treat'],
  ['waffle', 'Waffle', 'waffle|waffles', 290, 7, 37, 13, 1.5, 10, 'waffle', 75, 'carb treat'],
  ['french_toast', 'French toast', 'french toast|eggy bread', 230, 8, 25, 11, 1, 7, 'slice', 65, 'carb breakfast'],
  ['crepe', 'Crêpe', 'crepe|crepes', 230, 7, 30, 9, 1, 8, 'crepe', 60, 'carb treat'],
  ['garlic_bread', 'Garlic bread', 'garlic bread|garlic baguette', 350, 8, 42, 17, 2.5, 2, 'slice', 40, 'carb fatty'],
  ['pain_au_chocolat', 'Pain au chocolat', 'pain au chocolat|chocolate croissant', 415, 7.5, 44, 23, 2.4, 12, 'pastry', 65, 'carb treat'],
  ['cinnamon_roll', 'Cinnamon roll', 'cinnamon roll|cinnamon bun|cinnamon swirl', 370, 6, 52, 15, 2, 25, 'roll', 85, 'carb treat sugar'],
  ['danish', 'Danish pastry', 'danish|danish pastry|apricot danish', 375, 6, 45, 19, 1.7, 20, 'pastry', 75, 'carb treat'],
  ['crackers', 'Crackers', 'crackers|cream crackers|water biscuits', 430, 9, 65, 14, 3.5, 3, 'cracker', 8, 'carb snack'],
  ['oatcakes', 'Oatcakes', 'oatcake|oatcakes', 440, 10, 60, 17, 7, 1.5, 'oatcake', 11, 'carb fibre snack'],
  ['rye_crackers', 'Rye crackers / crispbread', 'rye crackers|crispbread|ryvita|rye cracker', 350, 9, 66, 2.5, 16, 1.5, 'cracker', 10, 'carb fibre snack'],
  ['breadsticks', 'Breadsticks', 'breadsticks|grissini', 410, 12, 70, 8.5, 3, 3, 'stick', 6, 'carb snack'],
  ['tortilla_chips', 'Tortilla chips', 'tortilla chips|corn chips|doritos', 500, 7, 63, 24, 5, 1, 'portion', 30, 'carb snack fatty'],

  // -------------------------------------------------------------- dairy II
  ['brie', 'Brie / Camembert', 'brie|camembert', 335, 21, 0.5, 27.5, 0, 0.5, 'portion', 30, 'dairy fatty'],
  ['goat_cheese', 'Goat cheese', 'goat cheese|goats cheese|chevre', 300, 20, 1, 24, 0, 1, 'portion', 30, 'dairy fatty'],
  ['gouda', 'Gouda / Edam / Swiss', 'gouda|edam|emmental|swiss cheese|gruyere', 356, 25, 2.2, 27.5, 0, 2.2, 'slice', 30, 'dairy fatty'],
  ['blue_cheese', 'Blue cheese', 'blue cheese|stilton|gorgonzola|roquefort', 355, 21, 2.3, 29, 0, 0.5, 'portion', 30, 'dairy fatty'],
  ['ricotta', 'Ricotta', 'ricotta', 150, 9, 4, 11, 0, 3, 'tablespoon', 60, 'dairy'],
  ['mascarpone', 'Mascarpone', 'mascarpone', 435, 4.5, 4.5, 44, 0, 4, 'tablespoon', 50, 'dairy fatty'],
  ['burrata', 'Burrata', 'burrata', 300, 15, 2.5, 25, 0, 1.5, 'ball', 100, 'dairy fatty'],
  ['cheese_slice', 'Processed cheese slice', 'cheese slice|processed cheese|cheese single', 280, 15, 6, 22, 0, 5, 'slice', 20, 'dairy processed'],
  ['light_cheese', 'Light cheese portion', 'light cheese|babybel|light babybel|cheese portion', 210, 25, 1, 12, 0, 1, 'portion', 20, 'dairy protein'],
  ['kefir', 'Kefir', 'kefir', 55, 3.5, 4.5, 2.5, 0, 4.5, 'glass', 250, 'dairy drink'],
  ['custard', 'Custard', 'custard', 100, 3, 16, 3, 0, 12, 'portion', 120, 'dairy treat'],
  ['rice_pudding', 'Rice pudding', 'rice pudding', 105, 3.5, 17, 2.5, 0.2, 10, 'pot', 150, 'dairy treat'],
  ['condensed_milk', 'Condensed milk', 'condensed milk', 320, 8, 55, 8, 0, 55, 'tablespoon', 20, 'dairy sugar'],
  ['whipped_cream', 'Whipped cream', 'whipped cream|squirty cream', 300, 2.5, 12, 27, 0, 11, 'portion', 15, 'dairy fatty'],

  // -------------------------------------------------------- meat & fish II
  ['chicken_drumstick', 'Chicken drumstick', 'drumstick|chicken drumstick|drumsticks', 175, 24, 0, 8.5, 0, 0, 'drumstick', 60, 'protein meat'],
  ['turkey_slices', 'Turkey slices (deli)', 'turkey slices|turkey ham|sliced turkey', 105, 22, 1.5, 1.5, 0, 1, 'slice', 25, 'protein lean processed'],
  ['roast_beef_slices', 'Roast beef / pastrami (sliced)', 'roast beef|pastrami|sliced beef', 140, 26, 0.5, 4, 0, 0.3, 'slice', 30, 'protein lean meat'],
  ['chorizo', 'Chorizo', 'chorizo', 455, 24, 2, 38.5, 0, 1, 'portion', 30, 'protein meat processed fatty'],
  ['prosciutto', 'Prosciutto / Parma ham', 'prosciutto|parma ham|serrano|cured ham', 250, 26, 0.3, 16, 0, 0, 'slice', 15, 'protein meat processed'],
  ['meatballs', 'Meatballs', 'meatball|meatballs', 230, 15, 8, 15.5, 0.8, 2, 'meatball', 25, 'protein meat'],
  ['pulled_pork', 'Pulled pork', 'pulled pork', 210, 24, 4, 11, 0.2, 3.5, 'portion', 150, 'protein meat'],
  ['pork_ribs', 'Pork ribs (BBQ)', 'ribs|pork ribs|bbq ribs|spare ribs', 320, 24, 2, 24, 0, 1.5, 'rib', 80, 'protein meat fatty'],
  ['liver', 'Liver (lamb or beef)', 'liver|lambs liver|beef liver', 165, 25, 3, 5.5, 0, 0, 'portion', 100, 'protein meat organ'],
  ['black_pudding', 'Black pudding', 'black pudding', 300, 11, 20, 20, 0.5, 1, 'slice', 30, 'protein meat processed'],
  ['seabass', 'Sea bass / bream', 'sea bass|seabass|bream|sea bream', 125, 21, 0, 4.5, 0, 0, 'fillet', 130, 'protein fish'],
  ['trout', 'Trout', 'trout|rainbow trout', 150, 21, 0, 7.5, 0, 0, 'fillet', 130, 'protein fish omega3'],
  ['halibut', 'Halibut / sole / tilapia', 'halibut|sole|plaice|tilapia', 110, 21, 0, 2.5, 0, 0, 'fillet', 150, 'protein fish lean'],
  ['swordfish', 'Swordfish', 'swordfish', 145, 23, 0, 6, 0, 0, 'steak', 150, 'protein fish'],
  ['squid_fried', 'Calamari (fried)', 'calamari|fried squid|fried calamari', 250, 14, 20, 13, 0.5, 0.5, 'portion', 120, 'protein fried'],
  ['squid', 'Squid (grilled)', 'squid|grilled squid|grilled calamari', 100, 17, 2, 2.5, 0, 0, 'portion', 120, 'protein fish lean'],
  ['mussels', 'Mussels', 'mussels|moules', 90, 13, 3.5, 2.5, 0, 0, 'portion', 150, 'protein fish'],
  ['scallops', 'Scallops', 'scallop|scallops', 90, 17, 3, 1, 0, 0, 'scallop', 25, 'protein fish lean'],
  ['crab', 'Crab meat', 'crab|crab meat', 90, 18, 0.5, 1.7, 0, 0, 'portion', 100, 'protein fish lean'],
  ['lobster', 'Lobster', 'lobster', 90, 19, 0.5, 1, 0, 0, 'portion', 150, 'protein fish lean'],
  ['oysters', 'Oysters', 'oyster|oysters', 70, 8, 4, 2.5, 0, 0, 'oyster', 25, 'protein fish'],
  ['anchovies', 'Anchovies', 'anchovy|anchovies', 210, 29, 0, 10, 0, 0, 'fillet', 4, 'protein fish omega3'],
  ['smoked_mackerel', 'Smoked mackerel', 'smoked mackerel', 305, 19, 0, 25.5, 0, 0, 'fillet', 90, 'protein fish omega3 fatty'],
  ['fish_cake', 'Fish cake', 'fish cake|fishcake|fish cakes', 190, 9, 19, 9, 1, 1, 'cake', 90, 'protein processed'],
  ['crab_sticks', 'Crab sticks', 'crab sticks|crab stick|surimi', 90, 8, 12, 0.5, 0, 3, 'stick', 17, 'protein processed'],

  // ------------------------------------------------------------- fruit II
  ['kiwi', 'Kiwi', 'kiwi|kiwis|kiwi fruit', 61, 1.1, 15, 0.5, 3, 9, 'kiwi', 70, 'fruit'],
  ['peach', 'Peach / nectarine', 'peach|peaches|nectarine|nectarines', 39, 0.9, 10, 0.3, 1.5, 8, 'peach', 130, 'fruit'],
  ['plum', 'Plum', 'plum|plums', 46, 0.7, 11, 0.3, 1.4, 10, 'plum', 65, 'fruit'],
  ['apricot', 'Apricot', 'apricot|apricots', 48, 1.4, 11, 0.4, 2, 9, 'apricot', 35, 'fruit'],
  ['cherries', 'Cherries', 'cherries|cherry', 63, 1.1, 16, 0.2, 2, 13, 'portion', 80, 'fruit'],
  ['watermelon', 'Watermelon', 'watermelon|water melon', 30, 0.6, 7.5, 0.2, 0.4, 6, 'slice', 200, 'fruit'],
  ['pomegranate', 'Pomegranate', 'pomegranate|pomegranate seeds', 83, 1.7, 19, 1.2, 4, 14, 'half', 90, 'fruit'],
  ['figs', 'Fig (fresh)', 'fig|figs|fresh figs', 74, 0.8, 19, 0.3, 3, 16, 'fig', 50, 'fruit'],
  ['grapefruit', 'Grapefruit', 'grapefruit', 42, 0.8, 11, 0.1, 1.6, 7, 'half', 120, 'fruit'],
  ['clementine', 'Clementine / mandarin', 'clementine|mandarin|satsuma|tangerine', 47, 0.9, 12, 0.2, 1.7, 9, 'clementine', 75, 'fruit'],
  ['lychee', 'Lychee', 'lychee|lychees', 66, 0.8, 17, 0.4, 1.3, 15, 'lychee', 10, 'fruit'],
  ['passion_fruit', 'Passion fruit', 'passion fruit|passionfruit', 97, 2.2, 23, 0.7, 10, 11, 'fruit', 18, 'fruit fibre'],
  ['dragon_fruit', 'Dragon fruit', 'dragon fruit|dragonfruit|pitaya', 60, 1.2, 13, 0.4, 3, 8, 'fruit', 200, 'fruit'],
  ['papaya', 'Papaya', 'papaya', 43, 0.5, 11, 0.3, 1.7, 8, 'portion', 140, 'fruit'],
  ['guava', 'Guava', 'guava', 68, 2.6, 14, 1, 5.4, 9, 'fruit', 55, 'fruit fibre'],
  ['prunes', 'Prunes', 'prune|prunes', 240, 2.2, 64, 0.4, 7, 38, 'prune', 9, 'fruit dried sugar'],
  ['raspberries', 'Raspberries', 'raspberries|raspberry', 52, 1.2, 12, 0.7, 6.5, 4.4, 'portion', 80, 'fruit fibre'],
  ['blackberries', 'Blackberries', 'blackberries|blackberry', 43, 1.4, 10, 0.5, 5, 5, 'portion', 80, 'fruit fibre'],
  ['cranberries_dried', 'Dried cranberries', 'dried cranberries|craisins', 308, 0.1, 82, 1.4, 5.7, 65, 'portion', 30, 'fruit dried sugar'],
  ['coconut_fresh', 'Coconut (fresh)', 'fresh coconut|coconut flesh|coconut chunks', 354, 3.3, 15, 33, 9, 6, 'portion', 45, 'fruit fat'],

  // --------------------------------------------------------------- veg II
  ['parsnip', 'Parsnip', 'parsnip|parsnips', 75, 1.2, 18, 0.3, 4.9, 4.8, 'parsnip', 100, 'veg'],
  ['brussels_sprouts', 'Brussels sprouts', 'brussels sprouts|sprouts', 43, 3.4, 9, 0.3, 3.8, 2.2, 'portion', 80, 'veg fibre'],
  ['pak_choi', 'Pak choi', 'pak choi|bok choy|pak choy', 13, 1.5, 2.2, 0.2, 1, 1.2, 'portion', 80, 'veg'],
  ['rocket', 'Rocket', 'rocket|arugula|watercress', 25, 2.6, 3.7, 0.7, 1.6, 2, 'handful', 20, 'veg'],
  ['red_cabbage', 'Red cabbage', 'red cabbage', 31, 1.4, 7, 0.2, 2.1, 3.8, 'portion', 80, 'veg'],
  ['sauerkraut', 'Sauerkraut', 'sauerkraut', 19, 0.9, 4.3, 0.1, 2.9, 1.8, 'portion', 75, 'veg fermented'],
  ['kimchi', 'Kimchi', 'kimchi', 23, 2, 4, 0.5, 1.6, 2, 'portion', 75, 'veg fermented'],
  ['gherkins', 'Pickles / gherkins', 'pickle|pickles|gherkin|gherkins|dill pickle', 14, 0.6, 2.7, 0.2, 1, 1.5, 'gherkin', 35, 'veg'],
  ['jalapenos_pickled', 'Jalapeños (pickled)', 'pickled jalapenos|jalapenos', 27, 0.9, 5, 0.9, 2.6, 3, 'tablespoon', 15, 'veg'],
  ['radish', 'Radish', 'radish|radishes', 16, 0.7, 3.4, 0.1, 1.6, 1.9, 'portion', 50, 'veg'],
  ['fennel', 'Fennel', 'fennel', 31, 1.2, 7.3, 0.2, 3.1, 3.9, 'portion', 90, 'veg'],
  ['mangetout', 'Mangetout / sugar snaps', 'mangetout|sugar snaps|sugar snap peas|snow peas', 42, 2.8, 7.5, 0.2, 2.6, 4, 'portion', 80, 'veg'],
  ['artichoke', 'Artichoke', 'artichoke|artichokes', 47, 3.3, 11, 0.2, 5.4, 1, 'artichoke', 120, 'veg fibre'],
  ['okra', 'Okra', 'okra|bamia|ladies fingers', 33, 1.9, 7.5, 0.2, 3.2, 1.5, 'portion', 80, 'veg'],
  ['roast_potatoes', 'Roast potatoes', 'roast potatoes|roast potato|roasties', 150, 2.9, 26, 4.5, 2.2, 0.6, 'portion', 200, 'carb'],
  ['potato_wedges', 'Potato wedges', 'wedges|potato wedges|sweet potato wedges', 190, 3, 30, 6.5, 3, 0.8, 'portion', 180, 'carb fried'],
  ['onion_rings', 'Onion rings', 'onion rings|onion ring', 330, 4.4, 38, 18, 2.5, 4, 'ring', 15, 'fried snack'],
  ['corn_cob', 'Corn on the cob', 'corn on the cob|corn cob', 95, 3.3, 19, 1.4, 2.5, 4.5, 'cob', 125, 'veg carb'],

  // ------------------------------------------------- grains & pasta dishes
  ['risotto', 'Risotto', 'risotto|mushroom risotto|chicken risotto', 155, 4, 22, 5.5, 0.8, 1, 'portion', 300, 'carb meal'],
  ['gnocchi', 'Gnocchi', 'gnocchi', 155, 4, 32, 0.7, 2, 0.5, 'portion', 175, 'carb'],
  ['polenta', 'Polenta (cooked)', 'polenta', 85, 2, 18, 0.5, 1, 0.3, 'portion', 175, 'carb'],
  ['bulgur_cooked', 'Bulgur wheat (cooked)', 'bulgur|bulgar|burghul|bulgur wheat', 83, 3.1, 17, 0.2, 4.5, 0.1, 'portion', 150, 'carb wholegrain'],
  ['pearl_barley', 'Pearl barley (cooked)', 'pearl barley|barley', 123, 2.3, 26, 0.4, 3.8, 0.3, 'portion', 150, 'carb wholegrain'],
  ['freekeh', 'Freekeh (cooked)', 'freekeh', 120, 4.5, 24, 0.8, 4.5, 0.4, 'portion', 150, 'carb wholegrain'],
  ['soba', 'Soba noodles (cooked)', 'soba|soba noodles|buckwheat noodles', 99, 5, 20, 0.1, 1.5, 0, 'portion', 180, 'carb'],
  ['udon', 'Udon noodles (cooked)', 'udon|udon noodles', 105, 2.6, 21, 0.4, 1, 0.2, 'portion', 200, 'carb'],
  ['vermicelli', 'Rice vermicelli (cooked)', 'vermicelli|rice noodles cooked|glass noodles', 110, 1.8, 25, 0.2, 0.9, 0, 'portion', 180, 'carb'],
  ['mac_cheese', 'Mac and cheese', 'mac and cheese|macaroni cheese|mac n cheese', 180, 7, 20, 8, 1, 3, 'portion', 300, 'carb meal fatty'],
  ['lasagne', 'Lasagne', 'lasagne|lasagna', 150, 9, 13, 7, 1.2, 3, 'portion', 350, 'meal protein'],
  ['spag_bol', 'Spaghetti bolognese', 'spaghetti bolognese|spag bol|bolognese', 130, 7.5, 15, 4.5, 1.5, 3, 'plate', 400, 'meal protein'],
  ['carbonara', 'Spaghetti carbonara', 'carbonara|spaghetti carbonara|pasta carbonara', 180, 8, 17, 9, 1, 1.5, 'plate', 350, 'meal fatty'],
  ['pasta_bake', 'Pasta bake', 'pasta bake|tuna pasta bake|chicken pasta bake', 145, 7, 17, 5.5, 1.5, 3.5, 'portion', 350, 'meal'],
  ['ravioli', 'Ravioli / tortellini', 'ravioli|tortellini', 175, 7, 25, 5.5, 1.8, 2, 'portion', 250, 'carb meal'],

  // ------------------------------------------------------ world dishes II
  ['satay_chicken', 'Chicken satay (with sauce)', 'satay|chicken satay|satay chicken|satay skewers', 200, 18, 6, 12, 1, 4, 'skewer', 60, 'protein meal'],
  ['nasi_goreng', 'Nasi goreng', 'nasi goreng|indonesian fried rice', 160, 7, 20, 5.5, 1.2, 2, 'plate', 350, 'carb meal'],
  ['laksa', 'Laksa', 'laksa', 90, 5, 9, 4, 1, 2, 'bowl', 450, 'meal soup'],
  ['teriyaki_chicken', 'Teriyaki chicken', 'teriyaki chicken|chicken teriyaki', 150, 17, 9, 5, 0.3, 7, 'portion', 250, 'protein meal'],
  ['green_curry', 'Thai green / red curry', 'green curry|red curry|thai curry|thai green curry', 130, 9, 5, 8.5, 1, 3, 'portion', 350, 'meal'],
  ['massaman', 'Massaman curry', 'massaman|massaman curry', 160, 8, 10, 10, 1.5, 5, 'portion', 350, 'meal fatty'],
  ['tom_yum', 'Tom yum soup', 'tom yum|tom yum soup', 45, 4.5, 4, 1.3, 0.5, 2, 'bowl', 400, 'soup lean'],
  ['prawn_toast', 'Prawn toast', 'prawn toast|sesame prawn toast', 300, 11, 22, 19, 1.5, 1, 'piece', 20, 'fried snack'],
  ['prawn_crackers', 'Prawn crackers', 'prawn crackers|prawn cracker', 530, 1, 60, 31, 0.5, 1, 'portion', 25, 'fried snack'],
  ['bao_bun', 'Bao bun (filled)', 'bao|bao bun|steamed bun', 220, 8, 35, 5.5, 1.5, 6, 'bun', 75, 'carb meal'],
  ['banh_mi', 'Bánh mì', 'banh mi|bahn mi', 230, 11, 30, 7.5, 2, 4, 'sandwich', 250, 'meal'],
  ['miso_soup', 'Miso soup', 'miso soup', 35, 2.5, 4, 1, 0.7, 1.3, 'bowl', 250, 'soup lean'],
  ['sashimi', 'Sashimi', 'sashimi|salmon sashimi|tuna sashimi', 130, 22, 0.5, 4.5, 0, 0, 'portion', 100, 'protein fish lean'],
  ['nigiri', 'Sushi nigiri', 'nigiri|sushi nigiri|salmon nigiri', 145, 7, 25, 1.7, 0.4, 4, 'piece', 30, 'carb fish'],
  ['kung_pao', 'Kung pao chicken', 'kung pao|kung po|kung pao chicken', 155, 13, 9, 7.5, 1.2, 4, 'portion', 300, 'protein meal'],
  ['singapore_noodles', 'Singapore noodles', 'singapore noodles', 145, 8, 18, 4.5, 1.5, 2, 'plate', 350, 'carb meal'],
  ['taco', 'Taco (filled)', 'taco|tacos|beef taco', 215, 11, 19, 11, 2.5, 2, 'taco', 100, 'meal'],
  ['quesadilla', 'Quesadilla', 'quesadilla|chicken quesadilla', 300, 13, 26, 16, 1.8, 2, 'half', 150, 'meal fatty'],
  ['fajitas', 'Fajita (chicken, built)', 'fajita|fajitas|chicken fajitas', 150, 12, 13, 5.5, 1.7, 3, 'fajita', 150, 'meal protein'],
  ['enchilada', 'Enchilada', 'enchilada|enchiladas', 190, 10, 17, 9.5, 2, 3, 'enchilada', 180, 'meal'],
  ['refried_beans', 'Refried beans', 'refried beans', 90, 5.5, 13, 1.8, 5, 0.5, 'portion', 120, 'carb fibre'],
  ['gyros', 'Gyros', 'gyros|gyro|greek wrap', 220, 15, 15, 11, 1, 2, 'wrap', 300, 'meal protein'],
  ['greek_salad', 'Greek salad', 'greek salad|horiatiki', 105, 3.5, 5, 8, 1.5, 3.5, 'bowl', 250, 'salad veg'],
  ['moussaka', 'Moussaka', 'moussaka', 145, 8, 9, 8.5, 1.5, 4, 'portion', 300, 'meal'],
  ['souvlaki', 'Souvlaki skewer', 'souvlaki|pork skewer|chicken skewer', 165, 22, 2, 8, 0.3, 1, 'skewer', 90, 'protein meat'],
  ['halloumi_fries', 'Halloumi fries', 'halloumi fries', 330, 15, 15, 24, 1, 1.5, 'portion', 120, 'fried dairy'],
  ['falafel_wrap', 'Falafel wrap', 'falafel wrap', 230, 8, 28, 10, 4, 3, 'wrap', 280, 'meal veggie'],
  ['paella', 'Paella', 'paella', 145, 9, 18, 4, 1, 1, 'portion', 300, 'carb meal'],
  ['rogan_josh', 'Rogan josh / madras', 'rogan josh|madras|vindaloo|lamb curry', 145, 12, 5, 9, 1.2, 3, 'portion', 300, 'meal protein'],
  ['saag', 'Saag / palak paneer', 'saag|palak paneer|saag paneer|palak', 150, 7, 6, 11, 2.5, 3, 'portion', 250, 'meal veg'],
  ['seekh_kebab', 'Seekh kebab', 'seekh kebab|sheek kebab', 250, 18, 4, 18, 1, 1, 'kebab', 90, 'protein meat'],
  ['pakora', 'Pakora / onion bhaji', 'pakora|bhaji|onion bhaji|pakoras', 280, 7, 26, 16.5, 4, 3, 'piece', 45, 'fried snack'],
  ['roti_chapati', 'Roti / chapati', 'roti|chapati|chapatti', 300, 9, 50, 7, 5, 2, 'roti', 45, 'carb bread'],
  ['paratha', 'Paratha', 'paratha|parotta', 330, 7, 43, 14, 4, 2, 'paratha', 80, 'carb bread fatty'],
  ['dosa', 'Dosa', 'dosa|masala dosa', 170, 4, 27, 5, 1.5, 1, 'dosa', 120, 'carb'],
  ['fish_pie', 'Fish pie', 'fish pie', 120, 8, 11, 4.5, 0.8, 1.5, 'portion', 350, 'meal'],
  ['cottage_pie', 'Cottage / shepherd’s pie', 'cottage pie|shepherds pie|shepherd pie', 115, 7, 11, 4.5, 1.3, 1.5, 'portion', 350, 'meal'],
  ['sunday_roast', 'Sunday roast (full plate)', 'sunday roast|roast dinner|sunday lunch', 145, 11, 12, 5.5, 1.8, 2, 'plate', 450, 'meal'],
  ['yorkshire_pudding', 'Yorkshire pudding', 'yorkshire pudding|yorkshire puddings', 300, 9, 38, 12, 1.5, 3, 'pudding', 30, 'carb'],
  ['stuffing', 'Stuffing', 'stuffing|sage and onion stuffing', 230, 6, 30, 9, 2, 2, 'portion', 60, 'carb'],
  ['steak_pie', 'Steak / chicken pie', 'steak pie|chicken pie|meat pie|puff pastry pie', 270, 10, 24, 15, 1.2, 1, 'portion', 200, 'meal fatty'],
  ['quiche', 'Quiche', 'quiche|quiche lorraine', 265, 9, 17, 18, 1, 2, 'slice', 125, 'meal fatty'],
  ['tuna_melt', 'Tuna melt', 'tuna melt', 250, 14, 22, 12, 1.5, 3, 'sandwich', 200, 'meal'],
  ['blt', 'BLT sandwich', 'blt|bacon sandwich|bacon butty', 240, 11, 24, 11.5, 1.8, 3, 'sandwich', 180, 'meal'],
  ['cheese_toastie', 'Cheese toastie', 'cheese toastie|grilled cheese|toastie|toasted sandwich', 300, 12, 28, 16, 1.7, 3, 'toastie', 140, 'meal fatty'],
  ['chicken_caesar_wrap', 'Chicken caesar wrap', 'chicken caesar wrap|caesar wrap|chicken wrap', 220, 14, 20, 9.5, 1.3, 2, 'wrap', 250, 'meal protein'],
  ['mozzarella_sticks', 'Mozzarella sticks', 'mozzarella sticks|cheese sticks', 330, 14, 26, 19, 1.5, 2, 'stick', 25, 'fried snack'],
  ['arancini', 'Arancini', 'arancini', 250, 7, 30, 11, 1.7, 1.5, 'ball', 80, 'fried snack'],
  ['bruschetta', 'Bruschetta', 'bruschetta', 190, 5, 27, 7, 2, 3, 'piece', 60, 'carb starter'],
  ['calzone', 'Calzone', 'calzone', 260, 11, 30, 11, 2, 3, 'calzone', 350, 'meal carb'],

  // --------------------------------------------------- middle east & gulf II
  ['umm_ali', 'Umm Ali', 'umm ali|om ali', 250, 5.5, 30, 12.5, 1, 20, 'portion', 150, 'dessert sugar'],
  ['basbousa', 'Basbousa', 'basbousa|harissa cake|semolina cake', 350, 5, 55, 12.5, 1.3, 38, 'piece', 80, 'dessert sugar'],
  ['maamoul', 'Maamoul', 'maamoul|mamoul|date cookie', 430, 6, 60, 18.5, 2, 28, 'piece', 25, 'dessert sugar'],
  ['mahalabia', 'Mahalabia', 'mahalabia|muhallabia|milk pudding', 130, 3.5, 20, 4, 0.2, 16, 'pot', 150, 'dessert dairy'],
  ['vine_leaves', 'Stuffed vine leaves', 'vine leaves|warak enab|dolma|stuffed grape leaves', 160, 3, 21, 7, 3, 1.5, 'piece', 30, 'veg meal'],
  ['muhammara', 'Muhammara', 'muhammara|red pepper dip', 250, 4, 18, 18, 3.5, 8, 'tablespoon', 30, 'sauce fat'],
  ['fatteh', 'Fatteh', 'fatteh|fatta', 160, 7, 15, 8.5, 2, 2, 'portion', 250, 'meal'],
  ['harees', 'Harees', 'harees|jareesh', 110, 6, 15, 3, 1.5, 0.3, 'portion', 250, 'meal wholegrain'],
  ['mint_lemonade', 'Mint lemonade', 'mint lemonade|lemon mint|limonana', 45, 0.2, 11, 0, 0.3, 10, 'glass', 300, 'drink sugar'],
  ['arabic_coffee', 'Arabic coffee', 'arabic coffee|gahwa|qahwa|turkish coffee', 5, 0.3, 0.8, 0.1, 0, 0, 'cup', 60, 'drink zero'],

  // -------------------------------------------------------- breakfast II
  ['muesli', 'Muesli', 'muesli', 360, 10, 62, 6.5, 8, 17, 'portion', 50, 'carb breakfast fibre'],
  ['cornflakes', 'Cornflakes', 'cornflakes|corn flakes|rice krispies', 380, 7, 84, 0.9, 3, 8, 'bowl', 30, 'carb breakfast'],
  ['porridge', 'Porridge (made with milk)', 'porridge|porridge with milk|oatmeal bowl', 115, 4.5, 16, 3.5, 1.7, 6, 'bowl', 300, 'carb breakfast'],
  ['eggs_benedict', 'Eggs benedict', 'eggs benedict|eggs royale|eggs florentine', 230, 12, 12, 15, 0.7, 1.5, 'portion', 300, 'breakfast fatty'],
  ['breakfast_burrito', 'Breakfast burrito', 'breakfast burrito|breakfast wrap', 210, 11, 19, 10, 1.7, 1.5, 'burrito', 300, 'meal breakfast'],
  ['avocado_toast', 'Avocado toast', 'avocado toast|avo toast|avocado on toast', 210, 5, 20, 12.5, 4, 1.8, 'slice', 130, 'breakfast'],

  // ---------------------------------------------------- snacks & sweets II
  ['choc_bar', 'Chocolate bar (Snickers-class)', 'snickers|mars bar|twix|kitkat|kit kat|bounty|chocolate bar', 490, 8, 58, 24, 2, 48, 'bar', 50, 'sugar treat'],
  ['gummy_sweets', 'Gummy sweets', 'haribo|gummy bears|wine gums|jelly sweets|gummies|sweets', 340, 6, 77, 0.2, 0.1, 55, 'portion', 30, 'sugar treat'],
  ['oreos', 'Oreos', 'oreo|oreos', 480, 5, 69, 20, 2.5, 38, 'biscuit', 11, 'sugar treat'],
  ['jaffa_cakes', 'Jaffa cakes', 'jaffa cake|jaffa cakes', 380, 3.5, 70, 8, 2, 52, 'cake', 12, 'sugar treat'],
  ['brownie', 'Brownie', 'brownie|brownies|chocolate brownie', 450, 5, 55, 23, 2, 40, 'brownie', 60, 'sugar treat'],
  ['cookie', 'Cookie', 'cookie|cookies|chocolate chip cookie', 480, 5, 62, 23, 2, 35, 'cookie', 50, 'sugar treat'],
  ['white_chocolate', 'White chocolate', 'white chocolate', 540, 6, 58, 31, 0, 57, 'portion', 25, 'sugar treat'],
  ['fudge', 'Fudge', 'fudge', 440, 2, 76, 14, 0, 70, 'piece', 25, 'sugar treat'],
  ['marshmallow', 'Marshmallows', 'marshmallow|marshmallows', 330, 4, 79, 0.2, 0, 58, 'marshmallow', 7, 'sugar treat'],
  ['tiramisu', 'Tiramisu', 'tiramisu', 290, 5, 33, 15, 0.8, 24, 'portion', 120, 'dessert sugar'],
  ['cheesecake', 'Cheesecake', 'cheesecake', 320, 5.5, 26, 22, 0.6, 20, 'slice', 120, 'dessert sugar'],
  ['apple_pie', 'Apple pie', 'apple pie|apple tart', 240, 2.4, 34, 11, 1.6, 16, 'slice', 125, 'dessert sugar'],
  ['crumble', 'Fruit crumble', 'crumble|apple crumble|rhubarb crumble', 220, 2.5, 34, 8.5, 2, 20, 'portion', 150, 'dessert sugar'],
  ['sticky_toffee', 'Sticky toffee pudding', 'sticky toffee pudding|sticky toffee', 330, 3.5, 48, 14, 1, 34, 'portion', 130, 'dessert sugar'],
  ['churros', 'Churros', 'churros', 390, 5, 45, 21, 1.5, 15, 'portion', 100, 'dessert fried'],
  ['creme_brulee', 'Crème brûlée', 'creme brulee|panna cotta', 260, 4.5, 22, 17, 0, 20, 'pot', 120, 'dessert'],
  ['sorbet', 'Sorbet', 'sorbet', 130, 0.2, 32, 0.1, 0.5, 26, 'scoop', 80, 'dessert sugar'],
  ['frozen_yoghurt', 'Frozen yoghurt', 'frozen yoghurt|froyo|frozen yogurt', 130, 4, 22, 2.5, 0.3, 20, 'portion', 120, 'dessert dairy'],
  ['trail_mix', 'Trail mix', 'trail mix|fruit and nut mix|fruit and nut', 480, 14, 40, 29, 6, 25, 'handful', 30, 'snack nuts'],
  ['protein_ball', 'Protein ball', 'protein ball|protein balls|energy ball', 400, 22, 38, 17, 6, 22, 'ball', 40, 'snack protein'],

  // -------------------------------------------------------------- drinks II
  ['cappuccino', 'Cappuccino', 'cappuccino', 35, 1.9, 3.3, 1.5, 0, 3.3, 'cup', 240, 'drink dairy'],
  ['flat_white', 'Flat white', 'flat white', 45, 2.4, 4, 2.2, 0, 4, 'cup', 200, 'drink dairy'],
  ['mocha', 'Mocha', 'mocha|caffe mocha', 75, 2.5, 10, 2.8, 0.5, 8.5, 'cup', 300, 'drink sugar'],
  ['hot_chocolate', 'Hot chocolate', 'hot chocolate|cocoa drink', 80, 2.5, 12, 2.5, 0.5, 10.5, 'mug', 300, 'drink sugar'],
  ['matcha_latte', 'Matcha latte', 'matcha|matcha latte', 55, 2, 8, 1.8, 0, 7.5, 'cup', 300, 'drink'],
  ['apple_juice', 'Apple juice', 'apple juice', 46, 0.1, 11, 0.1, 0, 10, 'glass', 250, 'drink sugar'],
  ['cranberry_juice', 'Cranberry juice', 'cranberry juice', 49, 0, 12, 0.1, 0, 11, 'glass', 250, 'drink sugar'],
  ['mango_juice', 'Mango juice', 'mango juice|mango nectar', 55, 0.3, 13.5, 0.1, 0.2, 12.5, 'glass', 250, 'drink sugar'],
  ['pomegranate_juice', 'Pomegranate juice', 'pomegranate juice', 54, 0.2, 13, 0.1, 0, 12.5, 'glass', 250, 'drink sugar'],
  ['lemonade', 'Lemonade', 'lemonade|sprite|7up', 40, 0, 10, 0, 0, 9.5, 'glass', 330, 'drink sugar'],
  ['iced_tea', 'Iced tea', 'iced tea|ice tea', 30, 0, 7.5, 0, 0, 7, 'bottle', 330, 'drink sugar'],
  ['kombucha', 'Kombucha', 'kombucha', 25, 0, 6, 0, 0, 5, 'bottle', 330, 'drink'],
  ['coconut_water', 'Coconut water', 'coconut water', 19, 0.7, 4.5, 0.2, 0, 4, 'glass', 300, 'drink'],
  ['bubble_tea', 'Bubble tea', 'bubble tea|boba', 90, 1, 20, 1, 0, 17, 'cup', 500, 'drink sugar'],
  ['prosecco', 'Prosecco / champagne', 'prosecco|champagne|sparkling wine|cava', 76, 0.1, 1.5, 0, 0, 1, 'glass', 125, 'alcohol drink'],
  ['rose_wine', 'Rosé wine', 'rose|rose wine', 78, 0.1, 2.5, 0, 0, 2, 'glass', 175, 'alcohol drink'],
  ['baileys', 'Baileys / cream liqueur', 'baileys|cream liqueur', 330, 3, 25, 13, 0, 20, 'measure', 50, 'alcohol drink sugar'],
  ['aperol_spritz', 'Aperol spritz', 'aperol|aperol spritz|spritz', 85, 0, 10, 0, 0, 9, 'glass', 200, 'alcohol drink'],
]

const TAG_SPLIT = /\s+/

/** @typedef {{id:string,name:string,aliases:string[],per100:{kcal:number,protein:number,carbs:number,fat:number,fibre:number,sugar:number},unit:{name:string,grams:number},tags:string[]}} Food */

/** @type {Food[]} */
export const FOODS = ROWS.map(
  ([id, name, aliases, kcal, protein, carbs, fat, fibre, sugar, unitName, unitGrams, tags]) => {
    const food = {
      id,
      name,
      aliases: String(aliases).split('|').filter(Boolean),
      per100: { kcal, protein, carbs, fat, fibre, sugar },
      unit: { name: unitName, grams: unitGrams },
      tags: String(tags).split(TAG_SPLIT).filter(Boolean),
    }
    // How much of that sugar figure counts against the NHS guideline. Total
    // sugars include the fruit and the milk; free sugars are the ones the
    // advice is actually about. See sugar.js.
    food.freeSugarShare = freeSugarShareFor(food)
    food.per100.freeSugar = Math.round(sugar * food.freeSugarShare * 10) / 10
    return food
  }
)

export const FOODS_BY_ID = new Map(FOODS.map((f) => [f.id, f]))

/**
 * Alcohol by volume, as a percentage, for every drink that contains any.
 *
 * Kept beside the food table rather than inside a row because it drives a
 * different number: UK alcohol units, where one unit is 10 ml of pure
 * ethanol. Units are what the drinking guideline is written in (no more than
 * 14 a week), and calories alone do not tell you whether you are near it —
 * a 175 ml glass of red is 2.3 units but only 149 kcal, less than a banana
 * and a coffee.
 *
 * Mixed drinks carry the ABV of the finished glass, not of the spirit in it:
 * a gin and tonic is a 25 ml measure of 40% in a 250 ml glass, so 4%.
 */
export const ABV = {
  beer_lager: 4.5,
  beer_strong: 6,
  cider: 4.5,
  wine_red: 13,
  wine_white: 12,
  rose_wine: 12,
  prosecco: 11.5,
  spirits: 40,
  cocktail: 10,
  gin_tonic: 4,
  baileys: 17,
  aperol_spritz: 11,
  guinness: 4.2,
  guinness_extra: 5.6,
  brewdog_punk: 5.4,
  brewdog_hazy: 5,
  lost_lager: 4.7,
  // Deliberately absent: the 0.0 and AF entries. At 0.5% a whole can is
  // 0.17 units, which is noise, and counting it would discourage the one
  // swap that actually helps.
}

/** UK units in a serving. One unit = 10 ml of pure ethanol. */
export function unitsFor(foodId, ml) {
  const abv = ABV[foodId]
  if (!abv || !ml) return 0
  return Math.round(((ml * abv) / 1000) * 10) / 10
}

/**
 * Alias lookup table. Aliases are stored longest-first so that a phrase like
 * "sweet potato" wins over the shorter "potato" when both could match.
 */
export const ALIAS_INDEX = (() => {
  /** @type {Array<{term:string, food:Food}>} */
  const entries = []
  for (const food of FOODS) {
    const terms = new Set([food.name.toLowerCase(), ...food.aliases.map((a) => a.toLowerCase())])
    for (const term of terms) entries.push({ term, food })
  }
  entries.sort((a, b) => b.term.length - a.term.length)
  return entries
})()
