import { supabase } from './supabase'
import { extractColors } from './colors'
import { pairHarmony, isNeutral } from './harmony'
import type { Item, ItemColor } from './taxonomy'

export interface InspoImage {
  id: string
  image_path: string
  note: string
  colors: ItemColor[]
  created_at: string
}

export async function listInspo(): Promise<InspoImage[]> {
  const { data, error } = await supabase
    .from('sartor_inspo')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, colors: r.colors ?? [] })) as InspoImage[]
}

export async function addInspo(imagePath: string, colors: ItemColor[], note = ''): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { error } = await supabase.from('sartor_inspo').insert({
    user_id: userData.user.id,
    image_path: imagePath,
    colors,
    note,
  })
  if (error) throw error
}

export async function deleteInspo(id: string): Promise<void> {
  const { error } = await supabase.from('sartor_inspo').delete().eq('id', id)
  if (error) throw error
}

/**
 * Read the palette out of a reference image (a full look, not a cutout).
 * More clusters and a lower floor than garment tagging, because shoes and
 * accessories occupy only a sliver of an outfit photo but still define the look.
 */
export async function analyseInspo(blob: Blob): Promise<ItemColor[]> {
  return extractColors(blob, 6, false, 0.025)
}

export interface Match {
  item: Item
  score: number
  reason: string
}

/**
 * Find the pieces you already own that get closest to a reference look.
 * Scores each item against the reference palette, best per category first.
 */
export function matchToCloset(reference: ItemColor[], items: Item[]): Match[] {
  if (reference.length === 0 || items.length === 0) return []

  const scored: Match[] = items.map((item) => {
    const own = item.colors?.[0]
    if (!own) return { item, score: 0, reason: '' }

    // best relationship between this piece and any colour in the reference
    let best = { score: 0, refName: '', reason: '' }
    for (const ref of reference) {
      if (ref.ratio < 0.02) continue
      const exact = ref.name === own.name
      const h = pairHarmony(own.hex, own.name, ref.hex, ref.name)
      // an exact colour match is what "recreate this look" really means,
      // so it outranks a merely harmonious pairing
      const s = exact ? 100 : h.score * 0.72
      if (s > best.score) {
        best = {
          score: s,
          refName: ref.name,
          reason: exact
            ? `Same ${own.name.toLowerCase()} as the reference.`
            : `Its ${own.name.toLowerCase()} works with the ${ref.name.toLowerCase()} in the reference.`,
        }
      }
    }
    // neutrals are useful in almost any recreation, so don't let them score 0
    if (best.score < 60 && isNeutral(own.name)) {
      best = {
        score: 62,
        refName: '',
        reason: `${own.name} is neutral enough to slot into this look.`,
      }
    }
    return { item, score: Math.round(best.score), reason: best.reason }
  })

  // keep the strongest couple per category so the result reads like an outfit
  const byCategory = new Map<string, Match[]>()
  for (const m of scored) {
    if (m.score <= 0) continue
    const list = byCategory.get(m.item.category) ?? []
    list.push(m)
    byCategory.set(m.item.category, list)
  }
  const out: Match[] = []
  for (const list of byCategory.values()) {
    list.sort((a, b) => b.score - a.score)
    out.push(...list.slice(0, 2))
  }
  return out.sort((a, b) => b.score - a.score)
}
