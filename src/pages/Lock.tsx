import { useState } from 'react'
import { savedEmail, setup, unlock } from '../lib/auth'

export default function Lock() {
  const firstRun = savedEmail() === null
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setBusy(true)
    setError(null)
    const err = firstRun ? await setup(email.trim(), pin) : await unlock(pin)
    setBusy(false)
    if (err === 'CONFIRM_EMAIL') { setNeedsConfirm(true); return }
    if (err) setError(err)
    // success: onAuthStateChange in App flips to the closet
  }

  if (needsConfirm) {
    return (
      <Shell>
        <p className="max-w-xs text-center text-sm leading-relaxed text-ink-soft">
          Check <span className="font-semibold text-ink">{email}</span> for a
          confirmation link, then come back and unlock with your PIN.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-4">
        {firstRun && (
          <input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-linen bg-white px-4 py-3 text-center text-sm outline-none focus:border-bronze"
          />
        )}
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          placeholder={firstRun ? 'Choose a PIN (4+ digits)' : 'PIN'}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="rounded-xl border border-linen bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-bronze"
          autoFocus={!firstRun}
        />
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <button
          disabled={busy}
          className="rounded-xl bg-ink py-3 text-sm font-semibold tracking-widest text-ivory uppercase disabled:opacity-50"
        >
          {busy ? '…' : firstRun ? 'Create closet' : 'Unlock'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-10 bg-ivory px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl font-light italic">Sartor</h1>
        <p className="mt-2 text-[11px] font-medium tracking-[0.35em] text-ink-faint uppercase">
          Your wardrobe, curated
        </p>
      </div>
      {children}
    </div>
  )
}
