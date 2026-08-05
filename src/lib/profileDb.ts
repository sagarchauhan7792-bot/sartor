import { supabase } from './supabase'
import type { ColorProfile } from './season'
import type { PrefWeights } from './outfit'
import { EMPTY_WEIGHTS } from './outfit'
import type { Item } from './taxonomy'

export interface SartorProfile {
  color_season: ColorProfile['season'] | null
  undertone: ColorProfile['undertone'] | null
  depth: ColorProfile['depth'] | null
  contrast: ColorProfile['contrast'] | null
  custom_occasions: string[]
  pref_weights: PrefWeights
  selfie_path: string | null
}

const TABLE = 'sartor_profile'

export async function loadProfile(): Promise<SartorProfile | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null
  const { data } = await supabase.from(TABLE).select('*').eq('user_id', userData.user.id).maybeSingle()
  if (!data) return null
  const w = data.pref_weights ?? {}
  return {
    color_season: data.color_season,
    undertone: data.undertone,
    depth: data.depth ?? null,
    contrast: data.contrast ?? null,
    custom_occasions: data.custom_occasions ?? [],
    pref_weights: {
      colors: w.colors ?? {},
      types: w.types ?? {},
      harmonies: w.harmonies ?? {},
    },
    selfie_path: data.selfie_path ?? null,
  }
}

export async function saveProfile(patch: Partial<SartorProfile>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userData.user.id, ...patch, updated_at: new Date().toISOString() })
  if (error) throw error
}

export function toColorProfile(p: SartorProfile | null): ColorProfile | null {
  if (!p?.color_season || !p.undertone) return null
  return {
    season: p.color_season,
    undertone: p.undertone,
    depth: p.depth ?? 'medium',
    contrast: p.contrast ?? 'medium',
  }
}

export function weightsOf(p: SartorProfile | null): PrefWeights {
  return p?.pref_weights ?? EMPTY_WEIGHTS
}

// ---------------- saved outfits ----------------

export interface SavedOutfit {
  id: string
  name: string
  occasion: string
  item_ids: string[]
  score: number | null
  source: 'manual' | 'suggested'
  created_at: string
}

export async function listSavedOutfits(): Promise<SavedOutfit[]> {
  const { data, error } = await supabase
    .from('sartor_outfits')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SavedOutfit[]
}

export async function saveOutfit(o: {
  name: string
  occasion: string
  items: Item[]
  score: number
  source: 'manual' | 'suggested'
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { error } = await supabase.from('sartor_outfits').insert({
    user_id: userData.user.id,
    name: o.name,
    occasion: o.occasion,
    item_ids: o.items.map((i) => i.id),
    score: o.score,
    source: o.source,
  })
  if (error) throw error
}

export async function deleteSavedOutfit(id: string): Promise<void> {
  const { error } = await supabase.from('sartor_outfits').delete().eq('id', id)
  if (error) throw error
}

// ---------------- ratings ----------------

export async function recordRating(items: Item[], liked: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return
  await supabase.from('sartor_ratings').insert({
    user_id: userData.user.id,
    item_ids: items.map((i) => i.id),
    features: {
      colors: items.map((i) => i.colors?.[0]?.name).filter(Boolean),
      types: items.map((i) => i.subcategory),
    },
    liked,
  })
}
