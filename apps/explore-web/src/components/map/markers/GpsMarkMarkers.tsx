import { memo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { useMapStore } from '../../../stores/mapStore'
import './GpsMarkMarkers.css'

export const GpsMarkMarkers = memo(function GpsMarkMarkers() {
  const marks = useGpsMarksStore(s => s.marks)
  const setOpenGpsMarkId = useMapStore(s => s.setOpenGpsMarkId)

  return (
    <>
      {marks.map((m) => (
        <Marker key={m.id} longitude={m.longitude} latitude={m.latitude} anchor="bottom">
          <button
            className="gps-mark-pin"
            title={m.title ?? 'Marque GPS à compléter'}
            onClick={(e) => { e.stopPropagation(); setOpenGpsMarkId(m.id) }}
          >📍</button>
        </Marker>
      ))}
    </>
  )
})
