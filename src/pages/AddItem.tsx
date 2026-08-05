import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { compressPhoto, removeBackground, trimTransparent } from '../lib/images'
import { extractColors } from '../lib/colors'
import { createItem, uploadImage } from '../lib/db'
import {
  CATEGORIES, SUBCATEGORIES, SEASONS, DEFAULT_OCCASIONS, FABRICS,
  type Category, type ItemColor,
} from '../lib/taxonomy'

interface Draft {
  file: Blob
  previewUrl: string
  cutout: Blob | null
  cutoutUrl: string | null
  colors: ItemColor[]
  status: 'queued' | 'processing' | 'ready' | 'failed'
  statusMsg: string
}

export default function AddItem() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [current, setCurrent] = useState(0)
  const [saving, setSaving] = useState(false)

  // form state for the current draft
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('top')
  const [subcategory, setSubcategory] = useState('')
  const [seasons, setSeasons] = useState<string[]>(['All-season'])
  const [occasions, setOccasions] = useState<string[]>(['Casual'])
  const [fabric, setFabric] = useState('Cotton')

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const files = [...list]
    const newDrafts: Draft[] = files.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      cutout: null,
      cutoutUrl: null,
      colors: [],
      status: 'queued',
      statusMsg: 'Waiting…',
    }))
    setDrafts(newDrafts)
    setCurrent(0)

    // process sequentially — bg removal is heavy
    for (let i = 0; i < newDrafts.length; i++) {
      const setMsg = (msg: string, status: Draft['status'] = 'processing') =>
        setDrafts((d) => d.map((x, j) => (j === i ? { ...x, status, statusMsg: msg } : x)))
      try {
        setMsg('Compressing…')
        const compressed = await compressPhoto(files[i])
        newDrafts[i].file = compressed
        let colors: ItemColor[] = []
        try {
          const cut = await removeBackground(compressed, (m) => setMsg(m))
          const trimmed = await trimTransparent(cut)
          newDrafts[i].cutout = trimmed
          newDrafts[i].cutoutUrl = URL.createObjectURL(trimmed)
          setMsg('Reading colours…')
          colors = await extractColors(trimmed, 4, true)
        } catch {
          // bg removal failed (offline / low memory) → colors from raw photo
          setMsg('Reading colours…')
          colors = await extractColors(compressed, 4, false)
        }
        setDrafts((d) =>
          d.map((x, j) =>
            j === i
              ? { ...x, cutout: newDrafts[i].cutout, cutoutUrl: newDrafts[i].cutoutUrl, colors, status: 'ready', statusMsg: '' }
              : x,
          ),
        )
      } catch {
        setMsg('Could not process this photo', 'failed')
      }
    }
  }

  const draft = drafts[current]

  function guessName(): string {
    const colorName = draft?.colors[0]?.name ?? ''
    return subcategory ? `${colorName} ${subcategory}`.trim() : colorName
  }

  async function saveCurrent() {
    if (!draft || draft.status !== 'ready') return
    setSaving(true)
    try {
      const photo_path = await uploadImage(draft.file, 'photo')
      const cutout_path = draft.cutout ? await uploadImage(draft.cutout, 'cutout') : null
      await createItem({
        name: name.trim() || guessName() || 'Untitled piece',
        category,
        subcategory: subcategory || SUBCATEGORIES[category][0],
        colors: draft.colors,
        primary_color: draft.colors[0]?.name ?? '',
        seasons,
        occasions,
        fabric,
        laundry_status: 'clean',
        photo_path,
        cutout_path,
        notes: '',
      })
      // next draft, or done
      if (current < drafts.length - 1) {
        setCurrent(current + 1)
        setName('')
        setSubcategory('')
      } else {
        navigate('/')
      }
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6">
        <Header onBack={() => navigate(-1)} title="Add pieces" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-24">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full max-w-xs rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float"
          >
            📷 Snap a photo
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full max-w-xs rounded-2xl border border-linen bg-white py-4 text-sm font-semibold tracking-widest text-ink uppercase shadow-card"
          >
            🖼 From gallery
          </button>
          <p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-ink-faint">
            Select multiple photos to add in bulk. The background is removed and colours are
            detected automatically — on your device, free.
          </p>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <Header
        onBack={() => (drafts.length ? setDrafts([]) : navigate(-1))}
        title={drafts.length > 1 ? `Piece ${current + 1} of ${drafts.length}` : 'New piece'}
      />

      <div className="cutout-bg mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-2xl shadow-card">
        {draft.cutoutUrl ? (
          <img src={draft.cutoutUrl} alt="cutout" className="h-full w-full object-contain p-4" />
        ) : (
          <img src={draft.previewUrl} alt="preview" className="h-full w-full object-cover" />
        )}
      </div>

      {draft.status !== 'ready' && (
        <p className="mb-4 text-center text-sm text-ink-soft">
          {draft.status === 'failed' ? '⚠️ ' : ''}
          {draft.statusMsg}
        </p>
      )}

      {draft.colors.length > 0 && (
        <div className="mb-4 flex items-center justify-center gap-3">
          {draft.colors.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="h-8 w-8 rounded-full border-2 border-white shadow-card" style={{ background: c.hex }} />
              <span className="text-[10px] text-ink-soft">{c.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Field label="Category">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCategory(c.id); setSubcategory('') }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
                  category === c.id ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {SUBCATEGORIES[category].map((s) => (
              <button
                key={s}
                onClick={() => setSubcategory(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  subcategory === s ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={guessName() || 'e.g. Navy oxford shirt'}
            className="w-full rounded-xl border border-linen bg-white px-4 py-2.5 text-sm outline-none focus:border-bronze"
          />
        </Field>

        <Field label="Occasions">
          <TogglePills options={[...DEFAULT_OCCASIONS]} selected={occasions} onChange={setOccasions} />
        </Field>

        <Field label="Season">
          <TogglePills options={[...SEASONS]} selected={seasons} onChange={setSeasons} />
        </Field>

        <Field label="Fabric">
          <TogglePills options={[...FABRICS]} selected={[fabric]} onChange={(v) => setFabric(v[v.length - 1] ?? 'Cotton')} />
        </Field>

        <button
          onClick={saveCurrent}
          disabled={saving || draft.status === 'processing' || draft.status === 'queued'}
          className="mt-2 rounded-2xl bg-ink py-4 text-sm font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-40"
        >
          {saving ? 'Saving…' : current < drafts.length - 1 ? 'Save & next' : 'Save to closet'}
        </button>
        {draft.status === 'failed' && (
          <button onClick={() => current < drafts.length - 1 ? setCurrent(current + 1) : navigate('/')} className="text-center text-xs text-ink-soft underline">
            Skip this photo
          </button>
        )}
      </div>
    </div>
  )
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-lg">
        ‹
      </button>
      <h1 className="font-display text-2xl font-light italic">{title}</h1>
    </header>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">{label}</p>
      {children}
    </div>
  )
}

function TogglePills({
  options, selected, onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              on ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
