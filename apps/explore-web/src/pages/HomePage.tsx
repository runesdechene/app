import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { StatsBar } from '../components/home/StatsBar'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()

  // Initialiser fog state + énergie + couronnes (mêmes hooks que MapPage)
  usePlayer()
  useResourceTimers()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!user) return null

  return (
    <div className="home-page">
      <StatsBar />
      <p className="home-page-skeleton">Sections à venir…</p>
      <BottomTabbar />
    </div>
  )
}
