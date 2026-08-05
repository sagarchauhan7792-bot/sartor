import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteItem, getItem, setLaundry } from '../lib/db'
import type { Item, LaundryStatus } from '../lib/taxonomy'
import StorageImg from '../components/StorageImg'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<Item | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!id) return
    getItem(id).then((it) => (it ? setItem(it) : setMissing(true)))
  }, [id])

  if (missing) return <p className="py-16 text-center text-sm text-ink-soft">Item not found.</p>
  if (!item) return <div className="mx-auto mt-6 max-w-lg animate-pulse px-4"><div className="aspect-square rounded-2xl bg-paper" /></div>

  async function cycleLaundry() {
    if (!item) return
    const next: Record<LaundryStatus, LaundryStatus> = { clean: 'dirty', dirty: 'washing', washing: 'clean' }
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

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg">‹</button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-light italic">{item.name}</h1>
          <p className="text-xs text-ink-faint">{item.subcategory} · {item.fabric}</p>
        </div>
      </header>

      <div className="cutout-bg mb-4 overflow-hidden rounded-2xl shadow-card">
        <StorageImg
          path={item.cutout_path ?? item.photo_path}
          alt={item.name}
          className={`aspect-square w-full ${item.cutout_path ? 'object-contain p-5' : 'object-cover'}`}
        />
      </div>

      <button
        onClick={cycleLaundry}
        className={`mb-5 w-full rounded-2xl py-3.5 text-sm font-semibold ${laundryUi[item.laundry_status].cls}`}
      >
        {laundryUi[item.laundry_status].label}
      </button>

      <section className="mb-5 rounded-2xl bg-white p-4 shadow-card">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">Palette</p>
        <div className="flex gap-4">
          {(item.colors ?? []).map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="h-10 w-10 rounded-full border-2 border-white shadow-card" style={{ background: c.hex }} />
              <span className="text-[11px] text-ink-soft">{c.name}</span>
              <span className="text-[10px] text-ink-faint">{Math.round(c.ratio * 100)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <InfoCard label="Occasions" value={item.occasions?.join(', ') || '—'} />
        <InfoCard label="Season" value={item.seasons?.join(', ') || '—'} />
        <InfoCard label="Times worn" value={String(item.times_worn ?? 0)} />
        <InfoCard label="Last worn" value={item.last_worn ?? 'Never'} />
      </section>

      <button onClick={remove} className="mb-10 w-full py-2 text-center text-xs font-medium text-danger">
        Delete item
      </button>
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
