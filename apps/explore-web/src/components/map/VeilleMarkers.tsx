import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useVeillesStore } from '../../stores/veillesStore'
import { useMapStore } from '../../stores/mapStore'
import type { PlacesGeoJSON } from '../../hooks/usePlaces'
import './VeilleMarkers.css'

/** Seuil de zoom : en dessous, le sceau emblème (territoryEmblemLayer) prend le relais. */
const MIN_ZOOM_FOR_AVATARS = 9

interface Bounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

interface Props {
  /** GeoJSON des lieux : on lit lng/lat depuis chaque feature, pas le centroïde du territoire
   *  (le centroïde merged-blob plante l'avatar dans un trou quand des lieux sont voisins). */
  geojson: PlacesGeoJSON | null
  zoom: number
  bounds: Bounds | null
}

/**
 * Pile d'avatars (1 à N) en haut-droite de chaque lieu veillé.
 * Chaque avatar a un cadre de la couleur de sa faction et l'emblème de la faction
 * en badge superposé. Pour les expéditions, plusieurs têtes en pile diagonale.
 */
export const VeilleMarkers = memo(function VeilleMarkers({ geojson, zoom, bounds }: Props) {
  const veilles = useVeillesStore(s => s.veilles)
  const setSelectedPlaceId = useMapStore(s => s.setSelectedPlaceId)

  /** Option B : 1 avatar par lieu veillé, ancré sur les coordonnées GPS du lieu.
   *  Visible à partir de zoom 9 (sinon le sceau emblème de territoryEmblemLayer suffit).
   *  Si > 1 membre dans l'expedition, badge "+N" dans le coin. */
  const markers = useMemo(() => {
    if (!geojson || !bounds || zoom < MIN_ZOOM_FOR_AVATARS) return []
    const out: Array<{
      placeId: string
      longitude: number
      latitude: number
      veille: NonNullable<ReturnType<typeof veilles.get>>
    }> = []

    for (const f of geojson.features) {
      const v = veilles.get(f.properties.id)
      if (!v) continue
      const [lng, lat] = f.geometry.coordinates
      // Viewport filter
      if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) continue
      out.push({ placeId: f.properties.id, longitude: lng, latitude: lat, veille: v })
    }
    return out
  }, [geojson, veilles, bounds, zoom])

  return (
    <>
      {markers.map(({ placeId, longitude, latitude, veille }) => {
        const members = veille.members
        const lead = members[0]
        const extraCount = members.length - 1
        const allNames = members.map(m => m.displayName.trim()).join(', ')
        // Taille proportionnelle au zoom (cohérent avec icon-size du place iconLayer :
        // ~30px à zoom 9, ~44px à zoom 12). Ne dépasse jamais la taille des icônes lieux.
        const sizePx = Math.round(Math.max(22, Math.min(44, 22 + (zoom - 9) * 7)))
        return (
          <Marker
            key={placeId}
            longitude={longitude}
            latitude={latitude}
            anchor="center"
          >
            <div
              className="veille-marker"
              onClick={() => setSelectedPlaceId(placeId)}
              title={allNames}
              style={{
                '--frame-color': lead.factionColor ?? '#8a6f4a',
                '--avatar-size': `${sizePx}px`,
                '--border-w': `${Math.max(2, Math.round(sizePx / 14))}px`,
              } as React.CSSProperties}
            >
              {lead.avatarUrl ? (
                <img src={lead.avatarUrl} alt="" className="veille-marker-avatar" />
              ) : (
                <div className="veille-marker-avatar veille-marker-avatar-fallback" />
              )}
              {extraCount > 0 && (
                <span className="veille-marker-badge">+{extraCount}</span>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
})
