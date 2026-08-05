import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/db'
import { CATEGORIES, type Category, type Item } from '../lib/taxonomy'
import StorageImg from '../components/StorageImg'

export default function Closet() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<string | null>(null)

  useEffect(() => {
    listItems().then(setItems).catch((e) => setError(e.message))
  }, [])

  const colorNames = useMemo(() => {
    const counts = new Map<string, { hex: string; n: number }>()
    for (const it of items ?? []) {
      const c = it.colors?.[0]
      if (c) {
        const prev = counts.get(c.name)
        counts.set(c.name, { hex: c.hex, n: (prev?.n ?? 0) + 1 })
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10)
  }, [items])

  const visible = useMemo(() => {
    let list = items ?? []
    if (cat !== 'all') list = list.filter((i) => i.category === cat)
    if (colorFilter) list = list.filter((i) => i.colors?.some((c) => c.name === colorFilter))
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.subcategory.toLowerCase().includes(q) ||
          i.colors?.some((c) => c.name.toLowerCase().includes(q)) ||
          i.occasions?.some((o) => o.toLowerCase().includes(q)),
      )
    }
    return list
  }, [items, cat, query, colorFilter])

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-light italic">Closet</h1>
          <p className="mt-1 text-xs text-ink-faint">
            {items ? `${items.length} pieces` : 'Loading…'}
          </p>
        </div>
      </header>

      <input
        type="search"
        placeholder="Search name, colour, occasion…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 w-full rounded-xl border border-linen bg-white px-4 py-2.5 text-sm outline-none focus:border-bronze"
      />

      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={cat === 'all'} onClick={() => setCat('all')} label="All" />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.label} />
        ))}
      </div>

      {colorNames.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 py-1">
          {colorNames.map(([name, { hex }]) => (
            <button
              key={name}
              onClick={() => setColorFilter(colorFilter === name ? null : name)}
              title={name}
              className={`h-6 w-6 shrink-0 rounded-full border-2 transition ${
                colorFilter === name ? 'scale-110 border-bronze' : 'border-white shadow-card'
              }`}
              style={{ background: hex }}
            />
          ))}
          {colorFilter && (
            <button onClick={() => setColorFilter(null)} className="text-xs text-ink-soft underline">
              clear
            </button>
          )}
        </div>
      )}

      {error && <p className="py-8 text-center text-sm text-danger">{error}</p>}

      {items && items.length === 0 && (
        <div className="fade-up mt-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">An empty canvas.</p>
          <p className="mx-auto mt-2 max-w-60 text-sm text-ink-faint">
            Tap <span className="font-semibold text-ink">+</span> to add your first piece — snap it
            or pick from your gallery.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((item) => (
          <Link
            key={item.id}
            to={`/item/${item.id}`}
            className="fade-up overflow-hidden rounded-2xl bg-white shadow-card"
          >
            <div className="relative aspect-square">
              <StorageImg
                path={item.cutout_path ?? item.photo_path}
                alt={item.name}
                className={`h-full w-full object-contain ${item.cutout_path ? 'p-3' : 'object-cover'}`}
              />
              {item.laundry_status !== 'clean' && (
                <span className="absolute top-2 right-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-ivory">
                  {item.laundry_status === 'dirty' ? 'Laundry' : 'Washing'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{item.name}</p>
                <p className="truncate text-[11px] text-ink-faint">{item.subcategory}</p>
              </div>
              <div className="flex shrink-0 -space-x-1">
                {(item.colors ?? []).slice(0, 3).map((c, i) => (
                  <span
                    key={i}
                    className="h-3.5 w-3.5 rounded-full border border-white"
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide transition ${
        active ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
      }`}
    >
      {label}
    </button>
  )
}
