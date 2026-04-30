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

  /** 1 avatar par veilleur unique d'un territoire, ancré sur LE lieu où ce veilleur a planté
   *  le plus récemment. Évite la double-représentation (même personne sur N lieux du blob)
   *  tout en montrant tous les acteurs du territoire. Pour les expéditions co-localisées
   *  (X+Y plantent ensemble place A et A est leur lieu de référence), 1 marker au lieu A
   *  avec lead = 1er membre + badge "+N-1" pour les co-veilleurs. */
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
      extraCount: number
    }> = []

    for (const t of territories.features) {
      const props = t.properties as Record<string, unknown>
      let placeIds: string[] = []
      try { placeIds = JSON.parse((props.placeIds as string) || '[]') } catch { /* ignore */ }
      if (placeIds.length === 0) continue

      // Pour chaque user, trouver son lieu de référence (le plus récent où il apparaît) dans ce territoire
      const userBest = new Map<string, { member: MapVeilleMember; placeId: string; plantedAt: number }>()
      for (const pid of placeIds) {
        const v = veilles.get(pid)
        if (!v) continue
        const ts = new Date(v.plantedAt).getTime()
        for (const m of v.members) {
          const existing = userBest.get(m.userId)
          if (!existing || ts > existing.plantedAt) {
            userBest.set(m.userId, { member: m, placeId: pid, plantedAt: ts })
          }
        }
      }

      // Grouper les users par leur lieu de référence — co-veilleurs co-localisés mergent en 1 marker
      const usersPerPlace = new Map<string, MapVeilleMember[]>()
      for (const state of userBest.values()) {
        const arr = usersPerPlace.get(state.placeId) ?? []
        arr.push(state.member)
        usersPerPlace.set(state.placeId, arr)
      }

      for (const [pid, members] of usersPerPlace) {
        const coords = placeCoords.get(pid)
        if (!coords) continue
        const [lng, lat] = coords
        if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) continue

        out.push({
          key: `${t.id ?? 'tx'}::${pid}`,
          placeId: pid,
          longitude: lng,
          latitude: lat,
          lead: members[0],
          extraCount: members.length - 1,
        })
      }
    }
    return out
  }, [territories, geojson, veilles, bounds, zoom])

  return (
    <>
      {markers.map(({ key, placeId, longitude, latitude, lead, extraCount }) => {
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
