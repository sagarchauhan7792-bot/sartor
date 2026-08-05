// Personal colour analysis: works out which colours flatter the wearer.
// Combines skin-tone sampling from a daylight selfie with a short quiz,
// then scores every garment colour against the resulting seasonal palette.

import { hexToRgb, rgbToHsl, NAMED_COLORS } from './colors'

export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter'
export type Undertone = 'warm' | 'cool' | 'neutral'

export interface ColorProfile {
  season: ColorSeason
  undertone: Undertone
  depth: 'light' | 'medium' | 'deep'
  contrast: 'low' | 'medium' | 'high'
}

export const SEASON_INFO: Record<ColorSeason, { title: string; blurb: string; avoid: string }> = {
  spring: {
    title: 'Warm & Bright',
    blurb: 'Clear, warm colours light you up — camel, coral, warm greens, ivory, golden browns.',
    avoid: 'Heavy black and icy greys tend to drain you.',
  },
  summer: {
    title: 'Cool & Soft',
    blurb: 'Muted, cool colours suit you — soft navy, sage, dusty blue, grey, off-white.',
    avoid: 'Orange and hot, saturated colours overpower your colouring.',
  },
  autumn: {
    title: 'Warm & Deep',
    blurb: 'Rich, earthy colours are your strength — olive, rust, mustard, chocolate, forest.',
    avoid: 'Pure white and icy pastels can look harsh against you.',
  },
  winter: {
    title: 'Cool & Deep',
    blurb: 'High-contrast, cool colours work best — true black, crisp white, navy, burgundy, emerald.',
    avoid: 'Muted earth tones like beige and olive can wash you out.',
  },
}

/** Colours that flatter each season, by the names used in the colour vocabulary. */
const SEASON_PALETTES: Record<ColorSeason, string[]> = {
  spring: ['Camel', 'Tan', 'Cream', 'Off-white', 'Beige', 'Rust', 'Orange', 'Mustard', 'Yellow', 'Mint', 'Sage', 'Green', 'Sky blue', 'Teal', 'Blush', 'Brown'],
  summer: ['Navy', 'Denim blue', 'Sky blue', 'Grey', 'Light grey', 'Off-white', 'Sage', 'Mint', 'Lavender', 'Blush', 'Teal', 'Purple', 'Burgundy'],
  autumn: ['Olive', 'Forest', 'Rust', 'Mustard', 'Camel', 'Chocolate', 'Brown', 'Khaki', 'Beige', 'Cream', 'Maroon', 'Orange', 'Teal', 'Green'],
  winter: ['Black', 'Charcoal', 'White', 'Navy', 'Burgundy', 'Maroon', 'Forest', 'Red', 'Blue', 'Purple', 'Grey', 'Teal'],
}

/** Colours that actively work against each season. */
const SEASON_AVOID: Record<ColorSeason, string[]> = {
  spring: ['Black', 'Charcoal', 'Burgundy'],
  summer: ['Orange', 'Rust', 'Mustard', 'Camel'],
  autumn: ['White', 'Lavender', 'Blush', 'Light grey'],
  winter: ['Beige', 'Khaki', 'Olive', 'Camel', 'Tan'],
}

/**
 * How well a colour suits this person: 1.0 = flattering, 0.75 = neutral,
 * 0.55 = works against them. Used as a multiplier in outfit scoring.
 */
export function flatterFactor(colorName: string, profile: ColorProfile | null): number {
  if (!profile) return 0.85
  if (SEASON_PALETTES[profile.season].includes(colorName)) return 1
  if (SEASON_AVOID[profile.season].includes(colorName)) return 0.55
  return 0.78
}

/** The colours from the app's vocabulary that suit this profile, best first. */
export function bestColorsFor(profile: ColorProfile): { name: string; hex: string }[] {
  const wanted = SEASON_PALETTES[profile.season]
  return NAMED_COLORS.filter((c) => wanted.includes(c.name))
}

export interface QuizAnswers {
  metal: 'gold' | 'silver' | 'both'
  sunReaction: 'tan' | 'burn' | 'both'
  veins: 'green' | 'blue' | 'unsure'
  bestNeutral: 'cream' | 'white' | 'unsure'
}

/**
 * Derive the profile from quiz answers plus optional measured skin tone.
 * The quiz decides undertone; the selfie refines depth and contrast.
 */
export function deriveProfile(
  quiz: QuizAnswers,
  skin?: { hex: string; hairHex?: string },
): ColorProfile {
  // --- undertone: quiz votes ---
  let warmVotes = 0
  let coolVotes = 0
  if (quiz.metal === 'gold') warmVotes += 2
  if (quiz.metal === 'silver') coolVotes += 2
  if (quiz.sunReaction === 'tan') warmVotes += 1
  if (quiz.sunReaction === 'burn') coolVotes += 1
  if (quiz.veins === 'green') warmVotes += 2
  if (quiz.veins === 'blue') coolVotes += 2
  if (quiz.bestNeutral === 'cream') warmVotes += 1
  if (quiz.bestNeutral === 'white') coolVotes += 1

  // --- undertone: measured skin hue nudges the vote ---
  let depth: ColorProfile['depth'] = 'medium'
  let contrast: ColorProfile['contrast'] = 'medium'
  if (skin?.hex) {
    const [h, , l] = rgbToHsl(...hexToRgb(skin.hex))
    // yellow-golden hues (20–50°) read warm; pinker hues (<15° or >330°) read cool
    if (h >= 20 && h <= 50) warmVotes += 1.5
    else if (h < 15 || h > 330) coolVotes += 1.5

    depth = l > 0.65 ? 'light' : l < 0.42 ? 'deep' : 'medium'

    if (skin.hairHex) {
      const [, , hairL] = rgbToHsl(...hexToRgb(skin.hairHex))
      const gap = Math.abs(l - hairL)
      contrast = gap > 0.38 ? 'high' : gap < 0.18 ? 'low' : 'medium'
    }
  }

  const undertone: Undertone =
    Math.abs(warmVotes - coolVotes) < 1.5 ? 'neutral' : warmVotes > coolVotes ? 'warm' : 'cool'

  // --- season: undertone × depth/contrast ---
  let season: ColorSeason
  if (undertone === 'warm') {
    season = depth === 'light' ? 'spring' : 'autumn'
  } else if (undertone === 'cool') {
    season = depth === 'deep' || contrast === 'high' ? 'winter' : 'summer'
  } else {
    // neutral undertone leans on depth and contrast
    season = depth === 'deep' ? 'winter' : depth === 'light' ? 'summer' : 'autumn'
  }

  return { season, undertone, depth, contrast }
}

/**
 * Sample skin and hair tone from a selfie. Reads the central face region for
 * skin and the top band for hair — crude but reliable enough on a plain
 * daylight selfie, and it never leaves the device.
 */
export async function sampleSelfie(
  file: Blob,
): Promise<{ hex: string; hairHex: string } | null> {
  const img = await loadImage(file)
  const size = 200
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)

  const skin: number[][] = []
  const hair: number[][] = []
  const { data } = ctx.getImageData(0, 0, size, size)

  const at = (x: number, y: number) => {
    const i = (y * size + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }

  // cheeks/centre band of the frame — where a face sits in a normal selfie
  for (let y = Math.floor(size * 0.42); y < size * 0.68; y++) {
    for (let x = Math.floor(size * 0.32); x < size * 0.68; x++) {
      const [r, g, b] = at(x, y)
      if (isSkinLike(r, g, b)) skin.push([r, g, b])
    }
  }
  // top band — hair
  for (let y = Math.floor(size * 0.05); y < size * 0.22; y++) {
    for (let x = Math.floor(size * 0.35); x < size * 0.65; x++) {
      hair.push(at(x, y))
    }
  }

  if (skin.length < 200) return null // probably not a usable selfie

  return { hex: medianHex(skin), hairHex: medianHex(hair) }
}

function isSkinLike(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return (
    r > 60 && g > 30 && b > 15 &&
    r > b && r >= g &&
    max - min > 10 &&
    Math.abs(r - g) > 8
  )
}

function medianHex(pixels: number[][]): string {
  const channel = (i: number) => {
    const vals = pixels.map((p) => p[i]).sort((a, b) => a - b)
    return vals[Math.floor(vals.length / 2)]
  }
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${c(channel(0))}${c(channel(1))}${c(channel(2))}`
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bad image')) }
    img.src = url
  })
}
