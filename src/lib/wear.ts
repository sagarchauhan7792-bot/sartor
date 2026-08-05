import { supabase } from './supabase'
import type { Item } from './taxonomy'

export interface WearLog {
  id: string
  worn_on: string
  outfit_id: string | null
  item_ids: string[]
  note: string
  created_at: string
}

/** Local YYYY-MM-DD (never UTC — "today" must mean the user's today). */
export function todayISO(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Record that these items were worn. Logs the wear and bumps each item's
 * times_worn / last_worn in a single transaction on the server.
 */
export async function logWear(
  items: Item[],
  opts: { outfitId?: string | null; date?: string; note?: string } = {},
): Promise<void> {
  if (items.length === 0) return
  const { error } = await supabase.rpc('sartor_log_wear', {
    p_item_ids: items.map((i) => i.id),
    p_outfit_id: opts.outfitId ?? null,
    p_worn_on: opts.date ?? todayISO(),
    p_note: opts.note ?? '',
  })
  if (error) throw error
}

export async function listWearLogs(limit = 400): Promise<WearLog[]> {
  const { data, error } = await supabase
    .from('sartor_wear_logs')
    .select('*')
    .order('worn_on', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WearLog[]
}

export async function deleteWearLog(id: string): Promise<void> {
  const { error } = await supabase.from('sartor_wear_logs').delete().eq('id', id)
  if (error) throw error
}

// ---------------- planning ahead ----------------

/**
 * A planned outfit is a wear log dated in the future. Same table, so today's
 * plan simply becomes history when the day passes.
 */
export async function planOutfit(
  items: Item[],
  date: string,
  note = '',
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { error } = await supabase.from('sartor_wear_logs').insert({
    user_id: userData.user.id,
    worn_on: date,
    item_ids: items.map((i) => i.id),
    note: note || 'planned',
  })
  if (error) throw error
}
