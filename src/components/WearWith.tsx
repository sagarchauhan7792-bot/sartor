import { useEffect, useMemo, useState } from 'react'
import { listItems } from '../lib/db'
import { loadProfile, toColorProfile, weightsOf, type SartorProfile } from '../lib/profileDb'
import { generateOutfits } from '../lib/outfit'
import { resolveFit } from '../lib/fit'
import { DEFAULT_OCCASIONS, type Item } from '../lib/taxonomy'
import OutfitCollage from './OutfitCollage'

/**
 * The question you actually ask standing at the wardrobe holding a shirt:
 * what does this go with? Dress Me starts from an occasion; this starts from
 * the garment in your hand.
 */
export default function WearWith({ item }: { item: Item }) {
  const [closet, setCloset] = useState<Item[] | null>(null)
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [occasion, setOccasion] = useState<string>(item.occasions?.[0] ?? 'Casual')

  useEffect(() => {
    Promise.all([listItems(), loadProfile()])
      .then(([its, p]) => { setCloset(its); setProfile(p) })
      .catch(() => setCloset([]))
  }, [])

  const outfits = useMemo(() => {
    if (!closet) return []
    return generateOutfits(closet, {
      occasion,
      profile: toColorProfile(profile),
      weights: weightsOf(profile),
      cleanOnly: false, // you're asking what it works with, not what's washed
      pinned: [item],
      count: 6,
    })
  }, [closet, profile, occasion, item])

  const occasions = [...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])]

  return (
    <section className="mb-5">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
        Wear it with
      </p>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {occasions.map((o) => (
          <button
            key={o}
            onClick={() => setOccasion(o)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${
              occasion === o ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {closet === null && <div className="aspect-[3/4] animate-pulse rounded-2xl bg-paper" />}

      {closet !== null && outfits.length === 0 && (
        <p className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-ink-soft shadow-card">
          Nothing in your closet completes an outfit around this for {occasion.toLowerCase()} yet.
          A bottom and a pair of shoes are the usual missing pieces.
        </p>
      )}

      <div className="flex flex-col gap-5">
        {outfits.map((o, i) => (
          <div key={i}>
            <OutfitCollage
              items={o.items}
              fit={resolveFit(profile?.fit)}
              bodyPath={profile?.body_path ?? null}
            />
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-xs leading-relaxed text-ink-soft">
                {o.items.filter((x) => x.id !== item.id).map((x) => x.name).join(' · ')}
              </p>
              <span className="shrink-0 font-display text-xl leading-none text-ink-soft">
                {o.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
