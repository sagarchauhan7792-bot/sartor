import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractGarments, type ExtractedGarment } from '../lib/segment'
import { extractColors } from '../lib/colors'
import { compressPhoto } from '../lib/images'
import { createItem, uploadImage } from '../lib/db'
import { SUBCATEGORIES, SEASONS, DEFAULT_OCCASIONS, type ItemColor } from '../lib/taxonomy'

interface Draft extends ExtractedGarment {
  keep: boolean
  name: string
  colors: ItemColor[]
  occasions: string[]
  seasons: string[]
}

export default function FromSelfie() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  async function onFile(files: FileList | null) {
    if (!files?.[0]) return
    setError(null)
    setDrafts(null)
    setStatus('Preparing photo…')
    setSourceUrl(URL.createObjectURL(files[0]))
    try {
      const compressed = await compressPhoto(files[0], 1024)
      const found = await extractGarments(compressed, setStatus)
      if (found.length === 0) {
        setError("No clothing was found in that photo. A full-length shot in good light, facing the camera, works best.")
        setStatus(null)
        return
      }
      setStatus('Reading colours…')
      const withColors: Draft[] = []
      for (const g of found) {
        const colors = await extractColors(g.blob, 4, true)
        withColors.push({
          ...g,
          // Clothing detections are reliable; accessories are where the model
          // confuses skin and hair for hats, belts and bags. Make those opt-in
          // so a stray detection never lands in the closet unnoticed.
          keep: g.category !== 'accessory',
          colors,
          name: `${colors[0]?.name ?? ''} ${g.subcategory}`.trim(),
          occasions: ['Casual'],
          seasons: ['All-season'],
        })
      }
      setDrafts(withColors)
      setStatus(null)
    } catch (e) {
      setError(
        e instanceof Error
          ? `Extraction failed: ${e.message}`
          : 'Extraction failed unexpectedly.',
      )
      setStatus(null)
    }
  }

  async function saveAll() {
    if (!drafts) return
    const keepers = drafts.filter((d) => d.keep)
    if (keepers.length === 0) return
    setSaving(true)
    try {
      for (const d of keepers) {
        const path = await uploadImage(d.blob, 'cutout')
        await createItem({
          name: d.name.trim() || d.subcategory,
          category: d.category,
          subcategory: d.subcategory,
          colors: d.colors,
          primary_color: d.colors[0]?.name ?? '',
          seasons: d.seasons,
          occasions: d.occasions,
          fabric: 'Cotton',
          laundry_status: 'clean',
          // the cutout is all we have — it is both the photo and the cutout
          photo_path: path,
          cutout_path: path,
          notes: 'Extracted from a photo',
        })
      }
      navigate('/')
    } catch (e) {
      setError(`Could not save: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => (d ? d.map((x, n) => (n === i ? { ...x, ...patch } : x)) : d))

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate('/add')} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg">
          ‹
        </button>
        <h1 className="font-display text-2xl font-light italic">From a photo of you</h1>
      </header>

      {!drafts && !status && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float"
          >
            📸 Choose a photo
          </button>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Pick a photo of yourself wearing an outfit. Sartor finds each garment, cuts it out,
            and adds the pieces to your closet separately.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Works best with a full-length shot in daylight, facing the camera, against a plain-ish
            background. Everything runs on your device — the photo is never uploaded anywhere.
            The model downloads once (about 25 MB) and is cached after that.
          </p>
        </>
      )}

      {status && (
        <div className="py-10 text-center">
          {sourceUrl && (
            <img src={sourceUrl} alt="" className="mx-auto mb-5 max-h-56 rounded-2xl object-contain shadow-card" />
          )}
          <p className="text-sm text-ink-soft">{status}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-clay/10 p-4">
          <p className="text-sm leading-relaxed text-clay">{error}</p>
          <button onClick={() => { setError(null); setDrafts(null) }} className="mt-3 text-xs font-medium text-clay underline">
            Try another photo
          </button>
        </div>
      )}

      {drafts && (
        <>
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">
            Found {drafts.length} {drafts.length === 1 ? 'piece' : 'pieces'}. Tick the ones to keep.
            {drafts.some((d) => d.category === 'accessory') && (
              <span className="text-ink-faint">
                {' '}Accessories are left off by default — the model sometimes mistakes hair or
                skin for a hat or belt.
              </span>
            )}
          </p>

          <div className="flex flex-col gap-4">
            {drafts.map((d, i) => (
              <div
                key={i}
                className={`rounded-2xl bg-white p-3 shadow-card transition ${d.keep ? '' : 'opacity-45'}`}
              >
                <div className="flex gap-3">
                  <div className="cutout-bg h-24 w-24 shrink-0 overflow-hidden rounded-xl">
                    <img src={d.previewUrl} alt={d.label} className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <input
                        value={d.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg border border-linen px-2 py-1 text-sm outline-none focus:border-bronze"
                      />
                      <button
                        onClick={() => update(i, { keep: !d.keep })}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                          d.keep ? 'bg-ink text-ivory' : 'bg-paper text-ink-faint'
                        }`}
                        aria-label={d.keep ? 'Exclude' : 'Include'}
                      >
                        {d.keep ? '✓' : '+'}
                      </button>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5">
                      {d.colors.slice(0, 3).map((c, n) => (
                        <span key={n} className="h-4 w-4 rounded-full border border-white shadow-card" style={{ background: c.hex }} />
                      ))}
                      <span className="text-[11px] text-ink-faint">{d.colors[0]?.name}</span>
                    </div>

                    <select
                      value={d.subcategory}
                      onChange={(e) => update(i, { subcategory: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-linen bg-white px-2 py-1 text-xs outline-none focus:border-bronze"
                    >
                      {SUBCATEGORIES[d.category].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DEFAULT_OCCASIONS.map((o) => (
                    <button
                      key={o}
                      onClick={() =>
                        update(i, {
                          occasions: d.occasions.includes(o)
                            ? d.occasions.filter((x) => x !== o)
                            : [...d.occasions, o],
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        d.occasions.includes(o) ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        update(i, {
                          seasons: d.seasons.includes(s)
                            ? d.seasons.filter((x) => x !== s)
                            : [...d.seasons, s],
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        d.seasons.includes(s) ? 'bg-sage/20 text-sage' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveAll}
            disabled={saving || drafts.every((d) => !d.keep)}
            className="mt-5 w-full rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-40"
          >
            {saving ? 'Saving…' : `Add ${drafts.filter((d) => d.keep).length} to closet`}
          </button>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files)} />
    </div>
  )
}
