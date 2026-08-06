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

const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 7
const URL_STORE_KEY = 'sartor.signedUrls'

interface SignedEntry { url: string; expires: number }

/**
 * Signed URLs are minted by a POST, which no service worker can cache — so
 * without persisting them the app could never show an image offline, even
 * though the image bytes themselves are cached. Keeping them on disk until
 * they expire is what makes offline browsing actually work.
 */
function loadUrlStore(): Record<string, SignedEntry> {
  try {
    return JSON.parse(localStorage.getItem(URL_STORE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveUrlStore(store: Record<string, SignedEntry>): void {
  try {
    localStorage.setItem(URL_STORE_KEY, JSON.stringify(store))
  } catch {
    /* quota exhausted — signed URLs are a cache, not state worth failing over */
  }
}

const urlCache = new Map<string, string>()

/** Signed URL for a private storage path, reused until it expires. */
export async function imageUrl(path: string | null): Promise<string | null> {
  if (!path) return null

  const inMemory = urlCache.get(path)
  if (inMemory) return inMemory

  const store = loadUrlStore()
  const saved = store[path]
  // renew a little early so a URL never expires mid-session
  if (saved && saved.expires > Date.now() + 60_000) {
    urlCache.set(path, saved.url)
    return saved.url
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS)

  if (error || !data) {
    // offline (or the sign call failed) — a stale URL still beats no image
    return saved?.url ?? null
  }

  urlCache.set(path, data.signedUrl)
  store[path] = { url: data.signedUrl, expires: Date.now() + SIGNED_TTL_SECONDS * 1000 }
  saveUrlStore(store)
  return data.signedUrl
}
