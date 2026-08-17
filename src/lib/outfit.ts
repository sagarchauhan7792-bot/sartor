// The outfit engine: picks and scores complete looks from the closet.
// Combines colour harmony, menswear formality rules, occasion fit, season,
// the wearer's personal palette, and preferences learned from ratings.

import type { Category, Item } from './taxonomy'
import { outfitHarmony, isNeutral } from './harmony'
import { flatterFactor, type ColorProfile } from './season'
import {
  fabricFit, patternVerdict, proportionVerdict, metalVerdict, recencyVerdict,
} from './rules'

export interface Outfit {
  items: Item[]
  score: number
  colorReason: string
  styleNotes: string[]
  occasion: string
}

export interface PrefWeights {
  /** colour name → learned bias, roughly -1..+1 */
  colors: Record<string, number>
  /** subcategory → learned bias */
  types: Record<string, number>
  /** harmony kind → learned bias */
  harmonies: Record<string, number>
}

export const EMPTY_WEIGHTS: PrefWeights = { colors: {}, types: {}, harmonies: {} }

/**
 * Formality on a 1–5 scale (1 = gym, 5 = black tie). Every garment type gets a
 * rating; an outfit whose pieces disagree looks wrong even when the colours work.
 */
const FORMALITY: Record<string, number> = {
  // tops
  'T-shirt': 2, Polo: 3, 'Casual shirt': 3, 'Formal shirt': 4.5, Henley: 2.5,
  Sweatshirt: 1.5, Sweater: 3, Tank: 1,
  // bottoms
  Jeans: 2.5, Chinos: 3.5, 'Formal trousers': 4.5, Joggers: 1.5, Shorts: 1.5, 'Cargo pants': 2,
  // shoes
  Sneakers: 2.5, Loafers: 4, 'Formal shoes': 5, Boots: 3.5, Sandals: 1, 'Running shoes': 1.5,
  // layers
  'Denim jacket': 2.5, Bomber: 3, Blazer: 4.5, Hoodie: 1.5, Overshirt: 3,
  Coat: 4, 'Leather jacket': 3, Cardigan: 3.5,
  // accessories
  Watch: 3, Belt: 3, Sunglasses: 3, Cap: 2, Beanie: 2, Bracelet: 2.5, Chain: 2.5, Bag: 3,
}

function formality(item: Item): number {
  return FORMALITY[item.subcategory] ?? 3
}

/** Target formality band per occasion. */
const OCCASION_TARGET: Record<string, { target: number; tolerance: number }> = {
  Casual: { target: 2.5, tolerance: 1.2 },
  Office: { target: 4, tolerance: 0.9 },
  Date: { target: 3.4, tolerance: 1 },
  Party: { target: 3.2, tolerance: 1.2 },
  Gym: { target: 1.4, tolerance: 0.8 },
  'Wedding/Event': { target: 4.6, tolerance: 0.8 },
}

/** Combinations that read as mistakes regardless of colour. */
const HARD_CLASHES: { test: (items: Item[]) => boolean; note: string; occasion?: string }[] = [
  {
    test: (i) => has(i, 'Formal shoes') && (has(i, 'Shorts') || has(i, 'Joggers')),
    note: 'Formal shoes with shorts or joggers never lands — swap to sneakers.',
  },
  {
    test: (i) => has(i, 'Blazer') && (has(i, 'Joggers') || has(i, 'Shorts')),
    note: 'A blazer over joggers or shorts fights itself. Chinos would fix it.',
  },
  {
    test: (i) => has(i, 'Formal shirt') && has(i, 'Running shoes'),
    note: 'Running shoes undercut a formal shirt. Loafers or clean sneakers instead.',
  },
  {
    test: (i) => has(i, 'Hoodie') && has(i, 'Formal trousers'),
    note: 'A hoodie with formal trousers reads mismatched rather than relaxed.',
  },
  // Gym is a hard filter, not a style preference — street clothes don't belong.
  {
    occasion: 'Gym',
    test: (i) => i.some((x) => ['Jeans', 'Chinos', 'Formal trousers', 'Cargo pants'].includes(x.subcategory)),
    note: 'Denim and chinos have no place in a gym kit — joggers or shorts.',
  },
  {
    occasion: 'Gym',
    test: (i) => i.some((x) => ['Loafers', 'Formal shoes', 'Boots', 'Sandals'].includes(x.subcategory)),
    note: 'Train in running shoes or trainers, not these.',
  },
  {
    occasion: 'Gym',
    test: (i) => i.some((x) => ['Formal shirt', 'Casual shirt', 'Polo', 'Sweater'].includes(x.subcategory)),
    note: 'A collared shirt at the gym — a tee or tank is what you want.',
  },
  {
    occasion: 'Wedding/Event',
    test: (i) => i.some((x) => ['Sneakers', 'Running shoes', 'Sandals'].includes(x.subcategory)),
    note: 'Sneakers undercut event dressing — loafers or formal shoes carry it.',
  },
]

function activeClashes(items: Item[], occasion: string) {
  return HARD_CLASHES.filter((c) => (!c.occasion || c.occasion === occasion) && c.test(items))
}

function has(items: Item[], subcategory: string): boolean {
  return items.some((i) => i.subcategory === subcategory)
}

/**
 * Current season by month, on the Indian calendar the taxonomy is built around.
 * October is a genuine shoulder month, so nothing is penalised then.
 */
export function currentSeason(d = new Date()): string {
  const m = d.getMonth() + 1
  if (m >= 3 && m <= 6) return 'Summer'
  if (m >= 7 && m <= 9) return 'Monsoon'
  if (m === 10) return 'All-season'
  return 'Winter'
}

/**
 * How appropriate an item is right now: 1 = in season or year-round,
 * 0.45 = actively out of season (a wool coat in June).
 */
function seasonFactor(item: Item, season: string): number {
  const tags = item.seasons ?? []
  if (season === 'All-season') return 1
  if (tags.length === 0) return 1
  if (tags.includes('All-season') || tags.includes(season)) return 1
  return 0.45
}

/** Style observations that make a good outfit feel intentional. */
function styleNotes(items: Item[], occasion: string): string[] {
  const notes: string[] = []

  for (const clash of activeClashes(items, occasion)) notes.push(clash.note)

  const spread = formalitySpread(items)
  if (spread > 2) {
    notes.push('The pieces sit at quite different levels of dressiness — pick one register and stay in it.')
  }

  // shoe/belt leather coordination — a detail that reads as put-together
  const belt = items.find((i) => i.subcategory === 'Belt')
  const shoes = items.find((i) => i.category === 'shoes')
  if (belt && shoes) {
    const b = belt.colors?.[0]?.name
    const s = shoes.colors?.[0]?.name
    if (b && s && b !== s && isLeatherish(b) && isLeatherish(s)) {
      notes.push(`Your ${b.toLowerCase()} belt and ${s.toLowerCase()} shoes don't match — matching leathers is the classic move.`)
    }
  }

  if (has(items, 'Blazer') && occasion === 'Office') {
    notes.push('The blazer does the heavy lifting here — keep everything under it simple.')
  }

  // Only worth saying when there's genuinely nothing to look at — an outfit
  // that already has an accessory doesn't need this advice.
  const neutrals = items.filter((i) => isNeutral(i.colors?.[0]?.name ?? '')).length
  const hasAccessory = items.some((i) => i.category === 'accessory')
  if (neutrals === items.length && items.length >= 3 && !hasAccessory && notes.length === 0) {
    notes.push('Entirely neutral, which is safe and sharp. A watch would give the eye somewhere to land.')
  }

  return notes
}

function isLeatherish(name: string): boolean {
  return ['Black', 'Brown', 'Chocolate', 'Tan', 'Camel'].includes(name)
}

function formalitySpread(items: Item[]): number {
  const core = items.filter((i) => i.category !== 'accessory').map(formality)
  if (core.length < 2) return 0
  return Math.max(...core) - Math.min(...core)
}

/** Score one candidate outfit. */
export interface ScoreOptions {
  season?: string
  /** nudge away from pieces worn in the last few days */
  avoidRecent?: boolean
  /** shift the target dressiness up or down, roughly -1..+1 */
  formalityShift?: number
}

export function scoreOutfit(
  items: Item[],
  occasion: string,
  profile: ColorProfile | null,
  weights: PrefWeights = EMPTY_WEIGHTS,
  opts: ScoreOptions = {},
): Outfit {
  const season = opts.season ?? currentSeason()
  const pieces = items
    .map((i) => i.colors?.[0])
    .filter(Boolean)
    .map((c) => ({ hex: c!.hex, name: c!.name }))

  const harmony = outfitHarmony(pieces)

  // --- occasion fit (0..100) ---
  // How close the outfit's dressiness sits to what the occasion calls for,
  // plus credit for pieces the user tagged for it.
  let occasionFit = 70
  const target = OCCASION_TARGET[occasion]
  if (target) {
    const core = items.filter((i) => i.category !== 'accessory')
    const avgFormality = core.reduce((s, i) => s + formality(i), 0) / Math.max(1, core.length)
    // the dial lets you ask for the same occasion dressed up or down
    const wanted = target.target + (opts.formalityShift ?? 0)
    const miss = Math.max(0, Math.abs(avgFormality - wanted) - target.tolerance)
    occasionFit = 100 - miss * 42
  }
  const tagged = items.filter((i) => i.occasions?.includes(occasion)).length
  occasionFit = occasionFit * 0.85 + (tagged / Math.max(1, items.length)) * 100 * 0.15

  // --- style integrity (0..100) ---
  // Whether the pieces belong in the same outfit at all.
  let integrity = 100
  integrity -= Math.max(0, formalitySpread(items) - 1.2) * 24
  integrity -= activeClashes(items, occasion).length * 45

  // A complete look (top + bottom + shoes) reads more resolved than a partial one.
  const hasCore =
    items.some((i) => i.category === 'top') &&
    items.some((i) => i.category === 'bottom') &&
    items.some((i) => i.category === 'shoes')
  if (!hasCore) integrity -= 10

  const clamp01 = (v: number) => Math.max(0, Math.min(100, v))

  // Weighted blend rather than additive bonuses, so scores spread across the
  // range instead of piling up at the ceiling.
  let score =
    clamp01(harmony.score) * 0.5 +
    clamp01(occasionFit) * 0.32 +
    clamp01(integrity) * 0.18

  // --- personal palette ---
  if (profile) {
    const factors = pieces.map((p) => flatterFactor(p.name, profile))
    const avgFactor = factors.reduce((s, f) => s + f, 0) / Math.max(1, factors.length)
    score *= 0.82 + avgFactor * 0.18
  }

  // --- learned preferences ---
  let bias = 0
  for (const p of pieces) bias += weights.colors[p.name] ?? 0
  for (const i of items) bias += weights.types[i.subcategory] ?? 0
  if (harmony.worst) bias += weights.harmonies[harmony.worst.kind] ?? 0
  score += Math.max(-10, Math.min(10, bias * 5))

  // gently favour pieces that have been neglected
  const avgWorn = items.reduce((s, i) => s + (i.times_worn ?? 0), 0) / Math.max(1, items.length)
  if (avgWorn < 2) score += 2

  // --- season ---
  const seasonFactors = items.map((i) => seasonFactor(i, season))
  const outOfSeason = items.filter((_, n) => seasonFactors[n] < 1)
  const avgSeason = seasonFactors.reduce((s, f) => s + f, 0) / Math.max(1, seasonFactors.length)
  score *= 0.55 + avgSeason * 0.45

  // --- fabric, pattern, proportion, metals, recency ---
  const fabric = fabricFit(items, season)
  score *= 0.85 + Math.min(1.15, fabric.factor) * 0.15

  const pattern = patternVerdict(items)
  const proportion = proportionVerdict(items)
  const metals = metalVerdict(items)
  const recency = opts.avoidRecent ? recencyVerdict(items) : { penalty: 0, note: null }
  score -= pattern.penalty + proportion.penalty + metals.penalty + recency.penalty

  // A definite mistake caps the whole look. Averaging can otherwise hide
  // incoherence — formal shoes and joggers average out to "about right".
  const clashCount = activeClashes(items, occasion).length
  if (clashCount > 0) score = Math.min(score, 58 - (clashCount - 1) * 12)
  if (formalitySpread(items) > 2.4) score = Math.min(score, 62)

  const notes = styleNotes(items, occasion)
  // Problems first, then observations — the useful sentence should be the one
  // you read, not the fourth one down.
  for (const extra of [pattern.note, metals.note, fabric.note, proportion.note, recency.note]) {
    if (extra) notes.push(extra)
  }
  if (outOfSeason.length) {
    const names = outOfSeason.map((i) => i.name.toLowerCase()).join(' and ')
    notes.unshift(
      `You've tagged ${names} for another season — fine if the weather says otherwise.`,
    )
  }

  return {
    items,
    score: Math.round(Math.max(0, Math.min(100, score))),
    colorReason: harmony.reason,
    styleNotes: notes,
    occasion,
  }
}

export interface GenerateOptions {
  occasion: string
  profile: ColorProfile | null
  weights?: PrefWeights
  /** exclude items in the wash */
  cleanOnly?: boolean
  includeLayer?: boolean
  includeAccessory?: boolean
  /** items that must appear (used by the manual builder / "more like this") */
  pinned?: Item[]
  /** how many distinct outfits to return */
  count?: number
  /** defaults to the season we're actually in */
  season?: string
  /** nudge away from pieces worn in the last few days */
  avoidRecent?: boolean
  /** dress the occasion up (+) or down (−) */
  formalityShift?: number
}

/**
 * Build the best outfits available from the closet. Enumerates candidate
 * combinations, scores each, and returns the strongest distinct looks.
 */
export function generateOutfits(all: Item[], opts: GenerateOptions): Outfit[] {
  const {
    occasion, profile, weights = EMPTY_WEIGHTS,
    cleanOnly = true, includeLayer = true, includeAccessory = true,
    pinned = [], count = 12, season = currentSeason(),
    avoidRecent = false, formalityShift = 0,
  } = opts
  const score: ScoreOptions = { season, avoidRecent, formalityShift }

  // Archived pieces are boxed away for the season; a piece awaiting a tailor
  // can't be worn either.
  const usable = all.filter(
    (i) =>
      !i.archived &&
      !i.needs_repair &&
      (cleanOnly ? i.laundry_status === 'clean' : true),
  )
  const pinnedIds = new Set(pinned.map((p) => p.id))

  const pick = (cat: Category) => {
    const p = pinned.find((x) => x.category === cat)
    if (p) return [p]
    return usable.filter((i) => i.category === cat && !pinnedIds.has(i.id))
  }

  const tops = pick('top')
  const bottoms = pick('bottom')
  const shoes = pick('shoes')
  const layers = includeLayer ? pick('layer') : []
  const accessories = includeAccessory ? pick('accessory') : []

  if (tops.length === 0 || bottoms.length === 0) return []

  // Cap the search so a large closet stays instant. Rank by season first —
  // otherwise out-of-season pieces can crowd wearable ones out of the pool —
  // then by occasion tag, then least-worn.
  const rank = (list: Item[], n: number) =>
    [...list]
      .sort((a, b) => {
        const as = seasonFactor(a, season)
        const bs = seasonFactor(b, season)
        if (as !== bs) return bs - as
        const at = a.occasions?.includes(occasion) ? 1 : 0
        const bt = b.occasions?.includes(occasion) ? 1 : 0
        if (at !== bt) return bt - at
        return (a.times_worn ?? 0) - (b.times_worn ?? 0)
      })
      .slice(0, n)

  const T = rank(tops, 12)
  const B = rank(bottoms, 10)
  const S = rank(shoes, 8)
  const L = rank(layers, 6)
  const A = rank(accessories, 6)

  const candidates: Outfit[] = []
  for (const top of T) {
    for (const bottom of B) {
      const shoeOptions = S.length ? S : [null]
      for (const shoe of shoeOptions) {
        // base look, then optionally layered / accessorised
        const base = [top, bottom, ...(shoe ? [shoe] : [])]
        candidates.push(scoreOutfit(base, occasion, profile, weights, score))

        for (const layer of L.slice(0, 3)) {
          candidates.push(scoreOutfit([...base, layer], occasion, profile, weights, score))
        }
        for (const acc of A.slice(0, 2)) {
          candidates.push(scoreOutfit([...base, acc], occasion, profile, weights, score))
          if (L.length) {
            candidates.push(scoreOutfit([...base, L[0], acc], occasion, profile, weights, score))
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  // de-duplicate: don't return five variations of the same top+bottom
  const seen = new Set<string>()
  const results: Outfit[] = []
  for (const c of candidates) {
    const core = c.items
      .filter((i) => i.category === 'top' || i.category === 'bottom')
      .map((i) => i.id)
      .sort()
      .join('|')
    if (seen.has(core)) continue
    seen.add(core)
    results.push(c)
    if (results.length >= count) break
  }
  return results
}

/**
 * Learn from what was actually worn, rather than only from explicit ratings.
 * What you reach for is a stronger signal than what you say you like — but a
 * quieter one, so each wear nudges less than a deliberate swipe.
 */
export function learnFromWear(
  weights: PrefWeights,
  items: Item[],
  strength = 0.05,
): PrefWeights {
  const next: PrefWeights = {
    colors: { ...weights.colors },
    types: { ...weights.types },
    harmonies: { ...weights.harmonies },
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  for (const item of items) {
    const c = item.colors?.[0]?.name
    if (c) next.colors[c] = clamp((next.colors[c] ?? 0) + strength)
    next.types[item.subcategory] = clamp((next.types[item.subcategory] ?? 0) + strength)
  }
  return next
}

/** Update learned weights from a 👍/👎 on an outfit. */
export function learnFrom(
  weights: PrefWeights,
  outfit: Outfit,
  liked: boolean,
): PrefWeights {
  const delta = liked ? 0.15 : -0.15
  const next: PrefWeights = {
    colors: { ...weights.colors },
    types: { ...weights.types },
    harmonies: { ...weights.harmonies },
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))

  for (const item of outfit.items) {
    const c = item.colors?.[0]?.name
    if (c) next.colors[c] = clamp((next.colors[c] ?? 0) + delta)
    next.types[item.subcategory] = clamp((next.types[item.subcategory] ?? 0) + delta)
  }
  return next
}

/**
 * Gap analysis: which single purchase would unlock the most new outfits?
 * Tries every colour × core type the user doesn't already own well, and
 * counts how many good outfits it would create.
 */
export function findGaps(
  all: Item[],
  profile: ColorProfile | null,
  occasion = 'Casual',
): { suggestion: string; unlocks: number }[] {
  const baseline = generateOutfits(all, { occasion, profile, cleanOnly: false, count: 60 })
    .filter((o) => o.score >= 72).length

  const candidateTypes: { category: Category; subcategory: string }[] = [
    { category: 'bottom', subcategory: 'Chinos' },
    { category: 'bottom', subcategory: 'Jeans' },
    { category: 'top', subcategory: 'Casual shirt' },
    { category: 'top', subcategory: 'T-shirt' },
    { category: 'shoes', subcategory: 'Sneakers' },
    { category: 'shoes', subcategory: 'Loafers' },
    { category: 'layer', subcategory: 'Overshirt' },
  ]
  const candidateColors = [
    { name: 'Navy', hex: '#1f2a44' },
    { name: 'Beige', hex: '#d6c5a3' },
    { name: 'White', hex: '#f5f5f5' },
    { name: 'Olive', hex: '#6b6b3d' },
    { name: 'Charcoal', hex: '#3d3d3d' },
    { name: 'Brown', hex: '#6b4b2f' },
  ]

  const results: { suggestion: string; unlocks: number; subcategory: string }[] = []

  for (const type of candidateTypes) {
    for (const color of candidateColors) {
      const already = all.some(
        (i) => i.subcategory === type.subcategory && i.colors?.[0]?.name === color.name,
      )
      if (already) continue

      const phantom: Item = {
        id: '__phantom__',
        user_id: '',
        name: `${color.name} ${type.subcategory}`,
        category: type.category,
        subcategory: type.subcategory,
        colors: [{ hex: color.hex, name: color.name, ratio: 1 }],
        primary_color: color.name,
        seasons: ['All-season'],
        occasions: [occasion],
        fabric: 'Cotton',
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
      const withItem = generateOutfits([...all, phantom], {
        occasion, profile, cleanOnly: false, count: 60,
      }).filter((o) => o.score >= 72 && o.items.some((i) => i.id === '__phantom__')).length

      if (withItem > 0) {
        results.push({
          suggestion: `${color.name} ${type.subcategory.toLowerCase()}`,
          unlocks: withItem,
          subcategory: type.subcategory,
        })
      }
    }
  }

  void baseline

  // Only the best colour per garment type. Otherwise a bottleneck category
  // fills the whole list — "buy sneakers" five times in different colours is
  // not advice anyone can act on.
  const bestPerType = new Map<string, { suggestion: string; unlocks: number; subcategory: string }>()
  for (const r of results.sort((a, b) => b.unlocks - a.unlocks)) {
    if (!bestPerType.has(r.subcategory)) bestPerType.set(r.subcategory, r)
  }
  return [...bestPerType.values()]
    .sort((a, b) => b.unlocks - a.unlocks)
    .slice(0, 5)
    .map(({ suggestion, unlocks }) => ({ suggestion, unlocks }))
}
