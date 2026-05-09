import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!user) return null

  return (
    <div className="home-page">
      <p className="home-page-skeleton">HomePage — sections à venir</p>
      <BottomTabbar />
    </div>
  )
}
