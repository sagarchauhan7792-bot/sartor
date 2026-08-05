// Supabase connection — the anon (publishable) key is public by design;
// all data access is protected by RLS + auth, not by hiding this key.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://bnnjedslywnkctfrtqmx.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_rzkj2fknxe_llNTbSQlhpQ_PmijL6XE'

export const STORAGE_BUCKET = 'sartor'
