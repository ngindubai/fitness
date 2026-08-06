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
  ['oats', 'Porridge oats (dry)', 'oats|porridge|oatmeal|rolled oats', 379, 13, 68, 6.5, 10, 1, 'serving', 40, 'carb fibre breakfast'],
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
  ['lettuce', 'Lettuce / salad leaves', 'lettuce|salad|salad leaves|rocket|mixed leaves', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 'portion', 60, 'veg'],
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
  ['berries_mixed', 'Mixed berries', 'berries|mixed berries|raspberries|blackberries', 43, 1.1, 10, 0.4, 4.5, 5.5, 'portion', 100, 'fruit fibre'],
  ['blueberries', 'Blueberries', 'blueberries', 57, 0.7, 14, 0.3, 2.4, 10, 'portion', 100, 'fruit'],
  ['strawberries', 'Strawberries', 'strawberries', 32, 0.7, 7.7, 0.3, 2, 4.9, 'portion', 100, 'fruit fibre'],
  ['grapes', 'Grapes', 'grapes', 69, 0.7, 18, 0.2, 0.9, 16, 'portion', 100, 'fruit sugary'],
  ['pineapple', 'Pineapple', 'pineapple', 50, 0.5, 13, 0.1, 1.4, 10, 'portion', 100, 'fruit'],
  ['mango', 'Mango', 'mango', 60, 0.8, 15, 0.4, 1.6, 14, 'portion', 165, 'fruit sugary'],
  ['pear', 'Pear', 'pear|pears', 57, 0.4, 15, 0.1, 3.1, 10, 'pear', 178, 'fruit fibre'],
  ['melon', 'Melon', 'melon|watermelon|honeydew', 34, 0.6, 8, 0.2, 0.9, 8, 'portion', 150, 'fruit'],
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
  ['tomato_pasta_sauce', 'Tomato pasta sauce', 'pasta sauce|tomato sauce jar|passata|marinara', 55, 1.6, 8.5, 1.5, 1.6, 6, 'portion', 125, 'sauce'],

  // -------------------------------------------------- snacks, sweets, junk
  ['crisps', 'Crisps / potato chips', 'crisps|potato chips|packet of crisps', 536, 6.6, 53, 34, 4.4, 0.6, 'packet', 25, 'snack junk fried'],
  ['chocolate_milk', 'Milk chocolate', 'chocolate|milk chocolate|choc', 535, 7.6, 59, 30, 3.4, 52, 'bar', 45, 'snack junk sugary'],
  ['chocolate_dark', 'Dark chocolate (70%)', 'dark chocolate', 598, 7.8, 46, 43, 11, 24, 'square', 10, 'snack sugary'],
  ['biscuits', 'Biscuits', 'biscuit|biscuits|cookie|cookies|digestive|digestives', 471, 6, 65, 21, 2.5, 28, 'biscuit', 15, 'snack junk sugary'],
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
  ['latte', 'Latte / cappuccino', 'latte|flat white|cappuccino|spanish latte|iced latte|mocha', 48, 2.6, 4.2, 2.4, 0, 4.2, 'cup', 300, 'drink dairy'],
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
  ['beer_lager', 'Lager / beer (4.5%)', 'beer|lager|pint|pint of lager|ale', 43, 0.5, 3.6, 0, 0, 0.3, 'pint', 568, 'alcohol drink'],
  ['beer_strong', 'Strong beer / IPA (6%)', 'ipa|craft beer|strong beer', 57, 0.6, 4.5, 0, 0, 0.4, 'pint', 568, 'alcohol drink'],
  ['cider', 'Cider', 'cider', 45, 0, 5.3, 0, 0, 5.3, 'pint', 568, 'alcohol drink sugary'],
  ['wine_red', 'Red wine', 'red wine|wine|glass of wine', 85, 0.1, 2.6, 0, 0, 0.6, 'glass', 175, 'alcohol drink'],
  ['wine_white', 'White wine', 'white wine|prosecco|champagne', 82, 0.1, 2.6, 0, 0, 1, 'glass', 175, 'alcohol drink'],
  ['spirits', 'Spirits (40%)', 'vodka|gin|whisky|whiskey|rum|spirits|shot', 231, 0, 0, 0, 0, 0, 'single', 25, 'alcohol drink'],
  ['cocktail', 'Cocktail (average)', 'cocktail|mojito|margarita', 160, 0.2, 18, 0, 0, 17, 'glass', 200, 'alcohol drink sugary'],
  ['gin_tonic', 'Gin & tonic', 'gin and tonic|g and t|gin tonic', 60, 0, 6, 0, 0, 6, 'glass', 250, 'alcohol drink'],

  // --------------------------------------------- middle east & south asia
  ['shawarma_chicken', 'Chicken shawarma (wrap)', 'chicken shawarma|shawarma|shwarma|shawarma wrap|chicken shawarma wrap', 200, 14, 19, 8, 1.5, 2, 'wrap', 250, 'takeaway protein'],
  ['shawarma_meat', 'Meat shawarma (wrap)', 'meat shawarma|beef shawarma|lamb shawarma|shawarma plate|shawarma meat', 225, 15, 17, 11, 1.4, 2, 'wrap', 250, 'takeaway protein'],
  ['falafel', 'Falafel', 'falafel|felafel|falafel wrap|falafel sandwich', 333, 13.3, 31.8, 17.8, 4.9, 2, 'piece', 25, 'veg protein fried'],
  ['halloumi', 'Halloumi (grilled)', 'halloumi|haloumi|grilled halloumi|halloumi cheese', 321, 22, 2.2, 25, 0, 2, 'portion', 80, 'dairy protein'],
  ['labneh', 'Labneh', 'labneh|labaneh|strained yoghurt', 160, 8, 5, 12, 0, 4.5, 'portion', 60, 'dairy protein breakfast'],
  ['manakish', 'Manakish (zaatar)', 'manakish|manakeesh|zaatar bread|zaatar manakish|cheese manakish', 280, 8, 38, 11, 2.5, 2, 'piece', 150, 'carb breakfast'],
  ['biryani', 'Chicken biryani', 'biryani|chicken biryani|lamb biryani|briyani', 150, 8, 18, 5, 1, 1.5, 'portion', 400, 'takeaway carb protein'],
  ['kabsa', 'Kabsa / mandi (chicken & rice)', 'kabsa|mandi|machboos|majboos|chicken mandi|lamb mandi|chicken kabsa', 160, 10, 19, 5, 1, 1, 'portion', 400, 'takeaway carb protein'],
  ['tabbouleh', 'Tabbouleh', 'tabbouleh|tabouleh|tabouli', 130, 3, 17, 6, 3.5, 2.5, 'portion', 150, 'veg fibre'],
  ['fattoush', 'Fattoush', 'fattoush|fatoush|fattoush salad', 90, 2, 10, 5, 2, 3, 'portion', 200, 'veg fibre'],
  ['moutabal', 'Moutabal / baba ganoush', 'moutabal|mutabal|baba ganoush|baba ghanoush|eggplant dip', 130, 2.5, 8, 10, 3, 4, 'portion', 80, 'veg fat'],
  ['kibbeh', 'Kibbeh (fried)', 'kibbeh|kibbe|kubbeh', 250, 12, 20, 14, 2, 1, 'piece', 60, 'protein fried'],
  ['kofta', 'Kofta / kebab skewer', 'kofta|kofte|kafta|kofta kebab|meat skewer|seekh kebab', 250, 17, 6, 17, 1, 1.5, 'skewer', 100, 'protein meat'],
  ['mixed_grill', 'Mixed grill (meats)', 'mixed grill|meat platter|grill platter|mashawi', 220, 22, 2, 14, 0.5, 1, 'portion', 300, 'protein meat'],
  ['shakshuka', 'Shakshuka', 'shakshuka|shakshouka|eggs in tomato', 118, 7, 6, 7.5, 1.8, 4, 'portion', 300, 'protein breakfast'],
  ['foul', 'Foul medames', 'foul|ful|foul medames|ful medames|fava beans', 110, 7.6, 16, 2.5, 5, 1, 'portion', 250, 'protein fibre breakfast'],
  ['samosa', 'Samosa', 'samosa|samosas|sambousek', 260, 5, 28, 14, 2.5, 2, 'piece', 60, 'fried snack'],
  ['dal', 'Dal / lentil curry', 'dal|daal|dhal|lentil curry|dal tadka', 110, 6, 14, 3, 4, 1.5, 'portion', 250, 'protein fibre veg'],
  ['butter_chicken', 'Butter chicken', 'butter chicken|chicken makhani|murgh makhani', 165, 13, 5, 10.5, 0.8, 3.5, 'portion', 350, 'takeaway protein'],
  ['chicken_tikka', 'Chicken tikka (grilled)', 'chicken tikka|tandoori chicken|tikka skewer', 150, 22, 3, 6, 0.5, 1.5, 'portion', 200, 'protein lean'],
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
  ['hammour', 'Hammour (white fish)', 'hammour|hamour|grouper|sea bass|seabass|bream', 90, 19, 0, 1, 0, 0, 'fillet', 180, 'protein fish lean'],
  ['loaded_fries', 'Loaded fries', 'loaded fries|cheese fries|shawarma fries|dirty fries', 290, 8, 30, 15, 2.5, 1.5, 'portion', 300, 'junk fried'],
  ['wings_fried', 'Fried chicken wings (breaded)', 'fried wings|fried chicken|kfc|breaded wings', 320, 19, 12, 22, 0.8, 0.5, 'piece', 45, 'junk fried protein'],
  ['omelette', 'Omelette (plain, cooked in oil)', 'omelette|omelet|egg white omelette', 175, 11, 1, 14, 0, 0.5, 'omelette', 180, 'protein breakfast'],
  ['protein_pancakes', 'Protein pancakes', 'protein pancakes|protein pancake', 200, 15, 22, 5, 1.5, 5, 'stack', 200, 'protein breakfast'],
  ['pancakes', 'Pancakes with syrup', 'pancakes|pancake|waffles|french toast', 280, 6, 42, 10, 1, 18, 'stack', 200, 'sugary breakfast treat'],
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
]

const TAG_SPLIT = /\s+/

/** @typedef {{id:string,name:string,aliases:string[],per100:{kcal:number,protein:number,carbs:number,fat:number,fibre:number,sugar:number},unit:{name:string,grams:number},tags:string[]}} Food */

/** @type {Food[]} */
export const FOODS = ROWS.map(
  ([id, name, aliases, kcal, protein, carbs, fat, fibre, sugar, unitName, unitGrams, tags]) => ({
    id,
    name,
    aliases: String(aliases).split('|').filter(Boolean),
    per100: { kcal, protein, carbs, fat, fibre, sugar },
    unit: { name: unitName, grams: unitGrams },
    tags: String(tags).split(TAG_SPLIT).filter(Boolean),
  })
)

export const FOODS_BY_ID = new Map(FOODS.map((f) => [f.id, f]))

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
