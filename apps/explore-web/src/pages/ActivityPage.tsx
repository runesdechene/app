import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { MobileSelectionModals } from '../components/navigation/MobileSelectionModals'
import { MapActivityList } from '../components/home/MapActivityList'
import { markActivitySeen } from '../hooks/useUnreadActivityCount'
import './ActivityPage.css'

export default function ActivityPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Runes de Chêne — Activité'
    // Marquer toute l'activité comme lue à l'entrée de la page
    // → reset le badge rouge sur l'onglet Activité.
    markActivitySeen()
  }, [])

  if (!user) return null

  return (
    <div className="activity-page">
      <MobileTopBar />
      <main className="activity-page-scroll">
        <h1 className="activity-page-title">Activité de la carte</h1>
        <MapActivityList limit={50} />
      </main>
      <BottomTabbar />
      <MobileSelectionModals />
    </div>
  )
}
