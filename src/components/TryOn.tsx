import { useEffect, useRef, useState } from 'react'
import { tryOn, savedHfToken } from '../lib/tryon'
import { imageUrl } from '../lib/db'
import type { Item } from '../lib/taxonomy'

/**
 * Best-effort photorealistic try-on. The collage above is the reliable preview;
 * this is the optional extra that depends on a free, shared service.
 */
export default function TryOn({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [personUrl, setPersonUrl] = useState<string | null>(null)
  const personBlobRef = useRef<Blob | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // the garment worth showing on a body is the top (or the layer over it)
  const garment = items.find((i) => i.category === 'layer') ?? items.find((i) => i.category === 'top')

  useEffect(() => {
    setResult(null)
    setMessage(null)
  }, [items])

  async function loadDefaultModel(): Promise<Blob> {
    const res = await fetch(`${import.meta.env.BASE_URL}model/male-model.jpg`)
    if (!res.ok) throw new Error('The stock model image is missing.')
    return res.blob()
  }

  async function run() {
    if (!garment) return
    setBusy(true)
    setResult(null)
    setMessage('Connecting…')
    try {
      const person = personBlobRef.current ?? (await loadDefaultModel())
      const garmentUrl = await imageUrl(garment.cutout_path ?? garment.photo_path)
      if (!garmentUrl) throw new Error('Could not read that garment image.')
      const garmentBlob = await (await fetch(garmentUrl)).blob()

      const out = await tryOn(person, garmentBlob, garment.category, (s) => {
        if (s.state === 'connecting') setMessage(`Connecting to ${s.provider}…`)
        if (s.state === 'queued') setMessage(`${s.provider} is working — the free queue can take a minute…`)
      })
      setResult(out)
      setMessage(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Try-on failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!garment) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-2xl border border-linen bg-white py-3 text-xs font-semibold tracking-widest text-ink-soft uppercase shadow-card"
      >
        ✦ See it on a model
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
          Try-on — {garment.name}
        </p>
        <button onClick={() => setOpen(false)} className="text-xs text-ink-faint">close</button>
      </div>

      {result && (
        <img src={result} alt="Try-on result" className="mt-3 w-full rounded-xl object-contain" />
      )}

      {message && (
        <p className={`mt-3 text-sm leading-relaxed ${busy ? 'text-ink-soft' : 'text-clay'}`}>
          {message}
        </p>
      )}

      {!result && !busy && !message && (
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Renders this piece on a body using free, shared services. They queue and sometimes
          fail — the preview above always works regardless.
          {!savedHfToken() &&
            ' The open service currently blocks requests from India, so this needs a free Hugging Face token — add one under You.'}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="flex-1 rounded-xl bg-ink py-3 text-xs font-semibold tracking-widest text-ivory uppercase disabled:opacity-50"
        >
          {busy ? 'Working…' : result ? 'Try again' : 'Generate'}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-xl border border-linen px-4 text-xs font-medium text-ink-soft"
        >
          {personUrl ? 'Change photo' : 'Use my photo'}
        </button>
      </div>

      {personUrl && (
        <p className="mt-2 text-[11px] text-ink-faint">Using your photo instead of the stock model.</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          personBlobRef.current = f
          setPersonUrl(URL.createObjectURL(f))
          setResult(null)
          setMessage(null)
        }}
      />
    </div>
  )
}
