import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useVeillesStore } from '../../stores/veillesStore'
import { useMapStore } from '../../stores/mapStore'
import type { PlacesGeoJSON } from '../../hooks/usePlaces'
import './VeilleMarkers.css'

interface Props {
  geojson: PlacesGeoJSON | null
}

/**
 * Pile d'avatars (1 à N) en haut-droite de chaque lieu veillé.
 * Chaque avatar a un cadre de la couleur de sa faction et l'emblème de la faction
 * en badge superposé. Pour les expéditions, plusieurs têtes en pile diagonale.
 */
export const VeilleMarkers = memo(function VeilleMarkers({ geojson }: Props) {
  const veilles = useVeillesStore(s => s.veilles)
  const setSelectedPlaceId = useMapStore(s => s.setSelectedPlaceId)

  const markers = useMemo(() => {
    if (!geojson) return []
    const out: Array<{ id: string; longitude: number; latitude: number; veille: NonNullable<ReturnType<typeof veilles.get>> }> = []
    for (const f of geojson.features) {
      const v = veilles.get(f.properties.id)
      if (v) {
        out.push({
          id: f.properties.id,
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1],
          veille: v,
        })
      }
    }
    return out
  }, [geojson, veilles])

  return (
    <>
      {markers.map(({ id, longitude, latitude, veille }) => {
        return (
          <Marker
            key={id}
            longitude={longitude}
            latitude={latitude}
            anchor="bottom-left"
          >
            <div
              className="veille-markers-stack"
              onClick={() => setSelectedPlaceId(id)}
              title={veille.members.map(m => m.displayName.trim()).join(', ')}
            >
              {veille.members.slice(0, 4).map((m, i) => (
                <div
                  key={m.userId}
                  className="veille-markers-avatar-wrap"
                  style={{
                    '--frame-color': m.factionColor ?? '#8a6f4a',
                    transform: `translate(${i * 12}px, ${i * -12}px)`,
                    zIndex: 10 - i,
                  } as React.CSSProperties}
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="veille-markers-avatar" />
                  ) : (
                    <div className="veille-markers-avatar veille-markers-avatar-fallback" />
                  )}
                  {m.factionPattern && (
                    <img src={m.factionPattern} alt="" className="veille-markers-emblem" />
                  )}
                </div>
              ))}
              {veille.members.length > 4 && (
                <div className="veille-markers-more" style={{ transform: 'translate(48px, -48px)' }}>
                  +{veille.members.length - 4}
                </div>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
})
