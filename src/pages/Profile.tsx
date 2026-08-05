import { lock, savedEmail } from '../lib/auth'

export default function Profile() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="font-display text-4xl font-light italic">You</h1>
      <p className="mt-1 text-xs text-ink-faint">{savedEmail()}</p>

      <div className="mt-8 rounded-2xl bg-white p-4 shadow-card">
        <p className="text-sm font-medium">Personal colour analysis</p>
        <p className="mt-1 text-xs text-ink-faint">
          Coming in Phase 2 — a daylight selfie + short quiz finds the colours that suit you best.
        </p>
      </div>

      <button
        onClick={() => lock()}
        className="mt-8 w-full rounded-2xl border border-linen bg-white py-3.5 text-sm font-semibold text-ink shadow-card"
      >
        🔒 Lock closet
      </button>
    </div>
  )
}
