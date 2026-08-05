import { useRef, useState, type ReactNode } from 'react'

/**
 * Tinder-style swipeable card. Follows the finger, tilts as it goes, shows the
 * verdict it's about to commit to, and flies off once you're past the point of
 * no return. Under the threshold it springs back, so a hesitant drag is never
 * read as a decision.
 */
export default function SwipeCard({
  children,
  onSwipe,
  disabled = false,
}: {
  children: ReactNode
  onSwipe: (liked: boolean) => void
  disabled?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [flying, setFlying] = useState<'left' | 'right' | null>(null)
  const startX = useRef(0)
  const dragging = useRef(false)
  const width = useRef(320)

  // how far you have to pull before releasing counts as a verdict
  const threshold = () => Math.min(120, width.current * 0.28)

  function down(e: React.PointerEvent) {
    if (disabled || flying) return
    dragging.current = true
    startX.current = e.clientX
    width.current = e.currentTarget.clientWidth || 320
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent) {
    if (!dragging.current) return
    setDx(e.clientX - startX.current)
  }

  function up() {
    if (!dragging.current) return
    dragging.current = false
    const liked = dx > 0
    if (Math.abs(dx) >= threshold()) {
      setFlying(liked ? 'right' : 'left')
      // let the card clear the screen before the next one mounts
      setTimeout(() => {
        onSwipe(liked)
        setFlying(null)
        setDx(0)
      }, 220)
    } else {
      setDx(0)
    }
  }

  const settled = !dragging.current
  const offset = flying ? (flying === 'right' ? width.current * 1.6 : -width.current * 1.6) : dx
  const rotation = offset * 0.045
  const strength = Math.min(1, Math.abs(dx) / threshold())

  return (
    <div className="relative touch-pan-y select-none">
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          transform: `translateX(${offset}px) rotate(${rotation}deg)`,
          transition: settled ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          opacity: flying ? 0 : 1,
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        {children}

        {/* verdict stamps — they fade in as you commit */}
        <Stamp side="right" label="Love it" strength={dx > 0 ? strength : 0} />
        <Stamp side="left" label="Not for me" strength={dx < 0 ? strength : 0} />
      </div>
    </div>
  )
}

function Stamp({
  side, label, strength,
}: {
  side: 'left' | 'right'
  label: string
  strength: number
}) {
  const liked = side === 'right'
  return (
    <div
      aria-hidden="true"
      style={{ opacity: strength, transform: `rotate(${liked ? -12 : 12}deg) scale(${0.9 + strength * 0.1})` }}
      className={`pointer-events-none absolute top-6 ${
        liked ? 'left-5' : 'right-5'
      } rounded-xl border-[3px] px-3 py-1.5 text-sm font-bold tracking-widest uppercase ${
        liked ? 'border-sage text-sage' : 'border-clay text-clay'
      }`}
    >
      {label}
    </div>
  )
}
