// Colour-theory core: classifies relationships between garment colours and
// explains them in plain English. Pure functions, no I/O — the same rules a
// stylist uses, encoded.

import { hexToRgb, rgbToHsl } from './colors'

export type HarmonyKind =
  | 'monochrome'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'neutral-anchor'
  | 'all-neutral'
  | 'clash'

export interface HarmonyResult {
  kind: HarmonyKind
  score: number // 0..100
  reason: string
}

/** Colours that pair with anything — the backbone of menswear. */
const NEUTRAL_NAMES = new Set([
  'Black', 'Charcoal', 'Grey', 'Light grey', 'White', 'Off-white', 'Cream',
  'Beige', 'Tan', 'Khaki', 'Camel', 'Brown', 'Chocolate', 'Navy', 'Denim blue',
])

export function isNeutral(colorName: string): boolean {
  return NEUTRAL_NAMES.has(colorName)
}

interface Hsl { h: number; s: number; l: number }

function hsl(hex: string): Hsl {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  return { h, s, l }
}

/** Shortest distance between two hues on the 360° wheel. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Judge a pair of colours. `nameA`/`nameB` are the friendly names used in the
 * explanation the user reads.
 */
export function pairHarmony(
  hexA: string, nameA: string,
  hexB: string, nameB: string,
): HarmonyResult {
  const neutralA = isNeutral(nameA)
  const neutralB = isNeutral(nameB)
  const a = hsl(hexA)
  const b = hsl(hexB)

  if (neutralA && neutralB) {
    // two neutrals: reward tonal contrast, punish muddy near-misses
    const lGap = Math.abs(a.l - b.l)
    // brown-family + black is the classic menswear misstep
    const brownish = (n: string) => n === 'Brown' || n === 'Chocolate' || n === 'Camel' || n === 'Tan'
    if ((brownish(nameA) && nameB === 'Black') || (brownish(nameB) && nameA === 'Black')) {
      return {
        kind: 'all-neutral',
        score: 58,
        reason: `${nameA} with ${nameB} is a tricky pairing — brown and black fight each other. Navy or charcoal would sit better.`,
      }
    }
    if (lGap < 0.1) {
      return {
        kind: 'all-neutral',
        score: 66,
        reason: `${nameA} and ${nameB} sit at almost the same depth, so the outfit reads a little flat. A lighter or darker piece would add definition.`,
      }
    }
    return {
      kind: 'all-neutral',
      score: 88,
      reason: `${nameA} and ${nameB} are both neutrals with clear tonal contrast — quietly sharp, and impossible to get wrong.`,
    }
  }

  if (neutralA || neutralB) {
    const neutral = neutralA ? nameA : nameB
    const accent = neutralA ? nameB : nameA
    return {
      kind: 'neutral-anchor',
      score: 90,
      reason: `${neutral} anchors the look and lets the ${accent.toLowerCase()} do the talking. This is the safest way to wear a colour.`,
    }
  }

  // both are true colours — use the wheel
  const gap = hueGap(a.h, b.h)
  const lGap = Math.abs(a.l - b.l)

  if (gap <= 18) {
    if (lGap > 0.18) {
      return {
        kind: 'monochrome',
        score: 86,
        reason: `${nameA} and ${nameB} are the same colour family at different depths — a tonal look that always reads considered.`,
      }
    }
    return {
      kind: 'monochrome',
      score: 62,
      reason: `${nameA} and ${nameB} are nearly the same shade. Close but not matching tends to look like a mistake rather than a choice.`,
    }
  }

  if (gap <= 45) {
    return {
      kind: 'analogous',
      score: 82,
      reason: `${nameA} and ${nameB} are neighbours on the colour wheel, so they blend naturally without competing.`,
    }
  }

  if (gap >= 150) {
    // opposites: great when one is muted, loud when both are saturated
    const bothLoud = a.s > 0.55 && b.s > 0.55
    if (bothLoud) {
      return {
        kind: 'complementary',
        score: 64,
        reason: `${nameA} and ${nameB} are opposites, which gives real impact — but at full saturation they shout. Best if one piece is muted.`,
      }
    }
    return {
      kind: 'complementary',
      score: 84,
      reason: `${nameA} and ${nameB} sit opposite each other, so each makes the other look richer. Deliberate contrast.`,
    }
  }

  if (gap >= 100 && gap <= 140) {
    return {
      kind: 'triadic',
      score: 74,
      reason: `${nameA} and ${nameB} form a triadic-style contrast — bold, and it works as long as the rest stays neutral.`,
    }
  }

  return {
    kind: 'clash',
    score: 45,
    reason: `${nameA} and ${nameB} fall in an awkward middle distance — too far apart to blend, too close to read as intentional contrast.`,
  }
}

/**
 * Judge a full set of garment colours. Returns an overall score and the single
 * most useful sentence explaining it.
 */
export function outfitHarmony(
  pieces: { hex: string; name: string }[],
): { score: number; reason: string; worst: HarmonyResult | null } {
  if (pieces.length < 2) {
    return { score: 70, reason: 'Add another piece to judge the combination.', worst: null }
  }

  const results: HarmonyResult[] = []
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      results.push(pairHarmony(pieces[i].hex, pieces[i].name, pieces[j].hex, pieces[j].name))
    }
  }

  const avg = results.reduce((s, r) => s + r.score, 0) / results.length
  const worst = results.reduce((w, r) => (r.score < w.score ? r : w), results[0])
  const best = results.reduce((b, r) => (r.score > b.score ? r : b), results[0])

  // too many competing colours reads busy
  const colourCount = pieces.filter((p) => !isNeutral(p.name)).length
  let score = avg
  let reason = best.reason
  if (colourCount >= 3) {
    score -= 12
    reason = `Three or more statement colours at once gets busy. Swapping one for a neutral would sharpen this instantly.`
  } else if (worst.score < 62) {
    reason = worst.reason
  }

  return { score: Math.round(Math.max(0, Math.min(100, score))), reason, worst }
}
