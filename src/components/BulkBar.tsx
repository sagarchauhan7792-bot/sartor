import { useState } from 'react'
import { updateItem } from '../lib/db'
import { DEFAULT_OCCASIONS, SEASONS, type Item, type LaundryStatus } from '../lib/taxonomy'

type Action = 'occasion' | 'season' | 'laundry' | 'archive' | null

/**
 * Acting on many items at once. Tagging fifty garments one at a time is the
 * kind of chore that stops a wardrobe ever being properly organised.
 */
export default function BulkBar({
  selected,
  onDone,
  onCancel,
}: {
  selected: Item[]
  onDone: () => void
  onCancel: () => void
}) {
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)

  async function applyToAll(patch: Partial<Item>) {
    setBusy(true)
    try {
      // sequential keeps it predictable against the rate limits of a free tier
      for (const item of selected) await updateItem(item.id, patch)
      onDone()
    } catch (e) {
      alert(`Could not update: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
      setAction(null)
    }
  }

  /** Add a tag without discarding whatever each item already had. */
  async function addTag(field: 'occasions' | 'seasons', value: string) {
    setBusy(true)
    try {
      for (const item of selected) {
        const existing = item[field] ?? []
        if (existing.includes(value)) continue
        await updateItem(item.id, { [field]: [...existing, value] } as Partial<Item>)
      }
      onDone()
    } finally {
      setBusy(false)
      setAction(null)
    }
  }

  const allArchived = selected.every((i) => i.archived)

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg rounded-2xl bg-ink p-3 text-ivory shadow-float">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {selected.length} selected
          </p>
          <button onClick={onCancel} className="text-xs opacity-70">Cancel</button>
        </div>

        {action === null && (
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            <Chip onClick={() => setAction('occasion')} label="Occasion" />
            <Chip onClick={() => setAction('season')} label="Season" />
            <Chip onClick={() => setAction('laundry')} label="Laundry" />
            <Chip
              onClick={() => applyToAll({ archived: !allArchived })}
              label={allArchived ? 'Unarchive' : 'Archive'}
            />
          </div>
        )}

        {action === 'occasion' && (
          <Options
            options={[...DEFAULT_OCCASIONS]}
            busy={busy}
            onPick={(v) => addTag('occasions', v)}
            onBack={() => setAction(null)}
          />
        )}
        {action === 'season' && (
          <Options
            options={[...SEASONS]}
            busy={busy}
            onPick={(v) => addTag('seasons', v)}
            onBack={() => setAction(null)}
          />
        )}
        {action === 'laundry' && (
          <Options
            options={['clean', 'dirty', 'washing']}
            busy={busy}
            onPick={(v) => applyToAll({ laundry_status: v as LaundryStatus })}
            onBack={() => setAction(null)}
          />
        )}

        {busy && <p className="mt-2 text-center text-xs opacity-70">Updating…</p>}
      </div>
    </div>
  )
}

function Chip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full bg-ivory/15 px-3.5 py-1.5 text-xs font-medium"
    >
      {label}
    </button>
  )
}

function Options({
  options, busy, onPick, onBack,
}: {
  options: string[]
  busy: boolean
  onPick: (v: string) => void
  onBack: () => void
}) {
  return (
    <div className="no-scrollbar mt-2 flex items-center gap-2 overflow-x-auto">
      <button onClick={onBack} className="shrink-0 text-xs opacity-70">‹</button>
      {options.map((o) => (
        <button
          key={o}
          disabled={busy}
          onClick={() => onPick(o)}
          className="shrink-0 rounded-full bg-ivory/15 px-3.5 py-1.5 text-xs font-medium capitalize disabled:opacity-50"
        >
          {o}
        </button>
      ))}
    </div>
  )
}
