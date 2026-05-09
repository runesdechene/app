import { useEffect } from 'react'
import { MapActivityList } from '../components/home/MapActivityList'
import { markActivitySeen } from '../hooks/useUnreadActivityCount'
import './ActivityPage.css'

/**
 * Page /activite — feed plein écran de l'activité publique de la carte.
 * MobileTopBar / BottomTabbar / modales / hooks d'init sont dans MobileLayout.
 */
export default function ActivityPage() {
  useEffect(() => {
    document.title = 'Runes de Chêne — Activité'
    markActivitySeen()
  }, [])

  return (
    <main className="activity-page-scroll">
      <h1 className="activity-page-title">Activité de la carte</h1>
      <MapActivityList limit={50} />
    </main>
  )
}
