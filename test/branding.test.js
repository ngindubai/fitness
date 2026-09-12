import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * The brand is enforced here because nothing else can enforce it.
 *
 * Everything else in this app is JavaScript with unit tests around it. The
 * visual identity lives in CSS, HTML attributes, a manifest and an SVG — four
 * files no test imported until this one. A rebrand that misses one of them
 * does not fail the build, it just quietly ships the old identity to whoever
 * happens to be on a light-mode phone.
 */

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
const icon = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))

const BRAND = {
  rust: '#c75030',
  charcoal: '#14181b',
  olive: '#3e4a36',
  cream: '#e9e7db',
}

/** Pull `--token: value;` pairs out of one CSS rule body. */
function tokensIn(body) {
  const out = {}
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.replace(/\s+/g, ' ').trim()
  }
  return out
}

function ruleBody(source, startPattern) {
  const start = source.indexOf(startPattern)
  assert.ok(start >= 0, `could not find ${startPattern}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`unbalanced braces after ${startPattern}`)
}

test('the light palette is identical whether chosen or inherited from the OS', () => {
  const chosen = tokensIn(ruleBody(css, "[data-theme='light'] {"))
  const fromOs = tokensIn(ruleBody(css, ":root:not([data-theme='dark']) {"))
  assert.ok(Object.keys(chosen).length > 15, 'the light palette should be a full token set')
  assert.deepEqual(fromOs, chosen,
    'the OS-preference light palette has drifted from the explicit one — a light-mode phone would run a different brand')
})

test('the brand colours are actually in the stylesheet', () => {
  const dark = tokensIn(ruleBody(css, ':root {'))
  assert.equal(dark['--bg'], BRAND.charcoal)
  assert.equal(dark['--accent'], BRAND.rust)
  assert.equal(dark['--olive'], BRAND.olive)
  assert.equal(dark['--cream'], BRAND.cream)

  const light = tokensIn(ruleBody(css, "[data-theme='light'] {"))
  assert.equal(light['--bg'], BRAND.cream)
  assert.equal(light['--text'], BRAND.charcoal)
})

test('no colour from the previous identity survives anywhere', () => {
  const retired = ['#c6a15b', '#0b0d10', '#14171d', '#f6f4ef', '#a07e3c', '#57b888', '#14120c']
  for (const dead of retired) {
    assert.ok(!css.toLowerCase().includes(dead), `styles.css still carries the old ${dead}`)
    assert.ok(!icon.toLowerCase().includes(dead), `icon.svg still carries the old ${dead}`)
  }
  assert.ok(!/Didot|Bodoni/i.test(css), 'the old serif display face is still referenced')
})

test('the browser chrome and installed icon carry the brand too', () => {
  // These are set outside CSS, so a token-only rebrand leaves them behind.
  assert.ok(html.includes(`content="${BRAND.charcoal}" media="(prefers-color-scheme: dark)"`),
    'dark theme-color meta is not the brand charcoal')
  assert.ok(html.includes(`content="${BRAND.cream}" media="(prefers-color-scheme: light)"`),
    'light theme-color meta is not the brand cream')
  assert.equal(manifest.background_color, BRAND.charcoal)
  assert.equal(manifest.theme_color, BRAND.charcoal)
  assert.ok(icon.includes(BRAND.charcoal), 'icon.svg background is not the brand charcoal')
  assert.ok(icon.includes(BRAND.rust), 'icon.svg mark is not the brand rust')
})

/** WCAG relative luminance, then the standard contrast ratio. */
function contrast(hexA, hexB) {
  const channel = (hex, i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const lum = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
  const [a, b] = [lum(hexA), lum(hexB)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

test('text on the accent clears AA in both themes', () => {
  // The rebrand took this from 7.7:1 to 3.7:1 before it was caught: rust is a
  // much lighter background than the gold it replaced, so the old dark button
  // text stopped working. Button text is normal-sized, so AA means 4.5:1.
  const dark = tokensIn(ruleBody(css, ':root {'))
  const light = tokensIn(ruleBody(css, "[data-theme='light'] {"))
  for (const [name, palette] of [['dark', dark], ['light', light]]) {
    const onAccent = palette['--on-accent']
    assert.ok(onAccent, `${name} palette has no --on-accent`)
    const measured = contrast(onAccent, palette['--accent'])
    assert.ok(measured >= 4.5,
      `${name}: ${onAccent} on ${palette['--accent']} is ${measured.toFixed(2)}:1, under the 4.5:1 floor`)
  }
})

test('the selected tab differs in brightness, not just hue', () => {
  // Rust and --faint measured within 1% of each other in the dark palette, so
  // colour alone told a colour-blind reader nothing about which tab was open.
  const rule = ruleBody(css, "nav.tabs button[aria-current='true'] {")
  assert.match(rule, /color:\s*var\(--text\)/,
    'the active tab should brighten rather than only changing hue')
  assert.match(rule, /var\(--accent\)/, 'and should still carry a brand cue')
})

test('display type is the condensed stack, and only headlines shout', () => {
  const dark = tokensIn(ruleBody(css, ':root {'))
  assert.match(dark['--display'], /Roboto Condensed/,
    'the display face should lead with a condensed family')
  // .serif is the headline class and may be upper-cased; the raw var must not
  // be, or body copy set in var(--serif) would shout too.
  const serifRule = ruleBody(css, '.serif {')
  assert.match(serifRule, /text-transform:\s*uppercase/)
  assert.match(serifRule, /font-weight:\s*[78]00/)
})
