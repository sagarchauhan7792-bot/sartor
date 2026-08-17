import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listItems } from '../lib/db'
import { loadProfile, toColorProfile, weightsOf, type SartorProfile } from '../lib/profileDb'
import { importFromUrl } from '../lib/importUrl'
import { compressPhoto, removeBackground, trimTransparent } from '../lib/images'
import { extractColors, dropModelTones } from '../lib/colors'
import { classifyGarment } from '../lib/classify'
import { assessPurchase, type Candidate, type Verdict } from '../lib/advisor'
import { resolveFit } from '../lib/fit'
import { DEFAULT_OCCASIONS, type Item } from '../lib/taxonomy'
import OutfitCollage from '../components/OutfitCollage'
import StorageImg from '../components/StorageImg'

export default function ShouldIBuy() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [closet, setCloset] = useState<Item[]>([])
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [occasion, setOccasion] = useState('Casual')

  useEffect(() => {
    Promise.all([listItems(), loadProfile()]).then(([its, p]) => {
      setCloset(its)
      setProfile(p)
    })
  }, [])

  const verdict: Verdict | null = useMemo(() => {
    if (!candidate) return null
    return assessPurchase(
      candidate,
      closet,
      occasion,
      toColorProfile(profile),
      weightsOf(profile),
    )
  }, [candidate, closet, occasion, profile])

  /** Shared by the link and photo paths — both end in a Candidate. */
  async function analyse(blob: Blob, name: string) {
    setStatus('Preparing image…')
    const compressed = await compressPhoto(blob)
    let colors
    try {
      setStatus('Removing background…')
      const cut = await trimTransparent(await removeBackground(compressed, setStatus))
      setPreviewUrl(URL.createObjectURL(cut))
      colors = dropModelTones(await extractColors(cut, 5, true))
    } catch {
      setPreviewUrl(URL.createObjectURL(compressed))
      colors = dropModelTones(await extractColors(compressed, 5, false))
    }
    setStatus('Identifying it…')
    const guess = await classifyGarment(compressed, setStatus)
    setCandidate({
      name: name || `${colors[0]?.name ?? ''} ${guess.subcategory}`.trim(),
      category: guess.category,
      subcategory: guess.subcategory,
      colors,
      fabric: 'Cotton',
    })
    setStatus(null)
  }

  async function fromLink() {
    if (!url.trim()) return
    setError(null)
    setCandidate(null)
    setStatus('Reading the page…')
    try {
      const product = await importFromUrl(url, setStatus)
      await analyse(product.imageBlob, product.title)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That link could not be read.')
      setStatus(null)
    }
  }

  async function fromPhoto(files: FileList | null) {
    if (!files?.[0]) return
    setError(null)
    setCandidate(null)
    try {
      await analyse(files[0], '')
    } catch {
      setError('That photo could not be processed.')
      setStatus(null)
    }
  }

  const tone = {
    buy: 'bg-sage/15 text-sage',
    maybe: 'bg-bronze/15 text-bronze-deep',
    skip: 'bg-clay/15 text-clay',
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-lg"
        >
          ‹
        </button>
        <div>
          <h1 className="font-display text-2xl font-light italic">Should I buy this?</h1>
          <p className="text-xs text-ink-faint">Checked against what you already own</p>
        </div>
      </header>

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') fromLink() }}
          placeholder="Paste a product link"
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl border border-linen bg-white px-3 py-2.5 text-sm outline-none focus:border-bronze"
        />
        <button
          onClick={fromLink}
          disabled={status !== null || !url.trim()}
          className="shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-ivory disabled:opacity-40"
        >
          Check
        </button>
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status !== null}
        className="mt-2 w-full rounded-xl border border-linen bg-white py-2.5 text-xs font-medium text-ink-soft disabled:opacity-50"
      >
        …or use a photo from the shop
      </button>

      {status && <p className="py-10 text-center text-sm text-ink-soft">{status}</p>}
      {error && (
        <div className="mt-4 rounded-2xl bg-clay/10 p-4">
          <p className="text-sm leading-relaxed text-clay">{error}</p>
        </div>
      )}

      {!candidate && !status && !error && (
        <p className="mt-6 text-xs leading-relaxed text-ink-faint">
          Before you spend anything, see how many new outfits it would actually create from
          clothes you already own, whether the colour suits you, and whether you're about to buy
          something you already have.
        </p>
      )}

      {candidate && verdict && (
        <div className="fade-up mt-5">
          <div className="flex gap-3">
            <div className="cutout-bg h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-card">
              {previewUrl && <img src={previewUrl} alt="" className="h-full w-full object-contain p-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{candidate.name}</p>
              <p className="text-[11px] text-ink-faint">{candidate.subcategory}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {candidate.colors.slice(0, 4).map((c, i) => (
                  <span key={i} className="h-4 w-4 rounded-full border border-white shadow-card" style={{ background: c.hex }} />
                ))}
              </div>
            </div>
          </div>

          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
            {[...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])].map((o) => (
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

          <div className={`mt-4 rounded-2xl p-4 ${tone[verdict.verdict]}`}>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase">
              {verdict.verdict === 'buy' ? 'Worth buying' : verdict.verdict === 'skip' ? 'Skip it' : 'Your call'}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{verdict.headline}</p>
          </div>

          {verdict.duplicates.length > 0 && (
            <Card title="You already own">
              {verdict.duplicates.map((d) => (
                <Row key={d.item.id} item={d.item} note={d.reason} />
              ))}
            </Card>
          )}

          {verdict.pairsWith.length > 0 && (
            <Card title="It would go with">
              {verdict.pairsWith.map((p) => (
                <Row key={p.item.id} item={p.item} note={p.reason} score={p.score} />
              ))}
            </Card>
          )}

          {verdict.unlocked.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
                Outfits it would create
              </p>
              <div className="flex flex-col gap-4">
                {verdict.unlocked.map((o, i) => (
                  <div key={i}>
                    <OutfitCollage
                      items={o.items}
                      fit={resolveFit(profile?.fit)}
                      bodyPath={profile?.body_path ?? null}
                    />
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {o.items.map((x) => x.name).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => fromPhoto(e.target.files)} />
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-card">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function Row({ item, note, score }: { item: Item; note: string; score?: number }) {
  return (
    <Link to={`/item/${item.id}`} className="flex items-center gap-3 rounded-xl bg-paper p-2">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white">
        <StorageImg
          path={item.cutout_path ?? item.photo_path}
          alt={item.name}
          className="h-full w-full object-contain p-0.5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{item.name}</p>
        <p className="truncate text-[11px] text-ink-faint">{note}</p>
      </div>
      {score != null && <span className="shrink-0 text-xs font-medium text-bronze-deep">{score}</span>}
    </Link>
  )
}
