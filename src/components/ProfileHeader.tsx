import { useRef, useState } from 'react'
import { compressPhoto } from '../lib/images'
import { uploadImage } from '../lib/db'
import { saveProfile } from '../lib/profileDb'
import StorageImg from './StorageImg'

/**
 * The personal part of the app: a photo and a name you chose, rather than the
 * email address you happened to sign up with.
 */
export default function ProfileHeader({
  avatarPath,
  displayName,
  email,
  stats,
  onChange,
}: {
  avatarPath: string | null
  displayName: string | null
  email: string | null
  stats: { pieces: number; looks: number; wears: number }
  onChange: (patch: { avatar_path?: string; display_name?: string }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayName ?? '')

  async function onPhoto(files: FileList | null) {
    if (!files?.[0]) return
    setBusy(true)
    try {
      // square-ish and small — it only ever renders at avatar size
      const compressed = await compressPhoto(files[0], 512, 0.88)
      const path = await uploadImage(compressed, 'photo')
      await saveProfile({ avatar_path: path })
      onChange({ avatar_path: path })
    } catch (e) {
      alert(`Could not save that photo: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  async function commitName() {
    const next = nameDraft.trim()
    setEditingName(false)
    if (next === (displayName ?? '')) return
    await saveProfile({ display_name: next || null })
    onChange({ display_name: next })
  }

  return (
    <section className="mb-6 flex flex-col items-center text-center">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="group relative"
        aria-label="Change profile photo"
      >
        <span className="block h-24 w-24 overflow-hidden rounded-full border-2 border-white bg-paper shadow-float">
          {avatarPath ? (
            <StorageImg path={avatarPath} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-3xl italic text-ink-faint">
              {(displayName ?? email ?? 'S').trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ivory bg-ink text-xs text-ivory">
          {busy ? '…' : '📷'}
        </span>
      </button>

      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') { setNameDraft(displayName ?? ''); setEditingName(false) }
          }}
          placeholder="Your name"
          maxLength={40}
          className="mt-4 w-56 rounded-xl border border-linen bg-white px-3 py-1.5 text-center font-display text-2xl italic outline-none focus:border-bronze"
        />
      ) : (
        <button
          onClick={() => { setNameDraft(displayName ?? ''); setEditingName(true) }}
          className="mt-4 font-display text-3xl font-light italic"
        >
          {displayName || 'Add your name'}
          <span className="ml-2 align-middle text-xs text-ink-faint">✎</span>
        </button>
      )}

      {email && <p className="mt-1 text-xs text-ink-faint">{email}</p>}

      <div className="mt-5 flex w-full max-w-xs justify-around rounded-2xl bg-white py-3.5 shadow-card">
        <Stat n={stats.pieces} label="pieces" />
        <Divider />
        <Stat n={stats.looks} label="looks" />
        <Divider />
        <Stat n={stats.wears} label="wears" />
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files)} />
    </section>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1">
      <p className="font-display text-2xl leading-none">{n}</p>
      <p className="mt-1 text-[10px] tracking-[0.15em] text-ink-faint uppercase">{label}</p>
    </div>
  )
}

function Divider() {
  return <span className="w-px self-stretch bg-linen" />
}
