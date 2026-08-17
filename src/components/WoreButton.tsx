import { useState } from 'react'
import { logWear } from '../lib/wear'
import { loadProfile, saveProfile, weightsOf } from '../lib/profileDb'
import { learnFromWear } from '../lib/outfit'
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
      // Wearing something is a preference signal in its own right, and a more
      // honest one than a swipe — but it should never block the log itself.
      try {
        const profile = await loadProfile()
        await saveProfile({ pref_weights: learnFromWear(weightsOf(profile), items) })
      } catch { /* the wear is recorded; the nudge is a bonus */ }
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
