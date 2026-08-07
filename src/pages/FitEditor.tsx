import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listItems, uploadImage } from '../lib/db'
import { loadProfile, saveProfile } from '../lib/profileDb'
import { compressPhoto } from '../lib/images'
import {
  DEFAULT_FIT, resolveFit, SLOT_LABELS, type FitSettings,
} from '../lib/fit'
import type { Category, Item } from '../lib/taxonomy'
import OutfitCollage from '../components/OutfitCollage'

export default function FitEditor() {
  const navigate = useNavigate()
  const bodyRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [fit, setFit] = useState<FitSettings>(DEFAULT_FIT)
  const [bodyPath, setBodyPath] = useState<string | null>(null)
  const [slot, setSlot] = useState<Category>('top')
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([loadProfile(), listItems()]).then(([p, its]) => {
      setFit(resolveFit(p?.fit))
      setBodyPath(p?.body_path ?? null)
      setItems(its)
    })
  }, [])

  /** One representative garment per slot, so the preview shows real clothes. */
  const sample = useMemo(() => {
    const picked: Item[] = []
    for (const s of SLOT_LABELS) {
      const found = items.find((i) => i.category === s.id)
      if (found) picked.push(found)
    }
    return picked
  }, [items])

  async function onBody(files: FileList | null) {
    if (!files?.[0]) return
    setBusy('Saving your photo…')
    try {
      const compressed = await compressPhoto(files[0], 1200)
      const path = await uploadImage(compressed, 'photo')
      await saveProfile({ body_path: path })
      setBodyPath(path)
    } catch (e) {
      alert(`Could not save that photo: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  async function persist(next: FitSettings) {
    setFit(next)
    setSaved(false)
    await saveProfile({ fit: next })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const current = fit[slot]
  const update = (patch: Partial<typeof current>) =>
    persist({ ...fit, [slot]: { ...current, ...patch } })

  const hasSlotItem = sample.some((i) => i.category === slot)

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-lg"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-light italic">Fit</h1>
          <p className="text-xs text-ink-faint">
            {saved ? 'Saved' : 'How clothes sit on you in previews'}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-soft">
          Add a few clothes first — then you can line them up against your own photo.
        </p>
      ) : (
        <>
          <OutfitCollage items={sample} fit={fit} bodyPath={bodyPath} ghost />

          <button
            onClick={() => bodyRef.current?.click()}
            disabled={busy !== null}
            className="mt-3 w-full rounded-2xl border border-linen bg-white py-3 text-xs font-semibold tracking-widest text-ink uppercase shadow-card disabled:opacity-50"
          >
            {busy ?? (bodyPath ? '📷 Change my photo' : '📷 Use a photo of me')}
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-faint">
            A full-length photo, standing straight, works best. It stays private in your own
            closet and is only used to preview outfits.
          </p>

          {/* which slot you're adjusting */}
          <div className="no-scrollbar -mx-4 mt-5 mb-3 flex gap-2 overflow-x-auto px-4">
            {SLOT_LABELS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSlot(s.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
                  slot === s.id ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {!hasSlotItem && (
            <p className="mb-3 text-center text-xs text-ink-faint">
              Nothing in your closet for this slot yet — the sliders still apply.
            </p>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-card">
            <Slider
              label="Height on body"
              value={current.top}
              min={0.05}
              max={0.97}
              onChange={(top) => update({ top })}
            />
            <Slider
              label="Size"
              value={current.height}
              min={0.05}
              max={0.6}
              onChange={(height) => update({ height })}
            />
            <Slider
              label="Width"
              value={current.width}
              min={0.08}
              max={0.95}
              onChange={(width) => update({ width })}
            />
          </div>

          <button
            onClick={() => persist(DEFAULT_FIT)}
            className="mt-4 w-full py-2 text-center text-xs font-medium text-ink-soft underline"
          >
            Reset to defaults
          </button>
        </>
      )}

      <input ref={bodyRef} type="file" accept="image/*" hidden onChange={(e) => onBody(e.target.files)} />
    </div>
  )
}

function Slider({
  label, value, min, max, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
        {label}
        <span className="tabular-nums normal-case tracking-normal">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.005}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-ink)]"
      />
    </label>
  )
}
