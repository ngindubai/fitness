/**
 * Nutrition-label text parser.
 *
 * Takes the raw text an OCR pass produces from a photographed nutrition
 * panel and pulls out the per-100g figures. No AI involved: labels follow a
 * legally mandated format (Energy / Fat / Carbohydrate / Fibre / Protein,
 * per 100 g and often per serving), so pattern-matching does the job.
 *
 * OCR output is messy - commas for decimals, O for 0, l for 1, columns
 * jumbled - so every extraction is defensive and the caller always shows
 * the result in an editable form before anything is saved.
 */

/** Normalise the worst OCR habits before matching. */
function cleanText(raw) {
  let text = String(raw || '')
    .replace(/\r/g, '\n')
    // Decimal commas between digits become dots: "12,5" -> "12.5".
    .replace(/(\d),(\d)/g, '$1.$2')
  // Letter lookalikes inside numbers, healed until stable because "2OO0"
  // needs the second O fixed after the first one is.
  let before
  do {
    before = text
    text = text
      .replace(/(?<=\d)[Oo](?=[\dOo]|\b)/g, '0')
      .replace(/(?<=\d)l(?=\d)/g, '1')
  } while (text !== before)
  // "9" misread for "g" is unfixable safely; leave it to the human.
  return text.toLowerCase()
}

/**
 * All numbers on a line, in order. Units are stripped but remembered so kJ
 * can be told apart from kcal.
 */
function numbersOn(line) {
  const out = []
  const re = /(\d+(?:\.\d+)?)\s*(kj|kcal|cal|g|mg|ml)?/g
  let match
  while ((match = re.exec(line))) {
    if (match[1] === '') continue
    let value = parseFloat(match[1])
    let unit = match[2] || null
    // The classic OCR artifact: "9.6g" read as "9.69". Labels print one
    // decimal place, so a unitless two-decimal number ending in 9 is almost
    // certainly a gram figure with its unit eaten.
    if (!unit && /^\d+\.\d9$/.test(match[1])) {
      value = parseFloat(match[1].slice(0, -1))
      unit = 'g'
    }
    out.push({ value, unit })
  }
  return out
}

/**
 * The nutrient rows we care about, with the spellings and misspellings OCR
 * tends to produce. Order matters: "of which sugars" must be checked before
 * "carbohydrate" has consumed the line, and saturates must not be read as
 * fat.
 */
const ROWS = [
  { key: 'sugar', re: /of\s*which\s*sugars?|sugars?\b/ },
  { key: 'saturates', re: /of\s*which\s*saturates?|saturated|saturates\b/ },
  { key: 'energy', re: /energy|calories|kcal/ },
  { key: 'fat', re: /\bfat\b|total\s*fat/ },
  { key: 'carbs', re: /carbohydrates?|carbs\b|carbohydrale/ },
  { key: 'fibre', re: /fibre|fiber|dietary\s*fib/ },
  { key: 'protein', re: /protein|prolein|proteln/ },
  { key: 'salt', re: /\bsalt\b|sodium/ },
]

/** Serving size: "per 30g serving", "serving size: 45 g", "(30g)". */
function findServing(text) {
  const patterns = [
    /serving\s*size[:\s]*(\d+(?:\.\d+)?)\s*g/,
    /per\s*(\d+(?:\.\d+)?)\s*g\s*serving/,
    /(\d+(?:\.\d+)?)\s*g\s*serving/,
    /per\s*portion[^0-9]*(\d+(?:\.\d+)?)\s*g/,
  ]
  for (const re of patterns) {
    const match = text.match(re)
    if (match) {
      const grams = parseFloat(match[1])
      if (grams >= 5 && grams <= 500) return grams
    }
  }
  return null
}

/**
 * @param {string} rawText OCR output (or pasted label text)
 * @returns {{
 *   per100: {kcal:number|null, protein:number|null, carbs:number|null,
 *            fat:number|null, fibre:number|null, sugar:number|null},
 *   servingG: number|null,
 *   fields: number,        // how many of the six values were found
 *   notes: string[],       // honest remarks about what was guessed
 * }}
 */
export function parseNutritionLabel(rawText) {
  const text = cleanText(rawText)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const notes = []
  const found = {}

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const { key, re } of ROWS) {
      if (found[key] !== undefined || !re.test(line)) continue

      let numbers = numbersOn(line)
      // Some OCR layouts put the nutrient name and its figures on separate
      // lines ("Fat" / "9.6g"). Look one line ahead, but never steal a line
      // that names a different nutrient.
      if (!numbers.length && lines[i + 1] && !ROWS.some((row) => row.re.test(lines[i + 1]))) {
        numbers = numbersOn(lines[i + 1])
      }
      if (!numbers.length) continue

      if (key === 'energy') {
        // Prefer an explicit kcal figure; fall back to converting kJ.
        const kcal = numbers.find((n) => n.unit === 'kcal' || n.unit === 'cal')
        const kj = numbers.find((n) => n.unit === 'kj')
        if (kcal) {
          found.energy = kcal.value
        } else if (kj) {
          found.energy = Math.round(kj.value / 4.184)
          notes.push('Energy was printed in kJ only - converted to kcal.')
        } else {
          // Unlabelled numbers: UK labels print "1046kJ / 250kcal", so with
          // two numbers the smaller is the kcal figure.
          const values = numbers.map((n) => n.value)
          found.energy = values.length >= 2 ? Math.min(...values) : values[0]
          if (values.length >= 2) notes.push('Energy units were unreadable - took the smaller figure as kcal.')
        }
      } else {
        // Labels print the per-100g column first; take the first plausible
        // gram figure on the row.
        const gram = numbers.find((n) => n.unit !== 'kj' && n.unit !== 'kcal' && n.value <= 100)
        if (gram) found[key] = gram.value
      }
      break // one nutrient per line
    }
  }

  const per100 = {
    kcal: found.energy ?? null,
    protein: found.protein ?? null,
    carbs: found.carbs ?? null,
    fat: found.fat ?? null,
    fibre: found.fibre ?? null,
    sugar: found.sugar ?? null,
  }

  // Sanity: sugars cannot exceed carbs; a misread column often does this.
  if (per100.sugar !== null && per100.carbs !== null && per100.sugar > per100.carbs) {
    notes.push('Sugars read higher than carbohydrate - check both.')
  }
  // Macros should roughly explain the calories. Flag rather than fix.
  if (per100.kcal !== null && per100.protein !== null && per100.carbs !== null && per100.fat !== null) {
    const derived = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9
    if (Math.abs(derived - per100.kcal) > Math.max(40, per100.kcal * 0.3)) {
      notes.push(`Macros add up to ~${Math.round(derived)} kcal but the label says ${per100.kcal} - one of these was misread.`)
    }
  }

  const fields = Object.values(per100).filter((v) => v !== null).length
  return { per100, servingG: findServing(text), fields, notes }
}
