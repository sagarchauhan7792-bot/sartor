import type { Item } from '../lib/taxonomy'
import StorageImg from './StorageImg'

/**
 * Lays the pieces out the way a stylist arranges a flat-lay: layer and top on
 * the upper body, bottom below, shoes at the feet, accessory to the side — over
 * a faint mannequin silhouette so the proportions read as an outfit.
 */
export default function OutfitCollage({ items }: { items: Item[] }) {
  const slot = (c: Item['category']) => items.find((i) => i.category === c)
  const top = slot('top')
  const bottom = slot('bottom')
  const shoes = slot('shoes')
  const layer = slot('layer')
  const accessory = slot('accessory')

  return (
    <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-white to-paper shadow-card">
      <Silhouette />

      {/* Slots line up with the silhouette: torso 15–46%, legs 46–77%,
          feet below that. */}
      <div className="absolute inset-x-0 top-[13%] flex h-[34%] items-center justify-center gap-0.5">
        {layer && <Piece item={layer} className="h-full w-[40%] -rotate-6 opacity-95" />}
        {top && <Piece item={top} className={layer ? 'h-full w-[46%]' : 'h-full w-[56%]'} />}
      </div>

      <div className="absolute inset-x-0 top-[45%] flex h-[33%] items-center justify-center">
        {bottom && <Piece item={bottom} className="h-full w-[46%]" />}
      </div>

      <div className="absolute inset-x-0 bottom-[4%] flex h-[16%] items-center justify-center">
        {shoes && <Piece item={shoes} className="h-full w-[36%]" />}
      </div>

      {/* accessory tucked into the corner like a styling detail */}
      {accessory && (
        <div className="absolute right-[5%] bottom-[24%] h-[14%] w-[20%]">
          <Piece item={accessory} className="h-full w-full" />
        </div>
      )}
    </div>
  )
}

function Piece({ item, className }: { item: Item; className?: string }) {
  const isCutout = Boolean(item.cutout_path)
  return (
    <StorageImg
      path={item.cutout_path ?? item.photo_path}
      alt={item.name}
      // A cutout already has transparency. A raw photo does not, and a plain
      // white rectangle would sit on top of everything — multiply blending
      // drops light backgrounds out so the garment still reads as worn.
      className={`object-contain ${
        isCutout
          ? 'drop-shadow-[0_6px_12px_rgba(28,25,23,0.14)]'
          : 'mix-blend-multiply'
      } ${className ?? ''}`}
    />
  )
}

/** Faint body outline so the pieces read as "worn" rather than floating. */
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
