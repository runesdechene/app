import { useEffect } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useExpeditionsStore } from '../../../stores/expeditionsStore'
import { listExpeditionsForMap } from '../../../lib/expeditionsApi'
import { ExpeditionBanner } from './ExpeditionBanner'

/**
 * Pose une bannière sur la carte pour chaque expédition 'published' ou 'passed'.
 * Les 'passed' (RDV dépassé) sont rendues en N&B + fade par ExpeditionBanner ;
 * elles quittent la carte automatiquement à J+7 (cron archive_passed_voyages).
 * Tap → ouvre la modale via expeditionsStore.requestOpenExpedition.
 */
export function ExpeditionBanners() {
  const mapBanners = useExpeditionsStore((s) => s.mapBanners)
  const setMapBanners = useExpeditionsStore((s) => s.setMapBanners)
  const requestOpen = useExpeditionsStore((s) => s.requestOpenExpedition)

  // Charge la liste au mount (et la maintient via setInterval léger)
  useEffect(() => {
    let cancelled = false
    function load() {
      listExpeditionsForMap()
        .then((list) => { if (!cancelled) setMapBanners(list) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60_000) // refresh toutes les minutes
    return () => { cancelled = true; clearInterval(interval) }
  }, [setMapBanners])

  return (
    <>
      {mapBanners.map((e) => (
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
