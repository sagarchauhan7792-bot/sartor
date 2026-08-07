// Pull individual garments out of a photo of you wearing them.
//
// Runs a clothing-segmentation model (Xenova/segformer_b2_clothes) entirely in
// the browser via transformers.js — no API key, no queue, no upload. The model
// downloads once (~25MB) and is cached by the browser afterwards.

import type { Category } from './taxonomy'
import { getPipeline, type Progress } from './hf'

/** Label → where it belongs in the closet. Labels the model emits that aren't
 *  clothing (skin, hair, background) are simply absent from this map. */
const LABEL_MAP: Record<string, { category: Category; subcategory: string }> = {
  'Upper-clothes': { category: 'top', subcategory: 'T-shirt' },
  Dress: { category: 'top', subcategory: 'Casual shirt' },
  Pants: { category: 'bottom', subcategory: 'Jeans' },
  Skirt: { category: 'bottom', subcategory: 'Chinos' },
  'Left-shoe': { category: 'shoes', subcategory: 'Sneakers' },
  'Right-shoe': { category: 'shoes', subcategory: 'Sneakers' },
  Belt: { category: 'accessory', subcategory: 'Belt' },
  Hat: { category: 'accessory', subcategory: 'Cap' },
  Sunglasses: { category: 'accessory', subcategory: 'Sunglasses' },
  Bag: { category: 'accessory', subcategory: 'Bag' },
  Scarf: { category: 'accessory', subcategory: 'Bracelet' },
}

/** Shoes come back as two separate labels; merge them into one garment. */
const MERGE_INTO: Record<string, string> = {
  'Left-shoe': 'Shoes',
  'Right-shoe': 'Shoes',
}

export interface ExtractedGarment {
  label: string
  category: Category
  subcategory: string
  /** transparent PNG containing just this garment, trimmed */
  blob: Blob
  previewUrl: string
  /** share of the photo this garment covered — tiny ones are usually noise */
  coverage: number
}


async function getSegmenter(onProgress?: Progress) {
  onProgress?.('Loading the clothing model…')
  return getPipeline(
    'image-segmentation',
    'Xenova/segformer_b2_clothes',
    onProgress,
    'clothing model',
  )
}

/**
 * Segment a photo of a dressed person into individual garments.
 * Returns one transparent PNG per garment found.
 */
export async function extractGarments(
  file: Blob,
  onProgress?: Progress,
): Promise<ExtractedGarment[]> {
  const segmenter = (await getSegmenter(onProgress)) as (
    url: string,
  ) => Promise<{ label: string; mask: { data: Uint8Array; width: number; height: number } }[]>

  onProgress?.('Finding the clothes…')
  const url = URL.createObjectURL(file)
  let output: { label: string; mask: { data: Uint8Array; width: number; height: number } }[]
  try {
    output = await segmenter(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  const source = await blobToImage(file)

  // Combine masks that belong to the same garment (left + right shoe).
  const merged = new Map<string, { label: string; mask: Uint8Array; w: number; h: number }>()
  for (const seg of output) {
    if (!LABEL_MAP[seg.label]) continue
    const key = MERGE_INTO[seg.label] ?? seg.label
    const existing = merged.get(key)
    if (existing) {
      for (let i = 0; i < existing.mask.length; i++) {
        if (seg.mask.data[i] > existing.mask[i]) existing.mask[i] = seg.mask.data[i]
      }
    } else {
      merged.set(key, {
        label: seg.label,
        mask: Uint8Array.from(seg.mask.data),
        w: seg.mask.width,
        h: seg.mask.height,
      })
    }
  }

  onProgress?.('Cutting each piece out…')
  const results: ExtractedGarment[] = []
  for (const [key, m] of merged) {
    const cut = await applyMask(source, m.mask, m.w, m.h)
    if (!cut) continue
    const map = LABEL_MAP[m.label]
    results.push({
      label: key === 'Shoes' ? 'Shoes' : m.label,
      category: map.category,
      subcategory: map.subcategory,
      blob: cut.blob,
      previewUrl: URL.createObjectURL(cut.blob),
      coverage: cut.coverage,
    })
  }

  // Drop slivers — a few stray pixels of "belt" is a misdetection, not a garment.
  return results
    .filter((r) => r.coverage > 0.004)
    .sort((a, b) => b.coverage - a.coverage)
}

/**
 * Cut the masked region out of the source image onto transparency, then crop
 * to the garment's bounding box.
 */
async function applyMask(
  source: HTMLImageElement,
  mask: Uint8Array,
  mw: number,
  mh: number,
): Promise<{ blob: Blob; coverage: number } | null> {
  const w = source.naturalWidth
  const h = source.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)

  let minX = w, minY = h, maxX = 0, maxY = 0, on = 0
  for (let y = 0; y < h; y++) {
    // the mask is at the model's resolution; sample it nearest-neighbour
    const my = Math.min(mh - 1, Math.floor((y / h) * mh))
    for (let x = 0; x < w; x++) {
      const mx = Math.min(mw - 1, Math.floor((x / w) * mw))
      const v = mask[my * mw + mx]
      const i = (y * w + x) * 4
      if (v > 127) {
        img.data[i + 3] = 255
        on++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      } else {
        img.data[i + 3] = 0
      }
    }
  }
  if (on === 0 || maxX <= minX || maxY <= minY) return null

  ctx.putImageData(img, 0, 0)

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03)
  const cx = Math.max(0, minX - pad)
  const cy = Math.max(0, minY - pad)
  const cw = Math.min(w, maxX + pad) - cx
  const ch = Math.min(h, maxY + pad) - cy

  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'))
  if (!blob) return null
  return { blob, coverage: on / (w * h) }
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bad image')) }
    img.src = url
  })
}
