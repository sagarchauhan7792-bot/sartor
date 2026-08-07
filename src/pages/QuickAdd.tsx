import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { compressPhoto, removeBackground, trimTransparent } from '../lib/images'
import { extractColors } from '../lib/colors'
import { classifyGarment, defaultOccasions, defaultSeasons } from '../lib/classify'
import { createItem, uploadImage } from '../lib/db'
import {
  CATEGORIES, SUBCATEGORIES, type Category, type ItemColor,
} from '../lib/taxonomy'

interface Draft {
  id: number
  fileName: string
  photo: Blob
  cutout: Blob | null
  previewUrl: string
  colors: ItemColor[]
  category: Category
  subcategory: string
  confidence: number
  state: 'waiting' | 'working' | 'ready' | 'failed'
  status: string
  keep: boolean
}

export default function QuickAdd() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    const files = [...list]
    const initial: Draft[] = files.map((f, i) => ({
      id: i,
      fileName: f.name,
      photo: f,
      cutout: null,
      previewUrl: URL.createObjectURL(f),
      colors: [],
      category: 'top',
      subcategory: 'T-shirt',
      confidence: 0,
      state: 'waiting',
      status: 'Queued',
      keep: true,
    }))
    setDrafts(initial)
    setRunning(true)

    const patch = (id: number, p: Partial<Draft>) =>
      setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)))

    // Sequential on purpose: these models are heavy, and running them in
    // parallel on a phone makes every item slower rather than fewer.
    for (const draft of initial) {
      const say = (status: string) => patch(draft.id, { state: 'working', status })
      try {
        say('Preparing…')
        const photo = await compressPhoto(draft.photo)

        let cutout: Blob | null = null
        let colors: ItemColor[]
        try {
          say('Removing background…')
          cutout = await trimTransparent(await removeBackground(photo, say))
          colors = await extractColors(cutout, 4, true)
        } catch {
          // background removal is best-effort; the photo still works
          colors = await extractColors(photo, 4, false)
        }

        const guess = await classifyGarment(cutout ?? photo, say)

        patch(draft.id, {
          photo,
          cutout,
          previewUrl: URL.createObjectURL(cutout ?? photo),
          colors,
          category: guess.category,
          subcategory: guess.subcategory,
          confidence: guess.confidence,
          state: 'ready',
          status: '',
        })
      } catch {
        patch(draft.id, { state: 'failed', status: "Couldn't read this photo", keep: false })
      }
    }
    setRunning(false)
  }

  async function saveAll() {
    const keepers = drafts.filter((d) => d.keep && d.state === 'ready')
    if (!keepers.length) return
    setSaving(true)
    try {
      for (const d of keepers) {
        const photo_path = await uploadImage(d.photo, 'photo')
        const cutout_path = d.cutout ? await uploadImage(d.cutout, 'cutout') : null
        await createItem({
          name: `${d.colors[0]?.name ?? ''} ${d.subcategory}`.trim(),
          category: d.category,
          subcategory: d.subcategory,
          colors: d.colors,
          primary_color: d.colors[0]?.name ?? '',
          seasons: defaultSeasons(d.subcategory),
          occasions: defaultOccasions(d.subcategory),
          fabric: 'Cotton',
          laundry_status: 'clean',
          photo_path,
          cutout_path,
          notes: '',
        })
      }
      // straight to the point of the whole exercise
      navigate('/dressme')
    } catch (e) {
      alert(`Could not save: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const ready = drafts.filter((d) => d.state === 'ready' && d.keep).length
  const done = drafts.filter((d) => d.state === 'ready' || d.state === 'failed').length

  // ---------- empty state ----------
  if (drafts.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6">
        <Header onBack={() => navigate('/add')} title="Add clothes" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-24">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full max-w-xs rounded-2xl bg-ink py-5 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float"
          >
            🖼 Choose photos
          </button>
          <p className="max-w-xs text-center text-sm leading-relaxed text-ink-soft">
            Pick as many clothes as you like. Sartor removes each background, reads the colours
            and works out what the garment is — then goes straight to outfit suggestions.
          </p>
          <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-ink-faint">
            One garment per photo — laid flat, on a hanger, or against a plain wall. If the photo
            shows you <em>wearing</em> a full outfit, use the option below instead: it splits the
            pieces apart properly rather than guessing at the most visible one.
          </p>

          <div className="mt-6 flex flex-col items-center gap-2 text-xs">
            <button onClick={() => navigate('/add/selfie')} className="text-ink-soft underline">
              Pull clothes out of a photo of me
            </button>
            <button onClick={() => navigate('/add/url')} className="text-ink-soft underline">
              Add from a store link
            </button>
            <button onClick={() => navigate('/add/manual')} className="text-ink-faint underline">
              Add one by one instead
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
    )
  }

  // ---------- processing / review ----------
  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <Header
        onBack={() => (running ? null : setDrafts([]))}
        title={running ? `Reading ${done + 1} of ${drafts.length}` : `${drafts.length} pieces`}
      />

      {running && (
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full bg-bronze transition-all duration-500"
            style={{ width: `${(done / drafts.length) * 100}%` }}
          />
        </div>
      )}

      {!running && (
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">
          Here's what I found. Tap a piece to correct its type — otherwise just add them.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {drafts.map((d) => (
          <div
            key={d.id}
            className={`rounded-2xl bg-white p-3 shadow-card transition ${d.keep ? '' : 'opacity-40'}`}
          >
            <div className="flex items-center gap-3">
              <div className="cutout-bg h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <img src={d.previewUrl} alt="" className="h-full w-full object-contain p-0.5" />
              </div>

              <div className="min-w-0 flex-1">
                {d.state === 'ready' ? (
                  <>
                    <p className="truncate text-sm font-medium">
                      {d.colors[0]?.name} {d.subcategory}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {d.colors.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="h-3.5 w-3.5 rounded-full border border-white shadow-card"
                          style={{ background: c.hex }}
                        />
                      ))}
                      <span className="ml-1 text-[11px] text-ink-faint">
                        {CATEGORIES.find((c) => c.id === d.category)?.label}
                        {d.confidence > 0 && d.confidence < 0.25 && ' · unsure'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className={`text-sm ${d.state === 'failed' ? 'text-clay' : 'text-ink-soft'}`}>
                    {d.status}
                  </p>
                )}
              </div>

              {d.state === 'ready' && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditing(editing === d.id ? null : d.id)}
                    className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink-soft"
                  >
                    Change
                  </button>
                  <button
                    onClick={() =>
                      setDrafts((list) =>
                        list.map((x) => (x.id === d.id ? { ...x, keep: !x.keep } : x)),
                      )
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      d.keep ? 'bg-ink text-ivory' : 'bg-paper text-ink-faint'
                    }`}
                    aria-label={d.keep ? 'Exclude' : 'Include'}
                  >
                    {d.keep ? '✓' : '+'}
                  </button>
                </div>
              )}
            </div>

            {editing === d.id && (
              <div className="mt-3 border-t border-linen pt-3">
                <div className="no-scrollbar -mx-1 mb-2 flex gap-2 overflow-x-auto px-1">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        setDrafts((list) =>
                          list.map((x) =>
                            x.id === d.id
                              ? { ...x, category: c.id, subcategory: SUBCATEGORIES[c.id][0] }
                              : x,
                          ),
                        )
                      }
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                        d.category === c.id ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUBCATEGORIES[d.category].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setDrafts((list) =>
                          list.map((x) => (x.id === d.id ? { ...x, subcategory: s } : x)),
                        )
                        setEditing(null)
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        d.subcategory === s ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={saveAll}
        disabled={running || saving || ready === 0}
        className="mt-5 w-full rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-40"
      >
        {running
          ? 'Reading photos…'
          : saving
            ? 'Adding…'
            : `Add ${ready} and show me outfits`}
      </button>
    </div>
  )
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg"
      >
        ‹
      </button>
      <h1 className="font-display text-2xl font-light italic">{title}</h1>
    </header>
  )
}
