// Import an item from a product page.
//
// A browser can't fetch an arbitrary site directly (CORS), so this goes through
// two free, public services: r.jina.ai renders the page as text with permissive
// CORS, and images.weserv.nl re-serves the product image with CORS headers so
// the bytes can reach a canvas. Both are read-only and need no key.

export interface ImportedProduct {
  imageBlob: Blob
  title: string
  sourceUrl: string
}

const READER = 'https://r.jina.ai/'
const IMG_PROXY = 'https://images.weserv.nl/?url='

export async function importFromUrl(
  rawUrl: string,
  onProgress?: (msg: string) => void,
): Promise<ImportedProduct> {
  const url = normaliseUrl(rawUrl)

  onProgress?.('Reading the page…')
  const page = await fetchText(`${READER}${url}`)

  const imageUrl = pickImage(page, url)
  if (!imageUrl) {
    throw new Error("Couldn't find a product image on that page. Save the image and add it from your gallery instead.")
  }

  onProgress?.('Fetching the image…')
  const imageBlob = await fetchImage(imageUrl)

  return { imageBlob, title: pickTitle(page), sourceUrl: url }
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  // throws on genuinely malformed input, which the caller surfaces
  return new URL(withProtocol).toString()
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'text/plain' } })
  if (!res.ok) throw new Error(`That page could not be read (${res.status}).`)
  return res.text()
}

/**
 * r.jina.ai returns markdown-ish text. Product images show up as markdown
 * image links or bare URLs; prefer the largest plausible product shot.
 */
function pickImage(page: string, pageUrl: string): string | null {
  const candidates: string[] = []

  for (const m of page.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    candidates.push(m[1])
  }
  for (const m of page.matchAll(/(https?:\/\/[^\s"')]+\.(?:jpe?g|png|webp)(?:\?[^\s"')]*)?)/gi)) {
    candidates.push(m[1])
  }

  const host = safeHost(pageUrl)
  const scored = candidates
    .filter((u) => !/sprite|logo|icon|favicon|placeholder|banner|pixel/i.test(u))
    .map((u) => {
      let score = 0
      if (host && safeHost(u) && safeHost(u)!.includes(host.replace(/^www\./, ''))) score += 3
      if (/cdn|media|images?|product/i.test(u)) score += 2
      // many CDNs encode dimensions in the path; bigger is more likely the hero
      const dim = u.match(/(\d{3,4})x(\d{3,4})/)
      if (dim) score += Math.min(3, Math.floor(Number(dim[1]) / 400))
      return { u, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.u ?? null
}

function pickTitle(page: string): string {
  const heading = page.match(/^#\s+(.+)$/m)?.[1]
  const titleLine = page.match(/^Title:\s*(.+)$/m)?.[1]
  const raw = (heading ?? titleLine ?? '').trim()
  return raw.replace(/\s*[|–-]\s*[^|–-]*$/, '').slice(0, 80)
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).host
  } catch {
    return null
  }
}

async function fetchImage(imageUrl: string): Promise<Blob> {
  // weserv wants the whole URL, protocol included, percent-encoded. Stripping
  // the scheme makes it time out rather than fail loudly.
  const proxied = `${IMG_PROXY}${encodeURIComponent(imageUrl)}&w=1200`
  const res = await fetch(proxied)
  if (!res.ok) throw new Error('That image could not be downloaded.')
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('That link did not return an image.')
  if (blob.size < 2000) throw new Error('That image was too small to use.')
  return blob
}
