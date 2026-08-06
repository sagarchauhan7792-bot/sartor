import { NAMED_COLORS } from '../lib/colors'

/**
 * Correct a detected colour by picking from the same vocabulary the engine
 * reasons about — so a fix here actually changes how outfits are scored,
 * rather than only relabelling what you see.
 */
export default function ColorPicker({
  current,
  onPick,
  onClose,
}: {
  current: string
  onPick: (c: { hex: string; name: string }) => void
  onClose: () => void
}) {
  return (
    <div className="mt-3 rounded-xl bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
          Correct to
        </p>
        <button onClick={onClose} className="text-xs text-ink-soft">cancel</button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {NAMED_COLORS.map((c) => (
          <button
            key={c.name}
            title={c.name}
            onClick={() => onPick({ hex: c.hex, name: c.name })}
            className={`aspect-square rounded-lg border-2 transition ${
              c.name === current ? 'border-ink scale-105' : 'border-white'
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
    </div>
  )
}
