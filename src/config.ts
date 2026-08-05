// Supabase connection — the anon (publishable) key is public by design;
// all data access is protected by RLS + auth, not by hiding this key.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://mjdrnlqqsqqogxszzspi.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_3c8AxHdis_kbwBn5f9rkkg_u11wiu6u'

export const STORAGE_BUCKET = 'sartor'
