import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteItem, getItem, imageUrl, setLaundry, updateItem, uploadImage } from '../lib/db'
import { extractColors } from '../lib/colors'
import { removeBackground, trimTransparent } from '../lib/images'
import {
  CATEGORIES, SUBCATEGORIES, SEASONS, DEFAULT_OCCASIONS, FABRICS,
  type Category, type Item, type ItemColor, type LaundryStatus,
} from '../lib/taxonomy'
import { loadProfile } from '../lib/profileDb'
import StorageImg from '../components/StorageImg'
import WoreButton from '../components/WoreButton'
import ColorPicker from '../components/ColorPicker'
import { todayISO } from '../lib/wear'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<Item | null>(null)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Item | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickingColor, setPickingColor] = useState<number | null>(null)
  const [redetecting, setRedetecting] = useState(false)
  const [recutting, setRecutting] = useState<string | null>(null)
  const [customOccasions, setCustomOccasions] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    getItem(id).then((it) => (it ? setItem(it) : setMissing(true)))
    loadProfile().then((p) => setCustomOccasions(p?.custom_occasions ?? []))
  }, [id])

  if (missing) return <p className="py-16 text-center text-sm text-ink-soft">Item not found.</p>
  if (!item) {
    return (
      <div className="mx-auto mt-6 max-w-lg animate-pulse px-4">
        <div className="aspect-square rounded-2xl bg-paper" />
      </div>
    )
  }

  const view = editing && draft ? draft : item
  const patch = (p: Partial<Item>) => setDraft((d) => (d ? { ...d, ...p } : d))

  function startEdit() {
    setDraft({ ...item! })
    setEditing(true)
    setPickingColor(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
    setPickingColor(null)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const patched: Partial<Item> = {
        name: draft.name.trim() || draft.subcategory,
        category: draft.category,
        subcategory: draft.subcategory,
        colors: draft.colors,
        // the engine reads primary_color, so it must follow the palette edit
        primary_color: draft.colors?.[0]?.name ?? '',
        seasons: draft.seasons,
        occasions: draft.occasions,
        fabric: draft.fabric,
      }
      await updateItem(draft.id, patched)
      setItem({ ...draft, ...patched } as Item)
      setEditing(false)
      setDraft(null)
    } catch (e) {
      alert(`Could not save: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Cut the background out of an item that never got one — those render as a
   * solid rectangle over the body in outfit previews.
   */
  async function recut() {
    if (!draft) return
    setRecutting('Loading AI model…')
    try {
      const url = await imageUrl(draft.photo_path)
      if (!url) throw new Error('image unavailable')
      const photo = await (await fetch(url)).blob()
      const cut = await trimTransparent(await removeBackground(photo, setRecutting))
      const cutout_path = await uploadImage(cut, 'cutout')
      const colors = await extractColors(cut, 4, true)
      await updateItem(draft.id, {
        cutout_path,
        colors,
        primary_color: colors[0]?.name ?? draft.primary_color,
      })
      const next = { ...draft, cutout_path, colors, primary_color: colors[0]?.name ?? '' }
      setDraft(next)
      setItem(next)
    } catch {
      alert('Could not remove the background from that photo.')
    } finally {
      setRecutting(null)
    }
  }

  /** Re-run detection on the stored image — useful after a bad first read. */
  async function redetect() {
    if (!draft) return
    setRedetecting(true)
    try {
      const path = draft.cutout_path ?? draft.photo_path
      const url = await imageUrl(path)
      if (!url) throw new Error('image unavailable')
      const blob = await (await fetch(url)).blob()
      const colors = await extractColors(blob, 4, Boolean(draft.cutout_path))
      if (colors.length) patch({ colors })
    } catch {
      alert('Could not re-read the colours from that image.')
    } finally {
      setRedetecting(false)
    }
  }

  async function cycleLaundry() {
    if (!item || editing) return
    const next: Record<LaundryStatus, LaundryStatus> = {
      clean: 'dirty', dirty: 'washing', washing: 'clean',
    }
    const status = next[item.laundry_status]
    setItem({ ...item, laundry_status: status })
    await setLaundry(item.id, status)
  }

  async function remove() {
    if (!item) return
    if (!confirm(`Delete "${item.name}" from your closet?`)) return
    await deleteItem(item)
    navigate('/')
  }

  const laundryUi: Record<LaundryStatus, { label: string; cls: string }> = {
    clean: { label: '✓ Clean — tap if worn out', cls: 'bg-sage/15 text-sage' },
    dirty: { label: '🧺 In laundry — tap when washing', cls: 'bg-clay/15 text-clay' },
    washing: { label: '💧 Washing — tap when clean', cls: 'bg-bronze/15 text-bronze-deep' },
  }

  const occasionOptions = [...DEFAULT_OCCASIONS, ...customOccasions]

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => (editing ? cancelEdit() : navigate(-1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-lg"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-light italic">
            {editing ? 'Edit piece' : view.name}
          </h1>
          {!editing && (
            <p className="text-xs text-ink-faint">{view.subcategory} · {view.fabric}</p>
          )}
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="shrink-0 rounded-full bg-paper px-4 py-1.5 text-xs font-medium text-ink-soft"
          >
            Edit
          </button>
        )}
      </header>

      <div className="cutout-bg mb-2 overflow-hidden rounded-2xl shadow-card">
        <StorageImg
          path={view.cutout_path ?? view.photo_path}
          alt={view.name}
          className={`aspect-square w-full ${view.cutout_path ? 'object-contain p-5' : 'object-cover'}`}
        />
      </div>

      {/* Without a cutout this piece shows as a solid rectangle over the body
          in outfit previews — worth offering the fix wherever it's noticed. */}
      {!view.cutout_path && (
        <button
          onClick={recut}
          disabled={recutting !== null}
          className="mb-4 w-full rounded-2xl bg-clay/10 py-3 text-xs font-semibold text-clay disabled:opacity-60"
        >
          {recutting ?? '✂ Remove the background from this photo'}
        </button>
      )}
      {view.cutout_path && <div className="mb-2" />}

      {!editing && (
        <>
          <WoreButton
            items={[item]}
            className="mb-2 w-full"
            onDone={() =>
              setItem((it) =>
                it ? { ...it, times_worn: (it.times_worn ?? 0) + 1, last_worn: todayISO() } : it,
              )
            }
          />
          <button
            onClick={cycleLaundry}
            className={`mb-5 w-full rounded-2xl py-3.5 text-sm font-semibold ${laundryUi[item.laundry_status].cls}`}
          >
            {laundryUi[item.laundry_status].label}
          </button>
        </>
      )}

      {/* ---------- palette ---------- */}
      <section className="mb-5 rounded-2xl bg-white p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
            Palette
          </p>
          {editing && (
            <button
              onClick={redetect}
              disabled={redetecting}
              className="text-xs font-medium text-bronze-deep disabled:opacity-50"
            >
              {redetecting ? 'reading…' : 're-detect'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          {(view.colors ?? []).map((c, i) => (
            <button
              key={i}
              disabled={!editing}
              onClick={() => setPickingColor(pickingColor === i ? null : i)}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`h-10 w-10 rounded-full border-2 shadow-card ${
                  editing && pickingColor === i ? 'border-ink' : 'border-white'
                }`}
                style={{ background: c.hex }}
              />
              <span className="text-[11px] text-ink-soft">{c.name}</span>
              <span className="text-[10px] text-ink-faint">{Math.round(c.ratio * 100)}%</span>
            </button>
          ))}
          {(view.colors ?? []).length === 0 && (
            <p className="text-xs text-ink-faint">No colours detected.</p>
          )}
        </div>

        {editing && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            The first colour is the one outfit matching uses. Tap a swatch to correct it.
          </p>
        )}

        {editing && pickingColor !== null && (
          <ColorPicker
            current={view.colors?.[pickingColor]?.name ?? ''}
            onClose={() => setPickingColor(null)}
            onPick={(picked) => {
              const next: ItemColor[] = (draft?.colors ?? []).map((c, i) =>
                i === pickingColor ? { ...c, hex: picked.hex, name: picked.name } : c,
              )
              patch({ colors: next })
              setPickingColor(null)
            }}
          />
        )}
      </section>

      {/* ---------- details ---------- */}
      {editing && draft ? (
        <div className="mb-6 flex flex-col gap-4">
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full rounded-xl border border-linen bg-white px-4 py-2.5 text-sm outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Category">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    patch({ category: c.id as Category, subcategory: SUBCATEGORIES[c.id][0] })
                  }
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
                    draft.category === c.id ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Type">
            <Pills
              options={SUBCATEGORIES[draft.category]}
              selected={[draft.subcategory]}
              onPick={(v) => patch({ subcategory: v })}
            />
          </Field>

          <Field label="Occasions">
            <Pills
              options={occasionOptions}
              selected={draft.occasions ?? []}
              onPick={(v) =>
                patch({
                  occasions: draft.occasions?.includes(v)
                    ? draft.occasions.filter((x) => x !== v)
                    : [...(draft.occasions ?? []), v],
                })
              }
            />
          </Field>

          <Field label="Season">
            <Pills
              options={[...SEASONS]}
              selected={draft.seasons ?? []}
              onPick={(v) =>
                patch({
                  seasons: draft.seasons?.includes(v)
                    ? draft.seasons.filter((x) => x !== v)
                    : [...(draft.seasons ?? []), v],
                })
              }
            />
          </Field>

          <Field label="Fabric">
            <Pills
              options={[...FABRICS]}
              selected={[draft.fabric]}
              onPick={(v) => patch({ fabric: v })}
            />
          </Field>

          <div className="mt-1 flex gap-3">
            <button
              onClick={cancelEdit}
              className="flex-1 rounded-2xl border border-linen bg-white py-3.5 text-sm font-semibold text-ink-soft"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-ivory shadow-float disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <section className="mb-5 grid grid-cols-2 gap-3 text-sm">
          <InfoCard label="Occasions" value={view.occasions?.join(', ') || '—'} />
          <InfoCard label="Season" value={view.seasons?.join(', ') || '—'} />
          <InfoCard label="Times worn" value={String(view.times_worn ?? 0)} />
          <InfoCard label="Last worn" value={view.last_worn ?? 'Never'} />
        </section>
      )}

      {!editing && (
        <button onClick={remove} className="mb-10 w-full py-2 text-center text-xs font-medium text-danger">
          Delete item
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function Pills({
  options, selected, onPick,
}: {
  options: string[]
  selected: string[]
  onPick: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            selected.includes(o) ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-card">
      <p className="text-[10px] font-semibold tracking-[0.15em] text-ink-faint uppercase">{label}</p>
      <p className="mt-1 text-[13px] font-medium">{value}</p>
    </div>
  )
}
