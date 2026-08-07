import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Lock from './pages/Lock'
import Closet from './pages/Closet'
import AddItem from './pages/AddItem'
import ItemDetail from './pages/ItemDetail'
import DressMe from './pages/DressMe'
import Lookbook from './pages/Lookbook'
import Profile from './pages/Profile'
import Insights from './pages/Insights'
import Calendar from './pages/Calendar'
import FromSelfie from './pages/FromSelfie'
import FromUrl from './pages/FromUrl'
import QuickAdd from './pages/QuickAdd'
import NavBar from './components/NavBar'

export default function App() {
  const [session, setSession] = useState<'loading' | 'locked' | 'open'>('loading')
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? 'open' : 'locked')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? 'open' : 'locked')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-ivory">
        <span className="font-display text-3xl italic text-ink-faint">Sartor</span>
      </div>
    )
  }

  if (session === 'locked') return <Lock />

  const hideNav = location.pathname.startsWith('/add')

  return (
    <div className="min-h-dvh bg-ivory pb-24">
      <Routes>
        <Route path="/" element={<Closet />} />
        <Route path="/add" element={<QuickAdd />} />
        <Route path="/add/manual" element={<AddItem />} />
        <Route path="/add/selfie" element={<FromSelfie />} />
        <Route path="/add/url" element={<FromUrl />} />
        <Route path="/item/:id" element={<ItemDetail />} />
        <Route path="/dressme" element={<DressMe />} />
        <Route path="/lookbook" element={<Lookbook />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {!hideNav && <NavBar />}
    </div>
  )
}
