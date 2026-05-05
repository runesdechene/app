import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useMapStore } from '../../../stores/mapStore'
import type { PlacesGeoJSON } from '../../../hooks/usePlaces'
import './VeilleurNamePills.css'

const MIN_ZOOM = 9

interface Bounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

interface Props {
  geojson: PlacesGeoJSON | null
  zoom: number
  bounds: Bounds | null
}

/**
 * V0.7 — Pilule sépia portant le nom du veilleur, centrée sous l'icône du lieu.
 * Visible uniquement en mode Coupe des Héritages (gating dans ExploreMap).
 * Remplace l'emblème faction par lieu — la signature humaine prend la place du symbole tribal.
 */
export const VeilleurNamePills = memo(function VeilleurNamePills({ geojson, zoom, bounds }: Props) {
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)

  const pills = useMemo(() => {
    if (!geojson || !bounds || zoom < MIN_ZOOM) return []
    const out: Array<{
      placeId: string
      userId: string
      longitude: number
      latitude: number
      name: string
      extraCount: number
    }> = []
    for (const f of geojson.features) {
      const name = f.properties.veilleurName
      const userId = f.properties.veilleurUserId
      if (!name || !userId || !f.properties.discovered) continue
      const [lng, lat] = f.geometry.coordinates
      if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) continue
      out.push({
        placeId: f.properties.id,
        userId,
        longitude: lng,
        latitude: lat,
        name,
        extraCount: f.properties.veilleurExtraCount ?? 0,
      })
    }
    return out
  }, [geojson, bounds, zoom])

  return (
    <>
      {pills.map(({ placeId, userId, longitude, latitude, name, extraCount }) => (
        <Marker
          key={placeId}
          longitude={longitude}
          latitude={latitude}
          anchor="top"
          offset={[0, 18]}
        >
          <div
            className="veilleur-name-pill"
            onClick={e => {
              e.stopPropagation()
              e.nativeEvent.stopPropagation()
              setSelectedPlayerId(userId)
            }}
          >
            <span className="veilleur-name-pill-text">{name}</span>
            {extraCount > 0 && (
              <span className="veilleur-name-pill-extra">+{extraCount}</span>
            )}
          </div>
        </Marker>
      ))}
    </>
  )
})
