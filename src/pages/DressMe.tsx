import { useCallback, useEffect, useMemo, useState } from 'react'
import { listItems } from '../lib/db'
import {
  loadProfile, saveProfile, toColorProfile, weightsOf,
  saveOutfit, recordRating, type SartorProfile,
} from '../lib/profileDb'
import { generateOutfits, learnFrom } from '../lib/outfit'
import { DEFAULT_OCCASIONS, type Item } from '../lib/taxonomy'
import OutfitCollage from '../components/OutfitCollage'
import WoreButton from '../components/WoreButton'
import TryOn from '../components/TryOn'

type Mode = 'dressme' | 'rate' | 'build'

export default function DressMe() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [occasion, setOccasion] = useState<string>('Casual')
  const [mode, setMode] = useState<Mode>('dressme')
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listItems(), loadProfile()])
      .then(([its, prof]) => { setItems(its); setProfile(prof) })
      .catch((e) => setError(e.message))
  }, [])

  const occasions = useMemo(
    () => [...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])],
    [profile],
  )

  const outfits = useMemo(() => {
    if (!items) return []
    return generateOutfits(items, {
      occasion,
      profile: toColorProfile(profile),
      weights: weightsOf(profile),
      cleanOnly: true,
      count: 15,
    })
  }, [items, occasion, profile])

  const current = outfits[index] ?? null

  const rate = useCallback(
    async (liked: boolean) => {
      if (!current) return
      const nextWeights = learnFrom(weightsOf(profile), current, liked)
      setProfile((p) => (p ? { ...p, pref_weights: nextWeights } : p))
      setIndex((i) => i + 1)
      try {
        await Promise.all([
          saveProfile({ pref_weights: nextWeights }),
          recordRating(current.items, liked),
        ])
      } catch { /* rating is best-effort; never block the UI */ }
    },
    [current, profile],
  )

  if (error) return <Wrap><p className="py-16 text-center text-sm text-danger">{error}</p></Wrap>
  if (!items) return <Wrap><SkeletonCard /></Wrap>

  const clean = items.filter((i) => i.laundry_status === 'clean')
  const needMore =
    clean.filter((i) => i.category === 'top').length === 0 ||
    clean.filter((i) => i.category === 'bottom').length === 0

  return (
    <Wrap>
      <header className="mb-4">
        <h1 className="font-display text-4xl font-light italic">Dress me</h1>
        <p className="mt-1 text-xs text-ink-faint">
          {profile?.color_season
            ? `Tuned to your ${profile.color_season} palette`
            : 'Set your colour profile in You for sharper picks'}
        </p>
      </header>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {occasions.map((o) => (
          <button
            key={o}
            onClick={() => { setOccasion(o); setIndex(0); setSaved(false) }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              occasion === o ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <ModeTab active={mode === 'dressme'} onClick={() => setMode('dressme')} label="Suggest" />
        <ModeTab active={mode === 'rate'} onClick={() => { setMode('rate'); setIndex(0) }} label="Rate looks" />
      </div>

      {needMore && (
        <div className="rounded-2xl bg-white p-5 text-center shadow-card">
          <p className="font-display text-xl italic text-ink-soft">Not enough to work with yet.</p>
          <p className="mx-auto mt-2 max-w-64 text-sm text-ink-faint">
            Add at least one top and one bottom that aren't in the laundry, and I'll start
            building outfits.
          </p>
        </div>
      )}

      {!needMore && !current && (
        <div className="rounded-2xl bg-white p-5 text-center shadow-card">
          <p className="font-display text-xl italic text-ink-soft">
            {index > 0 ? "That's every look for now." : 'Nothing works for this occasion yet.'}
          </p>
          <button
            onClick={() => { setIndex(0); setSaved(false) }}
            className="mt-4 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold tracking-widest text-ivory uppercase"
          >
            Start over
          </button>
        </div>
      )}

      {current && (
        <div key={index} className="fade-up">
          <OutfitCollage items={current.items} />

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {current.items.map((i) => (
                <span key={i.id} className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-ink-soft">
                  {i.name}
                </span>
              ))}
            </div>
            <ScoreDial score={current.score} />
          </div>

          <div className="mt-4 rounded-2xl bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
              Why this works
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{current.colorReason}</p>
            {current.styleNotes.map((n, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">— {n}</p>
            ))}
          </div>

          {mode === 'rate' ? (
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => rate(false)}
                className="flex-1 rounded-2xl border border-linen bg-white py-4 text-sm font-semibold text-ink-soft shadow-card"
              >
                👎 Not for me
              </button>
              <button
                onClick={() => rate(true)}
                className="flex-1 rounded-2xl bg-ink py-4 text-sm font-semibold text-ivory shadow-float"
              >
                👍 Love it
              </button>
            </div>
          ) : (
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setIndex((i) => i + 1); setSaved(false) }}
                className="flex-1 rounded-2xl border border-linen bg-white py-4 text-sm font-semibold text-ink shadow-card"
              >
                ↻ Show another
              </button>
              <button
                disabled={saved}
                onClick={async () => {
                  const name = `${occasion} — ${current.items[0]?.name ?? 'look'}`
                  await saveOutfit({
                    name, occasion, items: current.items,
                    score: current.score, source: 'suggested',
                  })
                  setSaved(true)
                }}
                className="flex-1 rounded-2xl bg-ink py-4 text-sm font-semibold text-ivory shadow-float disabled:opacity-50"
              >
                {saved ? '✓ Saved' : '♡ Save look'}
              </button>
            </div>
          )}

          {mode !== 'rate' && (
            <>
              <WoreButton items={current.items} className="mt-3 w-full" />
              <TryOn items={current.items} />
            </>
          )}

          <p className="mt-3 text-center text-[11px] text-ink-faint">
            Look {index + 1} of {outfits.length}
          </p>
        </div>
      )}
    </Wrap>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>
}

function ModeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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

function ScoreDial({ score }: { score: number }) {
  const tone = score >= 80 ? 'text-sage' : score >= 65 ? 'text-bronze-deep' : 'text-clay'
  return (
    <div className="shrink-0 text-right">
      <p className={`font-display text-3xl leading-none ${tone}`}>{score}</p>
      <p className="text-[10px] tracking-[0.15em] text-ink-faint uppercase">match</p>
    </div>
  )
}

function SkeletonCard() {
  return <div className="mt-6 aspect-[3/4] w-full animate-pulse rounded-2xl bg-paper" />
}
