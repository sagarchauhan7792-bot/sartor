import { supabase } from './supabase'
import { STORAGE_BUCKET } from '../config'
import type { Item, LaundryStatus } from './taxonomy'

const ITEMS = 'sartor_items'

export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from(ITEMS)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Item[]
}

export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supabase.from(ITEMS).select('*').eq('id', id).single()
  if (error) return null
  return data as Item
}

export type NewItem = Omit<Item, 'id' | 'user_id' | 'created_at' | 'times_worn' | 'last_worn'>

export async function createItem(item: NewItem): Promise<Item> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from(ITEMS)
    .insert({ ...item, user_id: userData.user.id })
    .select()
    .single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  const { error } = await supabase.from(ITEMS).update(patch).eq('id', id)
  if (error) throw error
}

export async function setLaundry(id: string, status: LaundryStatus): Promise<void> {
  await updateItem(id, { laundry_status: status })
}

export async function deleteItem(item: Item): Promise<void> {
  const paths = [item.photo_path, item.cutout_path].filter(Boolean) as string[]
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
  const { error } = await supabase.from(ITEMS).delete().eq('id', item.id)
  if (error) throw error
}

/** Upload an image blob; returns the storage path. */
export async function uploadImage(blob: Blob, kind: 'photo' | 'cutout'): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userData.user.id}/${kind}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

const urlCache = new Map<string, string>()

/** Signed URL for a private storage path (cached per session). */
export async function imageUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const cached = urlCache.get(path)
  if (cached) return cached
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error || !data) return null
  urlCache.set(path, data.signedUrl)
  return data.signedUrl
}
