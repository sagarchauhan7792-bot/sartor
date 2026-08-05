import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/db'
import {
  listSavedOutfits, deleteSavedOutfit, saveOutfit,
  loadProfile, toColorProfile, weightsOf, type SavedOutfit, type SartorProfile,
} from '../lib/profileDb'
import { scoreOutfit } from '../lib/outfit'
import { CATEGORIES, DEFAULT_OCCASIONS, type Category, type Item } from '../lib/taxonomy'
import OutfitCollage from '../components/OutfitCollage'
import StorageImg from '../components/StorageImg'
import WoreButton from '../components/WoreButton'
import InspoBoard from '../components/InspoBoard'

export default function Lookbook() {
  const [tab, setTab] = useState<'saved' | 'build' | 'inspo'>('saved')
  const [items, setItems] = useState<Item[]>([])
  const [outfits, setOutfits] = useState<SavedOutfit[]>([])
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listItems(), listSavedOutfits(), loadProfile()])
      .then(([its, outs, prof]) => {
        setItems(its); setOutfits(outs); setProfile(prof)
      })
      .finally(() => setLoading(false))
  }, [])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-light italic">Lookbook</h1>
        <Link to="/calendar" className="shrink-0 pb-1.5 text-xs font-medium text-bronze-deep">
          ▦ Calendar
        </Link>
      </header>

      <div className="no-scrollbar -mx-4 mt-4 mb-5 flex gap-2 overflow-x-auto px-4">
        <Tab active={tab === 'saved'} onClick={() => setTab('saved')} label={`Saved (${outfits.length})`} />
        <Tab active={tab === 'build'} onClick={() => setTab('build')} label="Build a look" />
        <Tab active={tab === 'inspo'} onClick={() => setTab('inspo')} label="Inspiration" />
      </div>

      {tab === 'saved' && (
        <>
          {loading && <div className="aspect-[3/4] animate-pulse rounded-2xl bg-paper" />}
          {!loading && outfits.length === 0 && (
            <div className="mt-12 text-center">
              <p className="font-display text-2xl italic text-ink-soft">No looks saved yet.</p>
              <p className="mx-auto mt-2 max-w-64 text-sm text-ink-faint">
                Save outfits from Dress me, or build one yourself here.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-6">
            {outfits.map((o) => {
              const its = o.item_ids.map((id) => byId.get(id)).filter(Boolean) as Item[]
              if (its.length === 0) return null
              return (
                <div key={o.id} className="fade-up">
                  <OutfitCollage items={its} />
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      <p className="text-[11px] text-ink-faint">
                        {o.occasion} · {its.length} pieces
                        {o.score != null && ` · ${o.score} match`}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove "${o.name}" from your lookbook?`)) return
                        await deleteSavedOutfit(o.id)
                        setOutfits((list) => list.filter((x) => x.id !== o.id))
                      }}
                      className="shrink-0 text-xs text-danger"
                    >
                      Remove
                    </button>
                  </div>
                  <WoreButton items={its} outfitId={o.id} className="mt-2 w-full" />
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'build' && (
        <Builder
          items={items}
          profile={profile}
          onSaved={(o) => setOutfits((list) => [o, ...list])}
        />
      )}

      {tab === 'inspo' && <InspoBoard items={items} />}
    </div>
  )
}

function Builder({
  items, profile, onSaved,
}: {
  items: Item[]
  profile: SartorProfile | null
  onSaved: (o: SavedOutfit) => void
}) {
  const [picked, setPicked] = useState<Partial<Record<Category, Item>>>({})
  const [occasion, setOccasion] = useState('Casual')
  const [open, setOpen] = useState<Category | null>('top')
  const [saving, setSaving] = useState(false)

  const chosen = Object.values(picked).filter(Boolean) as Item[]
  const scored = chosen.length >= 2
    ? scoreOutfit(chosen, occasion, toColorProfile(profile), weightsOf(profile))
    : null

  const occasions = [...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])]

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {occasions.map((o) => (
          <button
            key={o}
            onClick={() => setOccasion(o)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
              occasion === o ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {chosen.length > 0 && <OutfitCollage items={chosen} />}

      {scored && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
              Harmony
            </p>
            <p className={`font-display text-2xl leading-none ${
              scored.score >= 80 ? 'text-sage' : scored.score >= 65 ? 'text-bronze-deep' : 'text-clay'
            }`}>
              {scored.score}
            </p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{scored.colorReason}</p>
          {scored.styleNotes.map((n, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">— {n}</p>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {CATEGORIES.map((cat) => {
          const options = items.filter((i) => i.category === cat.id)
          const sel = picked[cat.id]
          return (
            <div key={cat.id} className="rounded-2xl bg-white p-3 shadow-card">
              <button
                onClick={() => setOpen(open === cat.id ? null : cat.id)}
                className="flex w-full items-center justify-between"
              >
                <span className="text-sm font-medium">
                  {cat.emoji} {cat.label}
                  {sel && <span className="ml-2 text-xs text-ink-faint">{sel.name}</span>}
                </span>
                <span className="text-ink-faint">{open === cat.id ? '−' : '+'}</span>
              </button>

              {open === cat.id && (
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                  {options.length === 0 && (
                    <p className="py-3 text-xs text-ink-faint">Nothing in this category yet.</p>
                  )}
                  {sel && (
                    <button
                      onClick={() => setPicked((p) => ({ ...p, [cat.id]: undefined }))}
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-paper text-xs text-ink-soft"
                    >
                      Clear
                    </button>
                  )}
                  {options.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => setPicked((p) => ({ ...p, [cat.id]: it }))}
                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        sel?.id === it.id ? 'border-bronze' : 'border-transparent bg-paper'
                      }`}
                    >
                      <StorageImg
                        path={it.cutout_path ?? it.photo_path}
                        alt={it.name}
                        className="h-full w-full object-contain p-1"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        disabled={chosen.length < 2 || saving}
        onClick={async () => {
          if (!scored) return
          setSaving(true)
          const name = `${occasion} — ${chosen[0].name}`
          try {
            await saveOutfit({ name, occasion, items: chosen, score: scored.score, source: 'manual' })
            onSaved({
              id: crypto.randomUUID(), name, occasion,
              item_ids: chosen.map((i) => i.id), score: scored.score,
              source: 'manual', created_at: new Date().toISOString(),
            })
            setPicked({})
          } finally {
            setSaving(false)
          }
        }}
        className="mt-5 mb-6 w-full rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-40"
      >
        {saving ? 'Saving…' : '♡ Save this look'}
      </button>
    </div>
  )
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition ${
        active ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
      }`}
    >
      {label}
    </button>
  )
}
