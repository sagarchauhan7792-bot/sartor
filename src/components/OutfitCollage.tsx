import type { Item } from '../lib/taxonomy'
import { slotStyle, type FitSettings } from '../lib/fit'
import StorageImg from './StorageImg'

/**
 * Lays the pieces out over a body — the wearer's own photo when they've added
 * one, otherwise a plain silhouette. Placement comes from their saved fit, so
 * garments sit where their shoulders and waist actually are.
 */
export default function OutfitCollage({
  items,
  fit,
  bodyPath,
  ghost,
}: {
  items: Item[]
  fit: FitSettings
  bodyPath?: string | null
  /** show every slot faintly, for the fit editor */
  ghost?: boolean
}) {
  const slot = (c: Item['category']) => items.find((i) => i.category === c)
  const top = slot('top')
  const bottom = slot('bottom')
  const shoes = slot('shoes')
  const layer = slot('layer')
  const accessory = slot('accessory')

  return (
    <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-white to-paper shadow-card">
      {bodyPath ? (
        <StorageImg path={bodyPath} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Silhouette />
      )}

      {/* Layer sits behind the top so the top reads as the main piece. */}
      {layer && (
        <Piece item={layer} style={slotStyle(fit.layer)} className="-rotate-6 opacity-95" ghost={ghost} />
      )}
      {top && <Piece item={top} style={slotStyle(fit.top)} ghost={ghost} />}
      {bottom && <Piece item={bottom} style={slotStyle(fit.bottom)} ghost={ghost} />}
      {shoes && <Piece item={shoes} style={slotStyle(fit.shoes)} ghost={ghost} />}
      {accessory && <Piece item={accessory} style={slotStyle(fit.accessory)} ghost={ghost} />}
    </div>
  )
}

function Piece({
  item, style, className, ghost,
}: {
  item: Item
  style: React.CSSProperties
  className?: string
  ghost?: boolean
}) {
  const isCutout = Boolean(item.cutout_path)
  return (
    <div className="absolute" style={style}>
      <StorageImg
        path={item.cutout_path ?? item.photo_path}
        alt={item.name}
        // A cutout has real transparency. A raw photo does not, and would sit
        // on the body as a solid rectangle — multiply blending drops light
        // backgrounds out, and the dashed frame admits when it can't.
        className={`h-full w-full object-contain ${
          isCutout
            ? 'drop-shadow-[0_6px_12px_rgba(28,25,23,0.14)]'
            : 'mix-blend-multiply'
        } ${ghost ? 'opacity-70' : ''} ${className ?? ''}`}
      />
      {!isCutout && (
        <span
          className="pointer-events-none absolute inset-0 rounded-lg border border-dashed border-clay/50"
          title="Background not removed — open the item to cut it out"
        />
      )}
    </div>
  )
}

/** Faint body outline used until the wearer adds a photo of their own. */
function Silhouette() {
  return (
    <svg
      viewBox="0 0 200 280"
      className="absolute inset-0 h-full w-full text-linen"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="currentColor" opacity="0.5">
        <circle cx="100" cy="26" r="17" />
        <path d="M100 46c-20 0-34 9-38 24l-8 34c-1 6 2 10 8 11l7 1 2 84c0 5 3 8 8 8h42c5 0 8-3 8-8l2-84 7-1c6-1 9-5 8-11l-8-34c-4-15-18-24-38-24z" />
        <rect x="78" y="196" width="17" height="66" rx="7" />
        <rect x="105" y="196" width="17" height="66" rx="7" />
      </g>
    </svg>
  )
}
