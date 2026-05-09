import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { ActivityFeed } from '../components/home/ActivityFeed'
import './ActivityPage.css'

export default function ActivityPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Runes de Chêne — Activité'
  }, [])

  if (!user) return null

  return (
    <div className="activity-page">
      <MobileTopBar />
      <main className="activity-page-scroll">
        <h1 className="activity-page-title">Activité de la carte</h1>
        <ActivityFeed limit={30} />
      </main>
      <BottomTabbar />
    </div>
  )
}
