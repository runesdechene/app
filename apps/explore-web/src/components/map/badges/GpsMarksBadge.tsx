import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function GpsMarksBadge() {
  const marks = useGpsMarksStore(s => s.marks)
  const userPosition = usePlayerStore(s => s.userPosition)

  if (marks.length === 0) return null

  function flyToNearest() {
    if (marks.length === 0) return
    const target = userPosition
      ? [...marks].sort(
          (a, b) =>
            haversineM(userPosition.lat, userPosition.lng, a.latitude, a.longitude) -
            haversineM(userPosition.lat, userPosition.lng, b.latitude, b.longitude)
        )[0]
      : marks[0]
    useMapStore.getState().requestFlyTo({ lng: target.longitude, lat: target.latitude })
  }

  return (
    <div
      className="notoriety-badge gps-marks-badge"
      onClick={(e) => { e.stopPropagation(); flyToNearest() }}
      style={{ cursor: 'pointer' }}
      title="Marques GPS à compléter — voler à la plus proche"
    >
      <span className="notoriety-icon" aria-hidden>📍</span>
      <span className="notoriety-value">{marks.length}</span>
    </div>
  )
}
