import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { useVeillesStore } from '../../stores/veillesStore'
import { useMapStore } from '../../stores/mapStore'
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
  territories: FeatureCollection<Polygon | MultiPolygon> | null
  zoom: number
  bounds: Bounds | null
}

/**
 * Pile d'avatars (1 à N) en haut-droite de chaque lieu veillé.
 * Chaque avatar a un cadre de la couleur de sa faction et l'emblème de la faction
 * en badge superposé. Pour les expéditions, plusieurs têtes en pile diagonale.
 */
export const VeilleMarkers = memo(function VeilleMarkers({ territories, zoom, bounds }: Props) {
  const veilles = useVeillesStore(s => s.veilles)
  const setSelectedPlaceId = useMapStore(s => s.setSelectedPlaceId)

  /** Option B : 1 avatar (le 1er membre) avec cadre couleur faction par territoire.
   *  Visible à partir de zoom 9 (sinon le sceau emblème de territoryEmblemLayer suffit).
   *  Si > 1 membre dans l'expedition, badge "+N" dans le coin. */
  const markers = useMemo(() => {
    if (!territories || !bounds || zoom < MIN_ZOOM_FOR_AVATARS) return []
    const out: Array<{
      key: string
      placeId: string  // pour le clic — le 1er placeId du territoire
      longitude: number
      latitude: number
      members: MapVeilleMember[]
      isNeutral: boolean
    }> = []

    for (const t of territories.features) {
      const props = t.properties as Record<string, unknown>
      const emblemLon = props.emblemLon as number | undefined
      const emblemLat = props.emblemLat as number | undefined
      if (typeof emblemLon !== 'number' || typeof emblemLat !== 'number') continue
      // Viewport filter
      if (emblemLon < bounds.minLng || emblemLon > bounds.maxLng || emblemLat < bounds.minLat || emblemLat > bounds.maxLat) continue

      let placeIds: string[] = []
      try { placeIds = JSON.parse((props.placeIds as string) || '[]') } catch { /* ignore */ }
      if (placeIds.length === 0) continue

      const aggregated: MapVeilleMember[] = []
      const seen = new Set<string>()
      let isNeutral = false
      let firstPlaceId = ''
      for (const pid of placeIds) {
        const v = veilles.get(pid)
        if (!v) continue
        if (!firstPlaceId) firstPlaceId = pid
        if (v.isNeutral) isNeutral = true
        for (const m of v.members) {
          if (seen.has(m.userId)) continue
          seen.add(m.userId)
          aggregated.push(m)
        }
      }
      if (aggregated.length === 0) continue

      out.push({
        key: String(t.id ?? firstPlaceId),
        placeId: firstPlaceId,
        longitude: emblemLon,
        latitude: emblemLat,
        members: aggregated,
        isNeutral,
      })
    }
    return out
  }, [territories, veilles, bounds, zoom])

  return (
    <>
      {markers.map(({ key, placeId, longitude, latitude, members }) => {
        const lead = members[0]
        const extraCount = members.length - 1
        const allNames = members.map(m => m.displayName.trim()).join(', ')
        // Taille proportionnelle au zoom (cohérent avec icon-size du place iconLayer :
        // ~30px à zoom 9, ~44px à zoom 12). Ne dépasse jamais la taille des icônes lieux.
        const sizePx = Math.round(Math.max(22, Math.min(44, 22 + (zoom - 9) * 7)))
        return (
          <Marker
            key={key}
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
