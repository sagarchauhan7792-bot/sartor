// Virtual try-on via a free Hugging Face Space.
//
// This is genuinely best-effort: free Spaces queue, sleep, and sometimes go
// offline entirely. Every failure mode here is surfaced to the user in plain
// language rather than retried silently, because a 90-second wait that ends in
// nothing is worse than being told up front.

const SPACE = 'Kwai-Kolors/Kolors-Virtual-Try-On'

export type TryOnStatus =
  | { state: 'connecting' }
  | { state: 'queued'; position?: number }
  | { state: 'generating' }
  | { state: 'done'; url: string }
  | { state: 'failed'; message: string }

/** A stock male model image, used when the user hasn't supplied a body photo. */
export const DEFAULT_MODEL_IMAGE = 'model/male-model.jpg'

/**
 * Dress `personBlob` in `garmentBlob`. Resolves with an object URL of the
 * result, or throws with a message worth showing.
 */
export async function tryOn(
  personBlob: Blob,
  garmentBlob: Blob,
  onStatus?: (s: TryOnStatus) => void,
): Promise<string> {
  onStatus?.({ state: 'connecting' })

  let client: { predict: (endpoint: string, args: unknown[]) => Promise<{ data: unknown[] }> }
  try {
    const { Client } = await import('@gradio/client')
    client = (await Client.connect(SPACE)) as unknown as typeof client
  } catch {
    throw new Error(
      'The free try-on service is unreachable right now. It runs on shared hardware and goes offline periodically — the outfit preview above still works.',
    )
  }

  onStatus?.({ state: 'queued' })

  let result: { data: unknown[] }
  try {
    result = await client.predict('/tryon', [
      personBlob,
      garmentBlob,
      0, // seed
      true, // randomise seed
    ])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/quota|rate|limit/i.test(msg)) {
      throw new Error('The free try-on service has hit its shared usage limit. Try again in a while.')
    }
    if (/timeout|time out/i.test(msg)) {
      throw new Error('Try-on took too long and timed out — the free queue was busy.')
    }
    throw new Error('Try-on failed on the service side. This happens with free Spaces; the outfit preview above is unaffected.')
  }

  onStatus?.({ state: 'generating' })

  const url = firstImageUrl(result.data)
  if (!url) throw new Error('The service returned no image.')
  onStatus?.({ state: 'done', url })
  return url
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
