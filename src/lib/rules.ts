// Styling rules that colour theory alone can't express: what a fabric is for,
// how many busy surfaces an outfit can carry, whether the colours are balanced,
// and whether the metals agree.

import type { Item } from './taxonomy'
import { isNeutral } from './harmony'

// ---------------------------------------------------------------- fabric

/**
 * How suited a fabric is to each season. Captured on every garment and, until
 * now, never used — linen in monsoon and wool in a Mumbai summer both scored
 * exactly the same as cotton.
 */
const FABRIC_SEASON: Record<string, Partial<Record<string, number>>> = {
  Linen:     { Summer: 1.1, Monsoon: 0.7, Winter: 0.6 },
  Cotton:    { Summer: 1.05, Monsoon: 0.95, Winter: 0.9 },
  Wool:      { Summer: 0.5, Monsoon: 0.7, Winter: 1.15 },
  Knit:      { Summer: 0.75, Monsoon: 0.85, Winter: 1.1 },
  Leather:   { Summer: 0.7, Monsoon: 0.6, Winter: 1.1 },
  Denim:     { Summer: 0.85, Monsoon: 0.9, Winter: 1.0 },
  Polyester: { Summer: 0.85, Monsoon: 1.05, Winter: 0.95 },
  Blend:     { Summer: 1.0, Monsoon: 1.0, Winter: 1.0 },
  Other:     { Summer: 1.0, Monsoon: 1.0, Winter: 1.0 },
}

export interface FabricVerdict {
  factor: number
  note: string | null
}

/** Judge the fabrics of an outfit against the season we're actually in. */
export function fabricFit(items: Item[], season: string): FabricVerdict {
  if (season === 'All-season' || items.length === 0) return { factor: 1, note: null }

  let total = 0
  let count = 0
  const wrong: string[] = []

  for (const item of items) {
    const table = FABRIC_SEASON[item.fabric]
    const f = table?.[season] ?? 1
    total += f
    count++
    if (f <= 0.7) wrong.push(`${item.fabric.toLowerCase()} ${item.subcategory.toLowerCase()}`)
  }

  const factor = count > 0 ? total / count : 1
  let note: string | null = null
  if (wrong.length === 1) {
    note = `${cap(wrong[0])} is heavy going in ${season.toLowerCase()}.`
  } else if (wrong.length > 1) {
    note = `${cap(wrong.join(' and '))} are both wrong for ${season.toLowerCase()}.`
  } else if (factor >= 1.05) {
    note = `The fabrics suit ${season.toLowerCase()} well.`
  }
  return { factor, note }
}

// ---------------------------------------------------------------- pattern

/**
 * Two patterned pieces fight unless one is very quiet. Colour scoring can't
 * see this at all — a striped navy shirt and a checked navy jacket read as a
 * perfect tonal match right up until you look at them.
 */
export function patternVerdict(items: Item[]): { penalty: number; note: string | null } {
  const busy = items.filter(
    (i) => i.pattern && i.pattern !== 'Plain' && i.pattern !== 'Textured',
  )
  if (busy.length <= 1) return { penalty: 0, note: null }

  const names = busy.map((i) => `${i.pattern.toLowerCase()} ${i.subcategory.toLowerCase()}`)
  if (busy.length === 2) {
    // no articles: some subcategories are plural ("chinos") and "a checked
    // chinos" reads badly
    return {
      penalty: 14,
      note: `${cap(names[0])} with ${names[1]} is a lot of pattern at once — one of them plain would settle it.`,
    }
  }
  return {
    penalty: 26,
    note: `Three patterned pieces together is too busy to read as deliberate.`,
  }
}

// ------------------------------------------------------- colour proportion

/**
 * The 60/30/10 guideline: a dominant colour, a secondary, and a small accent.
 * An outfit split evenly between three strong colours has nothing to anchor it.
 */
export function proportionVerdict(items: Item[]): { penalty: number; note: string | null } {
  const statement = items.filter(
    (i) => i.category !== 'accessory' && !isNeutral(i.colors?.[0]?.name ?? ''),
  )
  if (items.filter((i) => i.category !== 'accessory').length < 3) {
    return { penalty: 0, note: null }
  }

  if (statement.length >= 3) {
    return {
      penalty: 12,
      note: 'Three competing colours with nothing neutral to anchor them — the eye has nowhere to rest.',
    }
  }
  if (statement.length === 1) {
    const hero = statement[0]
    return {
      penalty: 0,
      note: `The ${hero.colors?.[0]?.name.toLowerCase()} ${hero.subcategory.toLowerCase()} is the one thing carrying colour here, which is exactly the right amount.`,
    }
  }
  return { penalty: 0, note: null }
}

// ---------------------------------------------------------------- metals

const SILVER = new Set(['Light grey', 'Grey', 'White', 'Charcoal'])
const GOLD = new Set(['Mustard', 'Camel', 'Tan', 'Yellow', 'Bronze'])

/**
 * Watches, buckles and chains should agree with each other. Mixing metals is a
 * deliberate choice for some people, but by default it reads as an oversight.
 */
export function metalVerdict(items: Item[]): { penalty: number; note: string | null } {
  const metalPieces = items.filter((i) =>
    ['Watch', 'Belt', 'Chain', 'Bracelet'].includes(i.subcategory),
  )
  if (metalPieces.length < 2) return { penalty: 0, note: null }

  const tones = new Set<string>()
  for (const p of metalPieces) {
    const c = p.colors?.[0]?.name ?? ''
    if (SILVER.has(c)) tones.add('silver')
    else if (GOLD.has(c)) tones.add('gold')
  }
  if (tones.size > 1) {
    return {
      penalty: 8,
      note: 'Your metals disagree — silver and gold in the same outfit usually reads as an accident.',
    }
  }
  return { penalty: 0, note: null }
}

// --------------------------------------------------------------- recency

const DAY = 24 * 60 * 60 * 1000

/**
 * How recently these pieces were worn. Not a hard rule — sometimes the right
 * shirt is the one you wore on Tuesday — but worth a nudge toward variety.
 */
export function recencyVerdict(
  items: Item[],
  now = Date.now(),
): { penalty: number; note: string | null } {
  const recent = items.filter((i) => {
    if (!i.last_worn) return false
    return now - new Date(i.last_worn).getTime() < 3 * DAY
  })
  if (recent.length === 0) return { penalty: 0, note: null }

  const names = recent.map((i) => i.name.toLowerCase())
  return {
    penalty: Math.min(10, recent.length * 5),
    note:
      recent.length === 1
        ? `You wore the ${names[0]} in the last few days.`
        : `You wore ${names.join(' and ')} in the last few days.`,
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
