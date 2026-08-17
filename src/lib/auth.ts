import { supabase } from './supabase'

const EMAIL_KEY = 'sartor.email'

// The PIN is the only thing the user types; under the hood it becomes the
// password of a single Supabase account, so real auth + RLS guard the data.
function derivePassword(pin: string): string {
  return `sartor.v1.${pin}.wardrobe`
}

export function savedEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

export async function isUnlocked(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}

/** First run: create (or attach to) the single Sartor account. */
export async function setup(email: string, pin: string): Promise<string | null> {
  const password = derivePassword(pin)
  // try sign-in first (account may already exist from another device)
  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error) {
    localStorage.setItem(EMAIL_KEY, email)
    return null
  }
  const signUp = await supabase.auth.signUp({ email, password })
  if (signUp.error) return signUp.error.message
  if (signUp.data.session === null) {
    return 'CONFIRM_EMAIL' // project requires email confirmation
  }
  localStorage.setItem(EMAIL_KEY, email)
  return null
}

/** Unlock with PIN on a device that already knows the account email. */
export async function unlock(pin: string): Promise<string | null> {
  const email = savedEmail()
  if (!email) return 'No account on this device yet.'
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: derivePassword(pin),
  })
  if (error) return 'Wrong PIN.'
  return null
}

export async function lock(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Change the PIN while signed in. Without this a forgotten PIN is a permanent
 * lockout, because the PIN *is* the password and nothing else can recover it.
 */
export async function changePin(currentPin: string, nextPin: string): Promise<string | null> {
  const email = savedEmail()
  if (!email) return 'No account on this device.'
  if (nextPin.length < 4) return 'Choose at least 4 digits.'

  // re-authenticate first, so a borrowed unlocked phone can't silently reset it
  const check = await supabase.auth.signInWithPassword({
    email,
    password: derivePassword(currentPin),
  })
  if (check.error) return 'That current PIN is wrong.'

  const { error } = await supabase.auth.updateUser({ password: derivePassword(nextPin) })
  if (error) return error.message
  return null
}

/**
 * Send a recovery email — the escape hatch when the PIN is genuinely lost.
 * The link returns to the app, where a new PIN can be set.
 */
export async function requestRecovery(): Promise<string | null> {
  const email = savedEmail()
  if (!email) return 'No account on this device.'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
  })
  return error ? error.message : null
}

/** Set a new PIN after arriving from a recovery link. */
export async function setPinAfterRecovery(pin: string): Promise<string | null> {
  if (pin.length < 4) return 'Choose at least 4 digits.'
  const { error } = await supabase.auth.updateUser({ password: derivePassword(pin) })
  return error ? error.message : null
}
