import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { compressPhoto } from '../lib/images'
import { uploadImage } from '../lib/db'
import {
  addInspo, analyseInspo, deleteInspo, listInspo, matchToCloset,
  type InspoImage, type Match,
} from '../lib/inspo'
import type { Item } from '../lib/taxonomy'
import StorageImg from '../components/StorageImg'

export default function InspoBoard({ items }: { items: Item[] }) {
  const [board, setBoard] = useState<InspoImage[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listInspo().then(setBoard).catch(() => setBoard([]))
  }, [])

  async function onFiles(files: FileList | null) {
    if (!files?.[0]) return
    setBusy('Reading the look…')
    try {
      const compressed = await compressPhoto(files[0], 1000)
      const colors = await analyseInspo(compressed)
      const path = await uploadImage(compressed, 'photo')
      await addInspo(path, colors)
      setBoard(await listInspo())
    } catch (e) {
      alert(`Could not save that image: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        className="mb-4 w-full rounded-2xl bg-ink py-3.5 text-xs font-semibold tracking-widest text-ivory uppercase shadow-float disabled:opacity-50"
      >
        {busy ?? '+ Save an inspiration image'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFiles(e.target.files)} />

      {board === null && <div className="aspect-square animate-pulse rounded-2xl bg-paper" />}

      {board?.length === 0 && (
        <div className="mt-10 text-center">
          <p className="font-display text-2xl italic text-ink-soft">No references yet.</p>
          <p className="mx-auto mt-2 max-w-64 text-sm text-ink-faint">
            Screenshot a look you like — from anywhere — and Sartor will tell you which of your
            own clothes get closest to it.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {board?.map((ref) => {
          const matches = open === ref.id ? matchToCloset(ref.colors, items) : []
          return (
            <div key={ref.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
              <StorageImg
                path={ref.image_path}
                alt="Inspiration"
                className="max-h-72 w-full object-cover"
              />

              <div className="p-3">
                <div className="flex items-center gap-1.5">
                  {ref.colors.slice(0, 5).map((c, i) => (
                    <span
                      key={i}
                      title={c.name}
                      className="h-5 w-5 rounded-full border border-white shadow-card"
                      style={{ background: c.hex }}
                    />
                  ))}
                  <span className="ml-auto flex gap-3">
                    <button
                      onClick={() => setOpen(open === ref.id ? null : ref.id)}
                      className="text-xs font-medium text-bronze-deep"
                    >
                      {open === ref.id ? 'Hide' : 'Recreate this'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Remove this reference?')) return
                        await deleteInspo(ref.id)
                        setBoard((b) => (b ?? []).filter((x) => x.id !== ref.id))
                      }}
                      className="text-xs text-danger"
                    >
                      Remove
                    </button>
                  </span>
                </div>

                {open === ref.id && (
                  <div className="mt-3">
                    {items.length === 0 ? (
                      <p className="text-xs text-ink-faint">Add clothes to your closet first.</p>
                    ) : matches.length === 0 ? (
                      <p className="text-xs text-ink-faint">
                        Nothing in your closet lines up with this palette yet.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
                          From your closet
                        </p>
                        <div className="flex flex-col gap-2">
                          {matches.slice(0, 6).map((m) => (
                            <MatchRow key={m.item.id} match={m} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="h-6" />
    </div>
  )
}

function MatchRow({ match }: { match: Match }) {
  return (
    <Link to={`/item/${match.item.id}`} className="flex items-center gap-3 rounded-xl bg-paper p-2">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
        <StorageImg
          path={match.item.cutout_path ?? match.item.photo_path}
          alt={match.item.name}
          className="h-full w-full object-contain p-0.5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{match.item.name}</p>
        <p className="truncate text-[11px] text-ink-faint">{match.reason}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-bronze-deep">{match.score}</span>
    </Link>
  )
}
