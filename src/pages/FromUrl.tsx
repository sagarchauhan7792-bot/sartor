import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importFromUrl } from '../lib/importUrl'
import { compressPhoto, removeBackground, trimTransparent } from '../lib/images'
import { extractColors, dropModelTones } from '../lib/colors'
import { createItem, uploadImage } from '../lib/db'
import {
  CATEGORIES, SUBCATEGORIES, SEASONS, DEFAULT_OCCASIONS,
  type Category, type ItemColor,
} from '../lib/taxonomy'

export default function FromUrl() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [photo, setPhoto] = useState<Blob | null>(null)
  const [cutout, setCutout] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [colors, setColors] = useState<ItemColor[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('top')
  const [subcategory, setSubcategory] = useState('')
  const [occasions, setOccasions] = useState<string[]>(['Casual'])
  const [seasons, setSeasons] = useState<string[]>(['All-season'])

  async function run() {
    if (!url.trim()) return
    setError(null)
    setStatus('Reading the page…')
    try {
      const product = await importFromUrl(url, setStatus)

      setStatus('Preparing image…')
      const compressed = await compressPhoto(product.imageBlob)
      setPhoto(compressed)
      setName(product.title)

      let cols: ItemColor[]
      try {
        setStatus('Removing background…')
        const cut = await trimTransparent(await removeBackground(compressed, setStatus))
        setCutout(cut)
        setPreviewUrl(URL.createObjectURL(cut))
        cols = await extractColors(cut, 5, true)
      } catch {
        setPreviewUrl(URL.createObjectURL(compressed))
        cols = await extractColors(compressed, 5, false)
      }
      // most product shots are worn by a model — keep the garment, not the skin
      cols = dropModelTones(cols)
      setColors(cols)
      if (!product.title) setName(cols[0]?.name ?? '')
      setStatus(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That link could not be imported.')
      setStatus(null)
    }
  }

  async function save() {
    if (!photo) return
    setSaving(true)
    try {
      const photo_path = await uploadImage(photo, 'photo')
      const cutout_path = cutout ? await uploadImage(cutout, 'cutout') : null
      await createItem({
        name: name.trim() || colors[0]?.name || 'Imported piece',
        category,
        subcategory: subcategory || SUBCATEGORIES[category][0],
        colors,
        primary_color: colors[0]?.name ?? '',
        seasons,
        occasions,
        fabric: 'Cotton',
        laundry_status: 'clean',
        photo_path,
        cutout_path,
        notes: `Imported from ${url}`,
      })
      navigate('/')
    } catch (e) {
      setError(`Could not save: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate('/add')} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg">
          ‹
        </button>
        <h1 className="font-display text-2xl font-light italic">From a link</h1>
      </header>

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }}
          placeholder="Paste a product link"
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl border border-linen bg-white px-3 py-2.5 text-sm outline-none focus:border-bronze"
        />
        <button
          onClick={run}
          disabled={status !== null || !url.trim()}
          className="shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-ivory disabled:opacity-40"
        >
          Fetch
        </button>
      </div>

      {!photo && !status && !error && (
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Paste the link to a product page and Sartor pulls in the image and name, removes the
          background, and reads the colours. If a site blocks it, save the image and add it from
          your gallery instead.
        </p>
      )}

      {status && <p className="py-10 text-center text-sm text-ink-soft">{status}</p>}

      {error && (
        <div className="mt-4 rounded-2xl bg-clay/10 p-4">
          <p className="text-sm leading-relaxed text-clay">{error}</p>
        </div>
      )}

      {photo && status === null && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="cutout-bg aspect-square overflow-hidden rounded-2xl shadow-card">
            {previewUrl && <img src={previewUrl} alt="" className="h-full w-full object-contain p-4" />}
          </div>

          {colors.length > 0 && (
            <div className="flex items-center justify-center gap-3">
              {colors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="h-7 w-7 rounded-full border-2 border-white shadow-card" style={{ background: c.hex }} />
                  <span className="text-[10px] text-ink-soft">{c.name}</span>
                </div>
              ))}
            </div>
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-xl border border-linen bg-white px-4 py-2.5 text-sm outline-none focus:border-bronze"
          />

          <Pills
            label="Category"
            options={CATEGORIES.map((c) => `${c.emoji} ${c.label}`)}
            selected={[`${CATEGORIES.find((c) => c.id === category)!.emoji} ${CATEGORIES.find((c) => c.id === category)!.label}`]}
            onPick={(v) => {
              const found = CATEGORIES.find((c) => `${c.emoji} ${c.label}` === v)
              if (found) { setCategory(found.id); setSubcategory('') }
            }}
          />
          <Pills
            label="Type"
            options={SUBCATEGORIES[category]}
            selected={[subcategory]}
            onPick={setSubcategory}
          />
          <Pills
            label="Occasions"
            options={[...DEFAULT_OCCASIONS]}
            selected={occasions}
            onPick={(v) => setOccasions((o) => (o.includes(v) ? o.filter((x) => x !== v) : [...o, v]))}
          />
          <Pills
            label="Season"
            options={[...SEASONS]}
            selected={seasons}
            onPick={(v) => setSeasons((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          />

          <button
            onClick={save}
            disabled={saving}
            className="rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save to closet'}
          </button>
        </div>
      )}
    </div>
  )
}

function Pills({
  label, options, selected, onPick,
}: {
  label: string
  options: string[]
  selected: string[]
  onPick: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">{label}</p>
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
    </div>
  )
}
