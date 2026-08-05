// Client-side image utilities: downscale/compress before upload, and
// lazy-loaded in-browser background removal (free, WASM).

/** Downscale + JPEG-compress a photo for storage (max 1200px edge). */
export async function compressPhoto(file: Blob, maxEdge = 1200, quality = 0.85): Promise<Blob> {
  const img = await blobToImage(file)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return canvasToBlob(canvas, 'image/jpeg', quality)
}

/**
 * Remove the background using @imgly/background-removal (runs fully in the
 * browser — first call downloads ~40MB of model assets, then it's cached).
 */
export async function removeBackground(
  file: Blob,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  onProgress?.('Loading AI model…')
  const { removeBackground: imglyRemove } = await import('@imgly/background-removal')
  onProgress?.('Cutting out garment…')
  const result = await imglyRemove(file, {
    output: { format: 'image/png', quality: 0.9 },
    progress: (key, current, total) => {
      if (!key.startsWith('fetch')) return
      const pct = Math.round((current / total) * 100)
      // Once the assets are in, inference is the slow part — leaving the label
      // at "Downloading 100%" reads as finished-but-frozen.
      onProgress?.(pct >= 100 ? 'Cutting out garment…' : `Downloading model ${pct}%`)
    },
  })
  return result
}

/** Trim transparent margins from a cutout PNG and pad slightly. */
export async function trimTransparent(blob: Blob): Promise<Blob> {
  const img = await blobToImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height)
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return blob
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(width, maxX + pad); maxY = Math.min(height, maxY + pad)
  const out = document.createElement('canvas')
  out.width = maxX - minX
  out.height = maxY - minY
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return canvasToBlob(out, 'image/png')
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, quality)
  })
}
