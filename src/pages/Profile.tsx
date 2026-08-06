import { useEffect, useRef, useState } from 'react'
import { lock, savedEmail } from '../lib/auth'
import {
  loadProfile, saveProfile, toColorProfile, listSavedOutfits, type SartorProfile,
} from '../lib/profileDb'
import { listItems } from '../lib/db'
import ProfileHeader from '../components/ProfileHeader'
import {
  deriveProfile, sampleSelfie, SEASON_INFO, bestColorsFor,
  type QuizAnswers, type ColorProfile,
} from '../lib/season'
import { compressPhoto } from '../lib/images'
import { uploadImage } from '../lib/db'
import { DEFAULT_OCCASIONS } from '../lib/taxonomy'
import { savedHfToken, setHfToken } from '../lib/tryon'

const QUIZ: {
  key: keyof QuizAnswers
  question: string
  options: { value: string; label: string }[]
}[] = [
  {
    key: 'metal',
    question: 'Which looks better on you?',
    options: [
      { value: 'gold', label: 'Gold jewellery' },
      { value: 'silver', label: 'Silver jewellery' },
      { value: 'both', label: 'Both work' },
    ],
  },
  {
    key: 'sunReaction',
    question: 'In strong sun, your skin usually…',
    options: [
      { value: 'tan', label: 'Tans easily' },
      { value: 'burn', label: 'Burns first' },
      { value: 'both', label: 'Burns then tans' },
    ],
  },
  {
    key: 'veins',
    question: 'The veins on your wrist look…',
    options: [
      { value: 'green', label: 'Greenish' },
      { value: 'blue', label: 'Blue / purple' },
      { value: 'unsure', label: 'Hard to tell' },
    ],
  },
  {
    key: 'bestNeutral',
    question: 'Which white suits you more?',
    options: [
      { value: 'cream', label: 'Cream / off-white' },
      { value: 'white', label: 'Crisp pure white' },
      { value: 'unsure', label: 'No difference' },
    ],
  },
]

/** A blank profile, for the first edit before one exists on the server. */
function emptyProfile(): SartorProfile {
  return {
    display_name: null,
    avatar_path: null,
    color_season: null,
    undertone: null,
    depth: null,
    contrast: null,
    custom_occasions: [],
    pref_weights: { colors: {}, types: {}, harmonies: {} },
    selfie_path: null,
  }
}

export default function Profile() {
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [quizOpen, setQuizOpen] = useState(false)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [skin, setSkin] = useState<{ hex: string; hairHex: string } | null>(null)
  const [selfieMsg, setSelfieMsg] = useState<string | null>(null)
  const [newOccasion, setNewOccasion] = useState('')
  const [hfToken, setHfTokenInput] = useState(savedHfToken() ?? '')
  const [tokenSaved, setTokenSaved] = useState(false)
  const selfieRef = useRef<HTMLInputElement>(null)

  const [stats, setStats] = useState({ pieces: 0, looks: 0, wears: 0 })

  useEffect(() => {
    loadProfile().then((p) => { setProfile(p); setLoading(false) })
    Promise.all([listItems(), listSavedOutfits()])
      .then(([items, looks]) =>
        setStats({
          pieces: items.length,
          looks: looks.length,
          wears: items.reduce((s, i) => s + (i.times_worn ?? 0), 0),
        }),
      )
      .catch(() => {})
  }, [])

  const colorProfile = toColorProfile(profile)

  async function onSelfie(files: FileList | null) {
    if (!files?.[0]) return
    setSelfieMsg('Reading your colouring…')
    try {
      const compressed = await compressPhoto(files[0], 800)
      const sampled = await sampleSelfie(compressed)
      if (!sampled) {
        setSelfieMsg("Couldn't find a face clearly — try a daylight photo facing the camera, or just use the quiz.")
        return
      }
      setSkin(sampled)
      setSelfieMsg(null)
      const path = await uploadImage(compressed, 'photo')
      await saveProfile({ selfie_path: path })
      setQuizOpen(true)
    } catch {
      setSelfieMsg('That photo could not be processed. The quiz alone works fine too.')
    }
  }

  async function finishQuiz() {
    const full: QuizAnswers = {
      metal: (answers.metal as QuizAnswers['metal']) ?? 'both',
      sunReaction: (answers.sunReaction as QuizAnswers['sunReaction']) ?? 'both',
      veins: (answers.veins as QuizAnswers['veins']) ?? 'unsure',
      bestNeutral: (answers.bestNeutral as QuizAnswers['bestNeutral']) ?? 'unsure',
    }
    const derived = deriveProfile(full, skin ?? undefined)
    await saveProfile({
      color_season: derived.season,
      undertone: derived.undertone,
      depth: derived.depth,
      contrast: derived.contrast,
    })
    setProfile((p) => ({
      ...(p ?? emptyProfile()),
      color_season: derived.season,
      undertone: derived.undertone,
      depth: derived.depth,
      contrast: derived.contrast,
    } as SartorProfile))
    setQuizOpen(false)
    setAnswers({})
  }

  async function addOccasion() {
    const name = newOccasion.trim()
    if (!name) return
    if ([...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])].includes(name)) {
      setNewOccasion('')
      return
    }
    const next = [...(profile?.custom_occasions ?? []), name]
    await saveProfile({ custom_occasions: next })
    setProfile((p) => (p ? { ...p, custom_occasions: next } : p))
    setNewOccasion('')
  }

  async function removeOccasion(name: string) {
    const next = (profile?.custom_occasions ?? []).filter((o) => o !== name)
    await saveProfile({ custom_occasions: next })
    setProfile((p) => (p ? { ...p, custom_occasions: next } : p))
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <ProfileHeader
        avatarPath={profile?.avatar_path ?? null}
        displayName={profile?.display_name ?? null}
        email={savedEmail()}
        stats={stats}
        onChange={(patch) =>
          setProfile((p) => ({ ...(p ?? emptyProfile()), ...patch }) as SartorProfile)
        }
      />

      {/* ---------- colour profile ---------- */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
          Your colours
        </p>

        {loading && <div className="mt-3 h-16 animate-pulse rounded-xl bg-paper" />}

        {!loading && !colorProfile && !quizOpen && (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Find out which colours actually suit your skin tone. Takes about a minute, and
              every outfit suggestion gets sharper afterwards.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => selfieRef.current?.click()}
                className="rounded-xl bg-ink py-3 text-xs font-semibold tracking-widest text-ivory uppercase"
              >
                📷 Use a daylight selfie
              </button>
              <button
                onClick={() => setQuizOpen(true)}
                className="rounded-xl border border-linen py-3 text-xs font-semibold tracking-widest text-ink uppercase"
              >
                Answer 4 questions instead
              </button>
            </div>
            {selfieMsg && <p className="mt-3 text-xs text-ink-soft">{selfieMsg}</p>}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              The photo is analysed on your device and stored privately in your own closet.
            </p>
          </>
        )}

        {quizOpen && (
          <div className="mt-3 flex flex-col gap-5">
            {skin && (
              <div className="flex items-center gap-3 rounded-xl bg-paper p-3">
                <span className="h-9 w-9 rounded-full border-2 border-white shadow-card" style={{ background: skin.hex }} />
                <p className="text-xs text-ink-soft">Skin tone read from your selfie — the questions refine it.</p>
              </div>
            )}
            {QUIZ.map((q) => (
              <div key={q.key}>
                <p className="mb-2 text-sm font-medium">{q.question}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: o.value }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        answers[q.key] === o.value ? 'bg-bronze text-white' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={finishQuiz}
              disabled={Object.keys(answers).length < 4}
              className="rounded-xl bg-ink py-3 text-xs font-semibold tracking-widest text-ivory uppercase disabled:opacity-40"
            >
              See my palette
            </button>
          </div>
        )}

        {!loading && colorProfile && !quizOpen && (
          <PaletteResult
            profile={colorProfile}
            onRedo={() => { setQuizOpen(true); setAnswers({}) }}
          />
        )}

        <input
          ref={selfieRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onSelfie(e.target.files)}
        />
      </section>

      {/* ---------- custom occasions ---------- */}
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
          Your occasions
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEFAULT_OCCASIONS.map((o) => (
            <span key={o} className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink-soft">{o}</span>
          ))}
          {(profile?.custom_occasions ?? []).map((o) => (
            <button
              key={o}
              onClick={() => removeOccasion(o)}
              className="rounded-full bg-bronze/15 px-3 py-1.5 text-xs text-bronze-deep"
              title="Tap to remove"
            >
              {o} ✕
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newOccasion}
            onChange={(e) => setNewOccasion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addOccasion() }}
            placeholder="Add your own, e.g. Client meeting"
            className="flex-1 rounded-xl border border-linen bg-white px-3 py-2 text-sm outline-none focus:border-bronze"
          />
          <button onClick={addOccasion} className="rounded-xl bg-ink px-4 text-sm font-semibold text-ivory">
            Add
          </button>
        </div>
      </section>

      {/* ---------- optional try-on token ---------- */}
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
        <p className="text-[11px] font-semibold tracking-[0.15em] text-ink-faint uppercase">
          Try-on quality
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The open try-on service currently refuses requests from India, so seeing an outfit on
          a real body needs a free Hugging Face token. Everything else in Sartor works without it.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={hfToken}
            onChange={(e) => setHfTokenInput(e.target.value)}
            placeholder="hf_… (optional)"
            className="min-w-0 flex-1 rounded-xl border border-linen bg-white px-3 py-2 text-sm outline-none focus:border-bronze"
          />
          <button
            onClick={() => {
              setHfToken(hfToken.trim() || null)
              setTokenSaved(true)
              setTimeout(() => setTokenSaved(false), 1800)
            }}
            className="shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-ivory"
          >
            {tokenSaved ? '✓' : 'Save'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          Create one at huggingface.co/settings/tokens with read access. It stays on this device.
        </p>
      </section>

      <button
        onClick={() => lock()}
        className="mt-6 mb-6 w-full rounded-2xl border border-linen bg-white py-3.5 text-sm font-semibold text-ink shadow-card"
      >
        🔒 Lock closet
      </button>
    </div>
  )
}

function PaletteResult({ profile, onRedo }: { profile: ColorProfile; onRedo: () => void }) {
  const info = SEASON_INFO[profile.season]
  const colors = bestColorsFor(profile)
  return (
    <div className="mt-3">
      <p className="font-display text-2xl italic capitalize">{profile.season} — {info.title}</p>
      <p className="mt-1 text-[11px] tracking-wide text-ink-faint">
        {profile.undertone} undertone · {profile.depth} depth · {profile.contrast} contrast
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{info.blurb}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <span
            key={c.name}
            title={c.name}
            className="h-7 w-7 rounded-full border-2 border-white shadow-card"
            style={{ background: c.hex }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">{info.avoid}</p>
      <button onClick={onRedo} className="mt-4 text-xs font-medium text-bronze-deep underline">
        Redo the analysis
      </button>
    </div>
  )
}
