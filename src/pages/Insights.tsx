import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/db'
import { loadProfile, toColorProfile, type SartorProfile } from '../lib/profileDb'
import { findGaps, currentSeason } from '../lib/outfit'
import { isNeutral } from '../lib/harmony'
import { CATEGORIES, DEFAULT_OCCASIONS, type Item } from '../lib/taxonomy'
import StorageImg from '../components/StorageImg'

const DAY = 24 * 60 * 60 * 1000

export default function Insights() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gapOccasion, setGapOccasion] = useState<string>('Casual')

  useEffect(() => {
    Promise.all([listItems(), loadProfile()])
      .then(([its, p]) => { setItems(its); setProfile(p) })
      .catch((e) => setError(e.message))
  }, [])

  const stats = useMemo(() => {
    if (!items || items.length === 0) return null

    // colour palette across the wardrobe
    const colorMap = new Map<string, { hex: string; count: number }>()
    for (const it of items) {
      const c = it.colors?.[0]
      if (!c) continue
      const prev = colorMap.get(c.name)
      colorMap.set(c.name, { hex: c.hex, count: (prev?.count ?? 0) + 1 })
    }
    const palette = [...colorMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)

    const neutralCount = items.filter((i) => isNeutral(i.colors?.[0]?.name ?? '')).length

    const byCategory = CATEGORIES.map((c) => ({
      ...c,
      count: items.filter((i) => i.category === c.id).length,
    }))

    const worn = [...items].sort((a, b) => (b.times_worn ?? 0) - (a.times_worn ?? 0))
    const mostWorn = worn.filter((i) => (i.times_worn ?? 0) > 0).slice(0, 5)
    const neverWorn = items.filter((i) => (i.times_worn ?? 0) === 0)

    const now = Date.now()
    const stale = items.filter((i) => {
      if ((i.times_worn ?? 0) === 0) {
        // never worn, and it's been in the closet a while
        return now - new Date(i.created_at).getTime() > 180 * DAY
      }
      return i.last_worn ? now - new Date(i.last_worn).getTime() > 180 * DAY : false
    })

    const totalWears = items.reduce((s, i) => s + (i.times_worn ?? 0), 0)

    return { palette, neutralCount, byCategory, mostWorn, neverWorn, stale, totalWears }
  }, [items])

  const gaps = useMemo(() => {
    if (!items || items.length < 4) return []
    try {
      return findGaps(items, toColorProfile(profile), gapOccasion)
    } catch {
      return []
    }
  }, [items, profile, gapOccasion])

  if (error) return <Wrap><p className="py-16 text-center text-sm text-danger">{error}</p></Wrap>
  if (!items) return <Wrap><div className="mt-6 h-40 animate-pulse rounded-2xl bg-paper" /></Wrap>

  if (items.length === 0) {
    return (
      <Wrap>
        <Header />
        <div className="mt-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">Nothing to analyse yet.</p>
          <p className="mx-auto mt-2 max-w-64 text-sm text-ink-faint">
            Add a few pieces and this fills with your wardrobe's colour balance, what you
            actually wear, and what's missing.
          </p>
        </div>
      </Wrap>
    )
  }

  const s = stats!
  const maxCat = Math.max(...s.byCategory.map((c) => c.count), 1)

  return (
    <Wrap>
      <Header />
      <Link
        to="/buy"
        className="mb-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-ivory shadow-float"
      >
        <span className="text-sm font-semibold">Thinking of buying something?</span>
        <span className="text-xs opacity-80">Check it ›</span>
      </Link>
      <p className="mb-5 text-xs text-ink-faint">
        {items.length} pieces · {s.totalWears} wears logged · {currentSeason().toLowerCase()} right now
      </p>

      {/* ---------- palette ---------- */}
      <Card title="Your palette">
        <div className="flex h-8 w-full overflow-hidden rounded-full">
          {s.palette.map((c) => (
            <div
              key={c.name}
              title={`${c.name} — ${c.count}`}
              style={{ background: c.hex, width: `${(c.count / items.length) * 100}%` }}
            />
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {s.palette[0] && (
            <>
              <span className="font-medium text-ink">{s.palette[0].name}</span> leads your
              wardrobe ({s.palette[0].count} {s.palette[0].count === 1 ? 'piece' : 'pieces'}).{' '}
            </>
          )}
          {Math.round((s.neutralCount / items.length) * 100)}% of your closet is neutral
          {s.neutralCount / items.length > 0.85
            ? ' — very safe, but one strong colour would give you far more range.'
            : s.neutralCount / items.length < 0.35
              ? ' — you own a lot of colour, which makes combinations harder. Neutrals do the connecting work.'
              : ' — a healthy balance between safe and interesting.'}
        </p>
      </Card>

      {/* ---------- category balance ---------- */}
      <Card title="Balance">
        <div className="flex flex-col gap-2">
          {s.byCategory.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-ink-soft">{c.emoji} {c.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-bronze"
                  style={{ width: `${(c.count / maxCat) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-faint">
                {c.count}
              </span>
            </div>
          ))}
        </div>
        {(() => {
          const tops = s.byCategory.find((c) => c.id === 'top')!.count
          const bottoms = s.byCategory.find((c) => c.id === 'bottom')!.count
          if (bottoms === 0) return <Note>You have no bottoms yet — nothing can be built into a full outfit.</Note>
          if (tops / bottoms > 3) {
            return <Note>You own {tops} tops to {bottoms} {bottoms === 1 ? 'bottom' : 'bottoms'}. Another bottom multiplies your outfits far more than another top would.</Note>
          }
          if (bottoms > tops) {
            return <Note>More bottoms than tops — a couple of versatile tops would even this out.</Note>
          }
          return null
        })()}
      </Card>

      {/* ---------- gaps ---------- */}
      <Card title="What's missing">
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">
          One purchase, ranked by how many new outfits it would create from what you already own.
        </p>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
          {[...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])].map((o) => (
            <button
              key={o}
              onClick={() => setGapOccasion(o)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                gapOccasion === o ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        {gaps.length === 0 ? (
          <p className="py-2 text-sm text-ink-faint">
            Nothing obvious missing for {gapOccasion.toLowerCase()} — or too few pieces to tell yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {gaps.map((g) => (
              <div key={g.suggestion} className="flex items-center justify-between rounded-xl bg-paper px-3.5 py-2.5">
                <span className="text-sm">{g.suggestion}</span>
                <span className="shrink-0 text-xs font-medium text-bronze-deep">
                  +{g.unlocks} outfits
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---------- most worn ---------- */}
      {s.mostWorn.length > 0 && (
        <Card title="Most worn">
          <ItemRow items={s.mostWorn} caption={(i) => `${i.times_worn} ${i.times_worn === 1 ? 'wear' : 'wears'}`} />
        </Card>
      )}

      {/* ---------- never worn ---------- */}
      {s.neverWorn.length > 0 && (
        <Card title={`Never worn (${s.neverWorn.length})`}>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            {s.totalWears === 0
              ? 'Start tapping "wore this today" and this section becomes the useful one.'
              : 'These are earning nothing. Try one in your next outfit.'}
          </p>
          <ItemRow items={s.neverWorn.slice(0, 8)} caption={() => 'unworn'} />
        </Card>
      )}

      {/* ---------- declutter ---------- */}
      {s.stale.length > 0 && (
        <Card title="Consider letting go">
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            Untouched for more than six months. If you didn't reach for it in half a year,
            it's probably taking up space rather than earning it.
          </p>
          <ItemRow items={s.stale.slice(0, 8)} caption={(i) => (i.last_worn ? `last ${i.last_worn}` : 'never worn')} />
        </Card>
      )}

      <div className="h-6" />
    </Wrap>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>
}

function Header() {
  return <h1 className="font-display text-4xl font-light italic">Insights</h1>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-5 shadow-card">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
        {title}
      </p>
      {children}
    </section>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</p>
}

function ItemRow({ items, caption }: { items: Item[]; caption: (i: Item) => string }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <Link key={i.id} to={`/item/${i.id}`} className="w-20 shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-xl bg-paper">
            <StorageImg
              path={i.cutout_path ?? i.photo_path}
              alt={i.name}
              className="h-full w-full object-contain p-1"
            />
          </div>
          <p className="mt-1 truncate text-[11px] font-medium">{i.name}</p>
          <p className="truncate text-[10px] text-ink-faint">{caption(i)}</p>
        </Link>
      ))}
    </div>
  )
}
