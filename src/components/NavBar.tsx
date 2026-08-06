import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { loadProfile } from '../lib/profileDb'
import StorageImg from './StorageImg'

const tabs = [
  { to: '/', label: 'Closet', icon: '▤' },
  { to: '/dressme', label: 'Dress me', icon: '✦' },
  { to: '/add', label: 'Add', icon: '+', big: true },
  { to: '/lookbook', label: 'Looks', icon: '❍' },
  { to: '/profile', label: 'You', icon: '◐' },
]

export default function NavBar() {
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadProfile()
      .then((p) => { if (live) setAvatar(p?.avatar_path ?? null) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-linen bg-ivory/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map((t) =>
          t.big ? (
            <NavLink
              key={t.to}
              to={t.to}
              className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-ink text-2xl font-light text-ivory shadow-float"
              aria-label="Add item"
            >
              +
            </NavLink>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium tracking-wide ${
                  isActive ? 'text-ink' : 'text-ink-faint'
                }`
              }
            >
              {({ isActive }) =>
                <>
                  {t.to === '/profile' && avatar ? (
                    <span
                      className={`h-4 w-4 overflow-hidden rounded-full border ${
                        isActive ? 'border-ink' : 'border-linen'
                      }`}
                    >
                      <StorageImg path={avatar} alt="" className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <span className="text-base leading-none">{t.icon}</span>
                  )}
                  {t.label}
                </>
              }
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}
