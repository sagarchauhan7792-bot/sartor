import { listItems, imageUrl } from './db'
import { listSavedOutfits, loadProfile } from './profileDb'
import { listWearLogs } from './wear'
import { listInspo } from './inspo'

/**
 * A wardrobe represents real effort to rebuild — every garment photographed,
 * cut out and tagged. This writes the whole thing to a file you keep, so it
 * survives a lost account, a paused project, or a change of mind about hosting.
 */
export async function exportWardrobe(
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  onProgress?.('Collecting your closet…')
  const [items, outfits, profile, wears, inspo] = await Promise.all([
    listItems(),
    listSavedOutfits().catch(() => []),
    loadProfile().catch(() => null),
    listWearLogs(2000).catch(() => []),
    listInspo().catch(() => []),
  ])

  onProgress?.('Resolving image links…')
  // Signed URLs expire, so record them alongside the storage paths rather than
  // pretending the export is self-contained.
  const withUrls = await Promise.all(
    items.map(async (i) => ({
      ...i,
      photo_url: await imageUrl(i.photo_path).catch(() => null),
      cutout_url: await imageUrl(i.cutout_path).catch(() => null),
    })),
  )

  const payload = {
    format: 'sartor-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    counts: {
      items: items.length,
      outfits: outfits.length,
      wears: wears.length,
      inspiration: inspo.length,
    },
    profile,
    items: withUrls,
    outfits,
    wear_logs: wears,
    inspiration: inspo,
  }

  onProgress?.('Writing the file…')
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** Trigger a download of the export in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // give the download a moment to start before revoking
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function backupFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `sartor-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}
