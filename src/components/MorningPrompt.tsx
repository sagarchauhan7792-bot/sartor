import { useEffect, useState } from 'react'
import { listWearLogs, logWear, deleteWearLog, todayISO, type WearLog } from '../lib/wear'
import type { Item } from '../lib/taxonomy'
import StorageImg from './StorageImg'

const DISMISS_KEY = 'sartor.morningPromptDismissed'

/**
 * Nobody remembers to log what they wore, and every insight in the app depends
 * on that data. So when yesterday had a *plan*, ask once — one tap to confirm
 * it actually happened. Not a notification; just something that's here when you
 * open the app anyway.
 */
export default function MorningPrompt({ items }: { items: Item[] }) {
  const [plan, setPlan] = useState<WearLog | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const today = todayISO()
    if (localStorage.getItem(DISMISS_KEY) === today) return

    listWearLogs(60)
      .then((logs) => {
        // a plan dated in the past that was never turned into a wear
        const stale = logs.find((l) => l.note === 'planned' && l.worn_on < today)
        if (stale) setPlan(stale)
      })
      .catch(() => {})
  }, [])

  if (!plan || done) return null

  const pieces = plan.item_ids
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as Item[]
  if (pieces.length === 0) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, todayISO())
    setDone(true)
  }

  async function confirm() {
    if (!plan) return
    try {
      // the plan becomes a real wear, and stops being a plan
      await logWear(pieces, { date: plan.worn_on })
      await deleteWearLog(plan.id)
    } catch { /* asking again tomorrow is harmless */ }
    dismiss()
  }

  const when = new Date(plan.worn_on + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
  })

  return (
    <div className="fade-up mb-4 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-sm leading-relaxed">
        You planned this for <span className="font-medium">{when}</span>. Did you wear it?
      </p>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {pieces.map((p) => (
          <div key={p.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-paper">
            <StorageImg
              path={p.cutout_path ?? p.photo_path}
              alt={p.name}
              className="h-full w-full object-contain p-0.5"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={dismiss}
          className="flex-1 rounded-xl border border-linen py-2.5 text-xs font-semibold text-ink-soft"
        >
          No, I wore something else
        </button>
        <button
          onClick={confirm}
          className="flex-1 rounded-xl bg-ink py-2.5 text-xs font-semibold text-ivory"
        >
          Yes, log it
        </button>
      </div>
    </div>
  )
}
