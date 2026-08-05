// In-browser dominant-color extraction (k-means on a downscaled canvas)
// plus mapping to named menswear colors. No API calls — runs locally.

import type { ItemColor } from './taxonomy'

// Fashion color vocabulary: name + representative hex. Nearest-neighbor in
// Lab-ish space decides the label shown to the user.
export const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Charcoal', hex: '#3d3d3d' },
  { name: 'Grey', hex: '#808080' },
  { name: 'Light grey', hex: '#c8c8c8' },
  { name: 'White', hex: '#f5f5f5' },
  { name: 'Off-white', hex: '#efe9dd' },
  { name: 'Beige', hex: '#d6c5a3' },
  { name: 'Tan', hex: '#c19a6b' },
  { name: 'Khaki', hex: '#9a8f6b' },
  { name: 'Brown', hex: '#6b4b2f' },
  { name: 'Chocolate', hex: '#4a2f22' },
  { name: 'Camel', hex: '#b58a55' },
  { name: 'Navy', hex: '#1f2a44' },
  { name: 'Blue', hex: '#2d5fa6' },
  { name: 'Sky blue', hex: '#8ab6d9' },
  { name: 'Denim blue', hex: '#4a6a94' },
  { name: 'Teal', hex: '#2a7f7f' },
  { name: 'Green', hex: '#3e7a44' },
  { name: 'Olive', hex: '#6b6b3d' },
  { name: 'Sage', hex: '#9aa88f' },
  { name: 'Forest', hex: '#2c4c34' },
  { name: 'Mint', hex: '#b2d8c2' },
  { name: 'Red', hex: '#b3282d' },
  { name: 'Maroon', hex: '#6e1f2a' },
  { name: 'Burgundy', hex: '#5e2129' },
  { name: 'Rust', hex: '#a1512d' },
  { name: 'Orange', hex: '#d97b29' },
  { name: 'Mustard', hex: '#c9992e' },
  { name: 'Yellow', hex: '#e3c53d' },
  { name: 'Cream', hex: '#f0e6c8' },
  { name: 'Pink', hex: '#d98aa3' },
  { name: 'Blush', hex: '#e8c4c4' },
  { name: 'Purple', hex: '#6a4b8a' },
  { name: 'Lavender', hex: '#b6a3d1' },
]

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

// perceptual-ish distance: weighted RGB (good enough for naming, fast)
function colorDist(a: [number, number, number], b: [number, number, number]): number {
  const rmean = (a[0] + b[0]) / 2
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db,
  )
}

export function nearestColorName(hex: string): string {
  const rgb = hexToRgb(hex)
  let best = NAMED_COLORS[0], bestD = Infinity
  for (const c of NAMED_COLORS) {
    const d = colorDist(rgb, hexToRgb(c.hex))
    if (d < bestD) { bestD = d; best = c }
  }
  return best.name
}

/**
 * Extract up to `k` dominant colors from an image blob/URL.
 * Transparent pixels (from background removal) are ignored, so on a cutout
 * this reads only the garment. On a raw photo it samples the center crop.
 */
export async function extractColors(
  source: Blob | string,
  k = 4,
  hasAlpha = false,
): Promise<ItemColor[]> {
  const img = await loadImage(source)
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const pixels: [number, number, number][] = []
  const margin = hasAlpha ? 0 : Math.floor(size * 0.18) // center-crop raw photos
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin; x < size - margin; x++) {
      const i = (y * size + x) * 4
      if (data[i + 3] < 128) continue // transparent → background
      pixels.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  if (pixels.length === 0) return []

  // k-means, k up to 5, few iterations is plenty at 96px
  const centers: [number, number, number][] = []
  const step = Math.max(1, Math.floor(pixels.length / k))
  for (let i = 0; i < k; i++) centers.push([...pixels[Math.min(i * step, pixels.length - 1)]])

  const assign = new Array<number>(pixels.length).fill(0)
  for (let iter = 0; iter < 8; iter++) {
    for (let p = 0; p < pixels.length; p++) {
      let bd = Infinity, bi = 0
      for (let c = 0; c < centers.length; c++) {
        const d = colorDist(pixels[p], centers[c])
        if (d < bd) { bd = d; bi = c }
      }
      assign[p] = bi
    }
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let p = 0; p < pixels.length; p++) {
      const s = sums[assign[p]]
      s[0] += pixels[p][0]; s[1] += pixels[p][1]; s[2] += pixels[p][2]; s[3]++
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
      }
    }
  }

  const counts = centers.map((_, c) => assign.filter((a) => a === c).length)
  const total = counts.reduce((a, b) => a + b, 0)

  const result: ItemColor[] = centers
    .map((c, i) => ({
      hex: rgbToHex(c[0], c[1], c[2]),
      name: nearestColorName(rgbToHex(c[0], c[1], c[2])),
      ratio: counts[i] / total,
    }))
    .filter((c) => c.ratio > 0.06)
    .sort((a, b) => b.ratio - a.ratio)

  // merge clusters that mapped to the same name
  const merged = new Map<string, ItemColor>()
  for (const c of result) {
    const prev = merged.get(c.name)
    if (prev) prev.ratio += c.ratio
    else merged.set(c.name, { ...c })
  }
  return [...merged.values()].sort((a, b) => b.ratio - a.ratio)
}

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source)
  })
}
