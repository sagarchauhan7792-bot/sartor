// Should you buy this?
//
// Answers the question before the money is spent, using the wardrobe that
// already exists: how many new outfits it would create, whether the colour
// suits you, and whether you own something near enough already.

import type { Category, Item, ItemColor } from './taxonomy'
import { generateOutfits, type Outfit } from './outfit'
import { flatterFactor, type ColorProfile } from './season'
import { pairHarmony } from './harmony'
import type { PrefWeights } from './outfit'

export interface Candidate {
  name: string
  category: Category
  subcategory: string
  colors: ItemColor[]
  fabric: string
}

export interface Verdict {
  /** best outfits this piece would take part in */
  unlocked: Outfit[]
  unlockedCount: number
  /** pieces you own that are close enough to question the purchase */
  duplicates: { item: Item; reason: string }[]
  /** how well the colour suits the wearer, 0..1 */
  flatter: number
  /** what it would go with, most harmonious first */
  pairsWith: { item: Item; reason: string; score: number }[]
  headline: string
  verdict: 'buy' | 'maybe' | 'skip'
}

const GOOD = 72

/**
 * Judge a prospective purchase against the closet.
 * `occasion` scopes the outfit maths — a blazer earns its place at the office,
 * not necessarily on a Sunday.
 */
export function assessPurchase(
  candidate: Candidate,
  closet: Item[],
  occasion: string,
  profile: ColorProfile | null,
  weights?: PrefWeights,
): Verdict {
  const phantom: Item = {
    id: '__candidate__',
    user_id: '',
    name: candidate.name,
    category: candidate.category,
    subcategory: candidate.subcategory,
    colors: candidate.colors,
    primary_color: candidate.colors[0]?.name ?? '',
    seasons: ['All-season'],
    occasions: [occasion],
    fabric: candidate.fabric,
    pattern: 'Plain',
    laundry_status: 'clean',
    photo_path: '',
    cutout_path: null,
    notes: '',
    times_worn: 0,
    last_worn: null,
    created_at: '',
    archived: false,
    needs_repair: false,
    repair_note: '',
    brand: '',
    price: null,
    purchased_on: null,
    purchased_from: '',
  }

  const withIt = generateOutfits([...closet, phantom], {
    occasion,
    profile,
    weights,
    cleanOnly: false,
    count: 40,
  })
  const unlocked = withIt.filter(
    (o) => o.score >= GOOD && o.items.some((i) => i.id === '__candidate__'),
  )

  // --- do you already own this? ---
  const own = candidate.colors[0]
  const duplicates: Verdict['duplicates'] = []
  for (const item of closet) {
    if (item.category !== candidate.category) continue
    const c = item.colors?.[0]
    if (!c || !own) continue
    const sameType = item.subcategory === candidate.subcategory
    const sameColor = c.name === own.name
    if (sameType && sameColor) {
      duplicates.push({ item, reason: `Same thing, same colour.` })
    } else if (sameType) {
      duplicates.push({ item, reason: `Also a ${item.subcategory.toLowerCase()}, in ${c.name.toLowerCase()}.` })
    } else if (sameColor) {
      duplicates.push({ item, reason: `Another ${c.name.toLowerCase()} ${item.category}.` })
    }
  }
  // an exact match is the one worth seeing first
  duplicates.sort(
    (a, b) =>
      Number(b.reason.startsWith('Same thing')) - Number(a.reason.startsWith('Same thing')),
  )

  // --- what would it go with? ---
  const pairsWith: Verdict['pairsWith'] = []
  if (own) {
    for (const item of closet) {
      if (item.category === candidate.category) continue
      const c = item.colors?.[0]
      if (!c) continue
      const h = pairHarmony(own.hex, own.name, c.hex, c.name)
      pairsWith.push({ item, reason: h.reason, score: h.score })
    }
    pairsWith.sort((a, b) => b.score - a.score)
  }

  const flatter = own ? flatterFactor(own.name, profile) : 0.85
  const exactDupe = duplicates.some((d) => d.reason.startsWith('Same thing'))

  // --- the call ---
  let verdict: Verdict['verdict']
  let headline: string

  if (exactDupe) {
    verdict = 'skip'
    headline = `You already own this in ${own?.name.toLowerCase()}. Buying it again adds nothing to what you can wear.`
  } else if (closet.length < 4) {
    verdict = 'maybe'
    headline = `Your closet is too small to judge this properly yet — add more of what you own first.`
  } else if (unlocked.length === 0) {
    verdict = 'skip'
    headline = `It wouldn't create a single outfit that works with what you own for ${occasion.toLowerCase()}.`
  } else if (flatter <= 0.6) {
    verdict = 'maybe'
    headline = `It would unlock ${unlocked.length} ${plural(unlocked.length)}, but ${own?.name.toLowerCase()} works against your colouring.`
  } else if (unlocked.length >= 5) {
    verdict = 'buy'
    headline = `Strong buy — it would unlock ${unlocked.length} new outfits from clothes you already own.`
  } else {
    verdict = 'maybe'
    headline = `It would unlock ${unlocked.length} new ${plural(unlocked.length)}. Worth it if you like it enough.`
  }

  return {
    unlocked: unlocked.slice(0, 4),
    unlockedCount: unlocked.length,
    duplicates: duplicates.slice(0, 3),
    flatter,
    pairsWith: pairsWith.slice(0, 4),
    headline,
    verdict,
  }
}

function plural(n: number): string {
  return n === 1 ? 'outfit' : 'outfits'
}
