import { useEffect } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useExpeditionsStore } from '../../../stores/expeditionsStore'
import { listUpcomingExpeditions } from '../../../lib/expeditionsApi'
import { ExpeditionBanner } from './ExpeditionBanner'

/**
 * Pose une bannière sur la carte pour chaque expédition publiée.
 * Tap → demande l'ouverture de la modale via expeditionsStore.requestOpenExpedition
 * (consommé par ExpeditionsHud monté dans MapPage).
 *
 * V1 : marker DOM pour chaque bannière (HTML rendu par @vis.gl/react-maplibre).
 * V1.5 différé : layer WebGL natif au dézoom < 8.
 */
export function ExpeditionBanners() {
  const upcoming = useExpeditionsStore((s) => s.upcoming)
  const setUpcoming = useExpeditionsStore((s) => s.setUpcoming)
  const requestOpen = useExpeditionsStore((s) => s.requestOpenExpedition)

  // Charge la liste au mount (et la maintient via setInterval léger)
  useEffect(() => {
    let cancelled = false
    function load() {
      listUpcomingExpeditions()
        .then((list) => { if (!cancelled) setUpcoming(list) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60_000) // refresh toutes les minutes
    return () => { cancelled = true; clearInterval(interval) }
  }, [setUpcoming])

  return (
    <>
      {upcoming.map((e) => (
        <Marker
          key={e.id}
          longitude={e.rdv_lng}
          latitude={e.rdv_lat}
          anchor="bottom"
        >
          <ExpeditionBanner
            expedition={e}
            onClick={() => requestOpen(e.id)}
          />
        </Marker>
      ))}
    </>
  )
}
