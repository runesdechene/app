import { memo, useMemo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { useVeillesStore } from '../../stores/veillesStore'
import { useMapStore } from '../../stores/mapStore'
import type { MapVeilleMember } from '../../types/veille'
import './VeilleMarkers.css'

/** Seuil de zoom : en dessous, on ne rend pas les avatars (trop nombreux à la fois). */
const MIN_ZOOM_FOR_MARKERS = 9

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

  /** Pour chaque territoire visible : agrège les membres de toutes les veilles qu'il contient,
   *  et place le marker à la position de l'emblème (= centroïde du territoire). */
  const markers = useMemo(() => {
    if (!territories || zoom < MIN_ZOOM_FOR_MARKERS || !bounds) return []
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
  }, [territories, veilles, zoom, bounds])

  return (
    <>
      {markers.map(({ key, placeId, longitude, latitude, members }) => (
        <Marker
          key={key}
          longitude={longitude}
          latitude={latitude}
          anchor="top-left"
        >
          <div
            className="veille-markers-stack"
            onClick={() => setSelectedPlaceId(placeId)}
            title={members.map(m => m.displayName.trim()).join(', ')}
          >
            {members.slice(0, 4).map((m, i) => (
              <div
                key={m.userId}
                className="veille-markers-avatar-wrap"
                style={{
                  '--frame-color': m.factionColor ?? '#8a6f4a',
                  transform: `translate(${i * 12}px, ${i * 12}px)`,
                  zIndex: 10 - i,
                } as React.CSSProperties}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="veille-markers-avatar" />
                ) : (
                  <div className="veille-markers-avatar veille-markers-avatar-fallback" />
                )}
              </div>
            ))}
            {members.length > 4 && (
              <div className="veille-markers-more" style={{ transform: 'translate(48px, 48px)' }}>
                +{members.length - 4}
              </div>
            )}
          </div>
        </Marker>
      ))}
    </>
  )
})
