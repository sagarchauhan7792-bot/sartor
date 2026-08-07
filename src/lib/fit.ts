// How garments sit on the body in the outfit preview.
//
// Bodies and photos differ — a full-length shot taken at arm's length puts the
// shoulders somewhere quite different from a mirror selfie. So placement is
// calibrated once per person and reused everywhere, rather than being a fixed
// layout that only ever suits one photo.

import type { Category } from './taxonomy'

export interface SlotFit {
  /** vertical centre, as a fraction of the frame height */
  top: number
  /** height, as a fraction of the frame height */
  height: number
  /** width, as a fraction of the frame width */
  width: number
}

export type FitSettings = Record<Category, SlotFit>

/** Tuned against the built-in silhouette; a good starting point for a photo. */
export const DEFAULT_FIT: FitSettings = {
  top: { top: 0.30, height: 0.34, width: 0.56 },
  layer: { top: 0.30, height: 0.34, width: 0.40 },
  bottom: { top: 0.615, height: 0.33, width: 0.46 },
  shoes: { top: 0.90, height: 0.16, width: 0.36 },
  accessory: { top: 0.69, height: 0.14, width: 0.20 },
}

const LIMITS = {
  top: { min: 0.05, max: 0.97 },
  height: { min: 0.05, max: 0.6 },
  width: { min: 0.08, max: 0.95 },
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Merge stored settings over the defaults, ignoring anything out of range. */
export function resolveFit(stored: unknown): FitSettings {
  const out: FitSettings = {
    top: { ...DEFAULT_FIT.top },
    layer: { ...DEFAULT_FIT.layer },
    bottom: { ...DEFAULT_FIT.bottom },
    shoes: { ...DEFAULT_FIT.shoes },
    accessory: { ...DEFAULT_FIT.accessory },
  }
  if (!stored || typeof stored !== 'object') return out

  for (const [slot, value] of Object.entries(stored as Record<string, unknown>)) {
    const key = slot as Category
    if (!(key in out) || !value || typeof value !== 'object') continue
    const v = value as Partial<SlotFit>
    if (typeof v.top === 'number') out[key].top = clamp(v.top, LIMITS.top.min, LIMITS.top.max)
    if (typeof v.height === 'number') out[key].height = clamp(v.height, LIMITS.height.min, LIMITS.height.max)
    if (typeof v.width === 'number') out[key].width = clamp(v.width, LIMITS.width.min, LIMITS.width.max)
  }
  return out
}

/** CSS for one garment slot, positioned by its centre so scaling feels natural. */
export function slotStyle(fit: SlotFit): React.CSSProperties {
  return {
    top: `${(fit.top - fit.height / 2) * 100}%`,
    height: `${fit.height * 100}%`,
    width: `${fit.width * 100}%`,
    left: `${(1 - fit.width) * 50}%`,
  }
}

export const SLOT_LABELS: { id: Category; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'layer', label: 'Layer' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessory' },
]
