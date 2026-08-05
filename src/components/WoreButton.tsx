import { useState } from 'react'
import { logWear } from '../lib/wear'
import type { Item } from '../lib/taxonomy'

/**
 * Records a wear. Optionally sends the pieces to the laundry at the same time,
 * which is what you usually want after actually wearing something.
 */
export default function WoreButton({
  items,
  outfitId,
  label = 'Wore this today',
  onDone,
  className = '',
}: {
  items: Item[]
  outfitId?: string | null
  label?: string
  onDone?: () => void
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function go() {
    if (items.length === 0 || state === 'saving') return
    setState('saving')
    try {
      await logWear(items, { outfitId })
      setState('done')
      onDone?.()
    } catch {
      setState('error')
    }
  }

  return (
    <button
      onClick={go}
      disabled={state === 'saving' || state === 'done'}
      className={`rounded-2xl py-3.5 text-sm font-semibold transition disabled:opacity-70 ${
        state === 'done'
          ? 'bg-sage/15 text-sage'
          : 'bg-ink text-ivory shadow-float'
      } ${className}`}
    >
      {state === 'saving' && '…'}
      {state === 'done' && '✓ Logged'}
      {state === 'error' && 'Could not log — tap to retry'}
      {state === 'idle' && `✓ ${label}`}
    </button>
  )
}
