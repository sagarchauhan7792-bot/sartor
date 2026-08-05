// Virtual try-on via free Hugging Face Spaces.
//
// This is genuinely best-effort: free Spaces queue, sleep, change their APIs,
// and sometimes go offline entirely. So we try more than one, and every failure
// mode is reported in plain language rather than retried silently — a
// ninety-second wait that ends in nothing is worse than being told up front.

import type { Category } from './taxonomy'

const TOKEN_KEY = 'sartor.hfToken'

export function savedHfToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setHfToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Which garment slot a Space expects, in its own vocabulary. */
function garmentType(category: Category): string {
  if (category === 'bottom') return 'Bottom'
  if (category === 'layer') return 'Dress/Suit'
  return 'Top'
}

interface Provider {
  space: string
  label: string
  endpoint: string
  /** Kolors blocks anonymous API access; it needs the user's own HF token. */
  needsToken?: boolean
  args: (person: Blob, garment: Blob, category: Category) => unknown[]
}

const PROVIDERS: Provider[] = [
  {
    space: 'Miragic-AI/Miragic-Virtual-Try-On',
    label: 'Miragic',
    endpoint: '/virtual_tryon',
    args: (person, garment, category) => [person, garment, garmentType(category)],
  },
  {
    space: 'Kwai-Kolors/Kolors-Virtual-Try-On',
    label: 'Kolors',
    endpoint: '/tryon',
    needsToken: true,
    args: (person, garment) => [person, garment, 0, true],
  },
]

export type TryOnStatus =
  | { state: 'connecting'; provider: string }
  | { state: 'queued'; provider: string }
  | { state: 'done'; url: string }

/**
 * Dress `person` in `garment`. Tries each available provider in turn and
 * resolves with an image URL, or throws with a message worth showing.
 */
export async function tryOn(
  person: Blob,
  garment: Blob,
  category: Category,
  onStatus?: (s: TryOnStatus) => void,
): Promise<string> {
  const token = savedHfToken()
  const usable = PROVIDERS.filter((p) => !p.needsToken || token)

  if (usable.length === 0) {
    throw new Error('No try-on service is available without a Hugging Face token.')
  }

  const { Client } = await import('@gradio/client')
  const failures: string[] = []

  for (const provider of usable) {
    try {
      onStatus?.({ state: 'connecting', provider: provider.label })
      const client = await Client.connect(
        provider.space,
        token ? { hf_token: token as `hf_${string}` } : undefined,
      )

      onStatus?.({ state: 'queued', provider: provider.label })
      const result = await client.predict(
        provider.endpoint,
        provider.args(person, garment, category),
      )

      const url = firstImageUrl(result.data as unknown[])
      if (!url) throw new Error('returned no image')
      onStatus?.({ state: 'done', url })
      return url
    } catch (e) {
      const raw = errorText(e)
      console.warn(`[sartor] try-on via ${provider.label} failed:`, raw, e)
      failures.push(`${provider.label}: ${summarise(raw)}`)
    }
  }

  throw new Error(
    `Try-on didn't work this time. ${failures.join('; ')}. ` +
      'These are free shared services, so this happens — the outfit preview above is unaffected.',
  )
}

/** Gradio throws plain objects as often as Errors; dig out something readable. */
function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    for (const key of ['message', 'original_msg', 'detail', 'title', 'stage']) {
      const v = o[key]
      if (typeof v === 'string' && v) return v
    }
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

function summarise(msg: string): string {
  if (/403/.test(msg)) return 'needs a Hugging Face token'
  if (/quota|rate|limit/i.test(msg)) return 'hit its usage limit'
  if (/timeout|timed out/i.test(msg)) return 'timed out in the queue'
  if (/region/i.test(msg)) return 'is not available in your region'
  if (/fetch|network|config/i.test(msg)) return 'was unreachable'
  // The service often explains itself better than a generic label can —
  // pass its own words through when they're short enough to read.
  const clean = msg.replace(/\s+/g, ' ').trim()
  if (clean.length > 0 && clean.length < 160) return clean
  return 'failed'
}

/** Gradio returns files in a few shapes depending on version. */
function firstImageUrl(data: unknown[]): string | null {
  for (const entry of data) {
    if (typeof entry === 'string' && /^https?:\/\//.test(entry)) return entry
    if (entry && typeof entry === 'object') {
      const o = entry as { url?: string; path?: string; image?: { url?: string } }
      if (o.url) return o.url
      if (o.image?.url) return o.image.url
      if (o.path && /^https?:\/\//.test(o.path)) return o.path
    }
  }
  return null
}
