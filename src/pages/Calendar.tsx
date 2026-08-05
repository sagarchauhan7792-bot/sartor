import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/db'
import { listWearLogs, deleteWearLog, planOutfit, todayISO, type WearLog } from '../lib/wear'
import { loadProfile, toColorProfile, weightsOf, type SartorProfile } from '../lib/profileDb'
import { generateOutfits } from '../lib/outfit'
import { DEFAULT_OCCASIONS, type Item } from '../lib/taxonomy'
import StorageImg from '../components/StorageImg'
import OutfitCollage from '../components/OutfitCollage'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Calendar() {
  const [items, setItems] = useState<Item[]>([])
  const [logs, setLogs] = useState<WearLog[]>([])
  const [profile, setProfile] = useState<SartorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selected, setSelected] = useState<string>(todayISO())
  const [planning, setPlanning] = useState(false)
  const [planOccasion, setPlanOccasion] = useState('Casual')

  useEffect(() => {
    Promise.all([listItems(), listWearLogs(), loadProfile()])
      .then(([its, ls, p]) => { setItems(its); setLogs(ls); setProfile(p) })
      .finally(() => setLoading(false))
  }, [])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const logsByDate = useMemo(() => {
    const m = new Map<string, WearLog[]>()
    for (const l of logs) {
      const list = m.get(l.worn_on) ?? []
      list.push(l)
      m.set(l.worn_on, list)
    }
    return m
  }, [logs])

  // --- month grid, Monday-first ---
  const grid = useMemo(() => {
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + monthOffset)
    const year = base.getFullYear()
    const month = base.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lead = (first.getDay() + 6) % 7 // Sunday=0 → Monday-first
    const cells: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(todayISO(new Date(year, month, d)))
    }
    return {
      cells,
      label: base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    }
  }, [monthOffset])

  const selectedLogs = logsByDate.get(selected) ?? []
  const today = todayISO()
  const isFuture = selected > today

  const suggestions = useMemo(() => {
    if (!planning || items.length === 0) return []
    return generateOutfits(items, {
      occasion: planOccasion,
      profile: toColorProfile(profile),
      weights: weightsOf(profile),
      cleanOnly: false, // planning ahead — laundry will have been done
      count: 5,
    })
  }, [planning, items, planOccasion, profile])

  async function addPlan(outfitItems: Item[]) {
    await planOutfit(outfitItems, selected)
    const fresh = await listWearLogs()
    setLogs(fresh)
    setPlanning(false)
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-4xl font-light italic">Calendar</h1>
        <Link to="/lookbook" className="text-xs font-medium text-bronze-deep">
          Lookbook ›
        </Link>
      </header>

      {/* month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonthOffset((m) => m - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink-soft"
        >
          ‹
        </button>
        <p className="text-sm font-medium">{grid.label}</p>
        <button
          onClick={() => setMonthOffset((m) => m + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink-soft"
        >
          ›
        </button>
      </div>

      {/* grid */}
      <div className="mb-5 rounded-2xl bg-white p-3 shadow-card">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-center text-[10px] font-medium text-ink-faint">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.cells.map((date, i) => {
            if (!date) return <span key={`pad-${i}`} />
            const dayLogs = logsByDate.get(date) ?? []
            const planned = date > today
            const isToday = date === today
            const isSel = date === selected
            return (
              <button
                key={date}
                onClick={() => { setSelected(date); setPlanning(false) }}
                className={`relative aspect-square rounded-lg text-xs transition ${
                  isSel ? 'bg-ink text-ivory' : isToday ? 'bg-paper font-semibold' : 'text-ink-soft'
                }`}
              >
                {Number(date.slice(-2))}
                {dayLogs.length > 0 && (
                  <span
                    className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      isSel ? 'bg-ivory' : planned ? 'bg-bronze' : 'bg-sage'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-ink-faint">
          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-sage" /> worn</span>
          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-bronze" /> planned</span>
        </div>
      </div>

      {/* selected day */}
      <h2 className="mb-2 text-sm font-medium">
        {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long',
        })}
        {selected === today && <span className="ml-2 text-xs text-ink-faint">today</span>}
      </h2>

      {loading && <div className="h-24 animate-pulse rounded-2xl bg-paper" />}

      {!loading && selectedLogs.length === 0 && (
        <div className="rounded-2xl bg-white p-5 text-center shadow-card">
          <p className="text-sm text-ink-soft">
            {isFuture ? 'Nothing planned for this day.' : 'Nothing logged for this day.'}
          </p>
          {isFuture && (
            <button
              onClick={() => setPlanning(true)}
              className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold tracking-widest text-ivory uppercase"
            >
              Plan an outfit
            </button>
          )}
        </div>
      )}

      {selectedLogs.map((log) => {
        const its = log.item_ids.map((id) => byId.get(id)).filter(Boolean) as Item[]
        return (
          <div key={log.id} className="mb-3 rounded-2xl bg-white p-3 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                {log.worn_on > today ? 'Planned' : 'Worn'}
              </p>
              <button
                onClick={async () => {
                  await deleteWearLog(log.id)
                  setLogs((l) => l.filter((x) => x.id !== log.id))
                }}
                className="text-xs text-danger"
              >
                Remove
              </button>
            </div>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {its.map((i) => (
                <Link key={i.id} to={`/item/${i.id}`} className="w-16 shrink-0">
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-paper">
                    <StorageImg
                      path={i.cutout_path ?? i.photo_path}
                      alt={i.name}
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                  <p className="mt-1 truncate text-[10px] text-ink-soft">{i.name}</p>
                </Link>
              ))}
              {its.length === 0 && (
                <p className="py-4 text-xs text-ink-faint">These pieces are no longer in your closet.</p>
              )}
            </div>
          </div>
        )
      })}

      {/* planning sheet */}
      {planning && (
        <div className="mt-4">
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {[...DEFAULT_OCCASIONS, ...(profile?.custom_occasions ?? [])].map((o) => (
              <button
                key={o}
                onClick={() => setPlanOccasion(o)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
                  planOccasion === o ? 'bg-ink text-ivory' : 'bg-paper text-ink-soft'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          {suggestions.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              Not enough pieces to build an outfit yet.
            </p>
          )}
          <div className="flex flex-col gap-5">
            {suggestions.slice(0, 3).map((o, n) => (
              <div key={n}>
                <OutfitCollage items={o.items} />
                <p className="mt-2 text-xs text-ink-soft">
                  {o.items.map((i) => i.name).join(' · ')}
                </p>
                <button
                  onClick={() => addPlan(o.items)}
                  className="mt-2 w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-ivory shadow-float"
                >
                  Plan this for {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPlanning(false)}
            className="mt-4 w-full py-2 text-center text-xs text-ink-soft underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="h-6" />
    </div>
  )
}
