import { useState, useCallback } from 'react'
import HomePage from './HomePage'
import MapPage from './MapPage'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { useMapStore } from '../stores/mapStore'
import { useAuth } from '../hooks/useAuth'
import { PlacePanel } from '../components/places/views/PlacePanel'
import './MainShell.css'

const COLLAPSE_STORAGE_KEY = 'home-panel-collapsed-v1'

interface Props {
  /** "home" → mobile rend HomePage, desktop rend split avec panel ouvert.
   *  "map"  → mobile rend MapPage, desktop rend split avec panel ouvert (la route /carte
   *           desktop est interceptée plus haut pour rediriger /accueil — fallback ici). */
  view: 'home' | 'map'
}

/**
 * MainShell — orchestrateur principal de l'app loggée.
 *
 * Mobile : rend HomePage XOR MapPage selon `view` + BottomTabbar (montée par chaque page).
 * Desktop : rend les 2 côte-à-côte. Panel gauche fixe (HomePage), carte à droite (flex).
 *           Le panel est rétractable via un bouton chevron persisté en localStorage.
 */
export function MainShell({ view }: Props) {
  const isDesktop = useIsDesktop()
  const { user } = useAuth()
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  })

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  if (!isDesktop) {
    return view === 'home' ? <HomePage /> : <MapPage />
  }

  // Desktop : split view permanent
  return (
    <div className={`main-shell${collapsed ? ' main-shell-collapsed' : ''}`}>
      <aside className="main-shell-panel" aria-hidden={collapsed}>
        <div className="main-shell-panel-inner">
          <HomePage />
          {/* PlacePanel monté ici en mode "in-panel" sur desktop split.
              Quand selectedPlaceId est non-null, le panel se superpose à HomePage. */}
          <PlacePanel
            placeId={selectedPlaceId}
            onClose={() => setSelectedPlaceId(null)}
            userEmail={user?.email ?? null}
            mode="in-panel"
          />
        </div>
      </aside>

      <button
        type="button"
        className="main-shell-toggle"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Déployer le panneau' : 'Rétracter le panneau'}
        title={collapsed ? 'Déployer le panneau' : 'Rétracter le panneau'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      <main className="main-shell-map">
        <MapPage />
      </main>
    </div>
  )
}
