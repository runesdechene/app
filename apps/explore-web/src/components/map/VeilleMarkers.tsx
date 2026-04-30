import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { useVeillesStore } from '../../stores/veillesStore'
import { useMapStore } from '../../stores/mapStore'
import type { PlacesGeoJSON } from '../../hooks/usePlaces'
import type { MapVeilleMember } from '../../types/veille'
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
  /** Territoires (output du worker) : on itère pour grouper les veilles par territoire,
   *  on dédupe par userId — évite de répéter le même avatar si une personne veille
   *  plusieurs lieux du même blob. */
  territories: FeatureCollection<Polygon | MultiPolygon> | null
  /** GeoJSON des lieux : on en extrait les coordonnées (placeId → [lng, lat]). */
  geojson: PlacesGeoJSON | null
  zoom: number
  bounds: Bounds | null
}

/**
 * Pile d'avatars (1 à N) en haut-droite de chaque lieu veillé.
 * Chaque avatar a un cadre de la couleur de sa faction et l'emblème de la faction
 * en badge superposé. Pour les expéditions, plusieurs têtes en pile diagonale.
 */
export const VeilleMarkers = memo(function VeilleMarkers({ territories, geojson, zoom, bounds }: Props) {
  const veilles = useVeillesStore(s => s.veilles)
  const setSelectedPlaceId = useMapStore(s => s.setSelectedPlaceId)

  /** 1 avatar par territoire, ancré sur la position GPS du lieu le plus récemment veillé
   *  (= pas de drift centroïde, et pas de répétition même-personne sur N lieux mergés).
   *  Le lead avatar est le 1er membre du dernier plantage. Badge +N affiche le nombre de
   *  veilleurs uniques dans le territoire (toutes places + tous membres, dédupliqués). */
  const markers = useMemo(() => {
    if (!territories || !geojson || !bounds || zoom < MIN_ZOOM_FOR_AVATARS) return []

    // Lookup placeId → [lng, lat]
    const placeCoords = new Map<string, [number, number]>()
    for (const f of geojson.features) {
      placeCoords.set(f.properties.id, [f.geometry.coordinates[0], f.geometry.coordinates[1]])
    }

    const out: Array<{
      key: string
      placeId: string
      longitude: number
      latitude: number
      lead: MapVeilleMember
      uniqueCount: number
    }> = []

    for (const t of territories.features) {
      const props = t.properties as Record<string, unknown>
      let placeIds: string[] = []
      try { placeIds = JSON.parse((props.placeIds as string) || '[]') } catch { /* ignore */ }
      if (placeIds.length === 0) continue

      // Trouver le lieu le plus récemment veillé dans ce territoire + accumuler les membres uniques
      let mostRecentPlaceId = ''
      let mostRecentTs = -Infinity
      const uniqueUserIds = new Set<string>()
      let leadCandidate: MapVeilleMember | null = null

      for (const pid of placeIds) {
        const v = veilles.get(pid)
        if (!v) continue
        for (const m of v.members) uniqueUserIds.add(m.userId)
        const ts = new Date(v.plantedAt).getTime()
        if (ts > mostRecentTs) {
          mostRecentTs = ts
          mostRecentPlaceId = pid
          leadCandidate = v.members[0] ?? null
        }
      }
      if (!leadCandidate || !mostRecentPlaceId) continue

      const coords = placeCoords.get(mostRecentPlaceId)
      if (!coords) continue
      const [lng, lat] = coords
      // Viewport filter
      if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) continue

      out.push({
        key: String(t.id ?? mostRecentPlaceId),
        placeId: mostRecentPlaceId,
        longitude: lng,
        latitude: lat,
        lead: leadCandidate,
        uniqueCount: uniqueUserIds.size,
      })
    }
    return out
  }, [territories, geojson, veilles, bounds, zoom])

  return (
    <>
      {markers.map(({ key, placeId, longitude, latitude, lead, uniqueCount }) => {
        const extraCount = uniqueCount - 1
        const title = extraCount > 0 ? `${lead.displayName.trim()} (+${extraCount} autre${extraCount > 1 ? 's' : ''})` : lead.displayName.trim()
        // Taille proportionnelle au zoom, réduite à 70% de la taille des icônes lieux
        // (~15px à zoom 9, ~31px à zoom 12) pour rester discret à côté de l'icône lieu.
        const sizePx = Math.round(Math.max(15, Math.min(31, 15 + (zoom - 9) * 5)))
        return (
          <Marker
            key={key}
            longitude={longitude}
            latitude={latitude}
            anchor="bottom-left"
            offset={[Math.round(sizePx * 0.3), -Math.round(sizePx * 0.3)]}
          >
            <div
              className="veille-marker"
              onClick={() => setSelectedPlaceId(placeId)}
              title={title}
              style={{
                '--frame-color': lead.factionColor ?? '#8a6f4a',
                '--avatar-size': `${sizePx}px`,
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
