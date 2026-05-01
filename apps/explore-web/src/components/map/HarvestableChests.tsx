import { useState, useCallback } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Point } from 'geojson'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { useCrownsStore } from '../../stores/crownsStore'
import { usePlayerStore } from '../../stores/playerStore'
import './HarvestableChests.css'

interface ClickBurst {
  id: number
  placeId: string
  value: number
}

interface Props {
  /** GeoJSON enrichi des places — on lit géométrie + id + tagColor depuis là */
  geojson: FeatureCollection<Point, PlaceProperties> | null
}

/**
 * V0.7 phase 2 — Marqueurs coffre Couronnes de Chêne.
 *
 * Visible uniquement pour les lieux où le user actuel est dans l'expé active
 * et où le timer 24h s'est écoulé (driven par crownsStore.harvestableSet).
 *
 * Visuel : reproduit le balloon-marker des lieux (cercle de couleur faction)
 * mais avec un mini coffre à la place de l'icône SVG type-de-lieu. L'icône
 * d'origine est cachée par le filter `harvestable !== true` sur iconLayer.
 *
 * Click → burst d'animation (pop coffre + halo + +N volant) + RPC harvest_crown.
 */
export function HarvestableChests({ geojson }: Props) {
  const harvestableSet = useCrownsStore(s => s.harvestableSet)
  const harvestable = useCrownsStore(s => s.harvestable)
  const harvest = useCrownsStore(s => s.harvest)
  const userId = usePlayerStore(s => s.userId)

  const [bursts, setBursts] = useState<ClickBurst[]>([])
  const [busyPlaceIds, setBusyPlaceIds] = useState<Set<string>>(new Set())

  const handleClick = useCallback(async (e: React.MouseEvent, placeId: string) => {
    e.stopPropagation()
    if (!userId || busyPlaceIds.has(placeId)) return

    const meta = harvestable.get(placeId)
    const expectedGain = meta?.gain ?? 1

    setBusyPlaceIds(prev => new Set(prev).add(placeId))

    // Animation optimiste : burst de feedback immédiat
    const burstId = Date.now()
    setBursts(prev => [...prev, { id: burstId, placeId, value: expectedGain }])

    // Bruit "gling" — on reprend le son d'influence V0.5 (déjà dans /res/),
    // cohérent en termes d'identité sonore RdC. Volume 0.5 comme InfluenceFrame.
    try {
      const s = new Audio('/res/influence_click.mp3')
      s.volume = 0.5
      s.play().catch(() => {})
    } catch { /* silent fallback */ }

    // Cleanup de l'anim après sa durée totale (float +N = 1.6s)
    setTimeout(() => {
      setBursts(prev => prev.filter(n => n.id !== burstId))
    }, 1700)

    const result = await harvest(userId, placeId)

    setBusyPlaceIds(prev => {
      const next = new Set(prev)
      next.delete(placeId)
      return next
    })

    if ('error' in result) {
      console.warn('[crowns] harvest failed:', result.error)
    }
  }, [userId, harvestable, harvest, busyPlaceIds])

  if (!geojson || harvestableSet.size === 0) return null

  const harvestableFeatures = geojson.features.filter(f =>
    harvestableSet.has(f.properties.id),
  )

  return (
    <>
      {harvestableFeatures.map(f => {
        const [lng, lat] = f.geometry.coordinates as [number, number]
        const placeId = f.properties.id
        const isBusy = busyPlaceIds.has(placeId)
        const myBursts = bursts.filter(n => n.placeId === placeId)

        return (
          <Marker
            key={`chest-${placeId}`}
            longitude={lng}
            latitude={lat}
            anchor="center"
          >
            <div className="harvestable-chest-wrap">
              <button
                type="button"
                className={`harvestable-chest-btn${isBusy ? ' busy' : ''}`}
                onClick={(e) => handleClick(e, placeId)}
                disabled={isBusy}
                aria-label="Récolter une Couronne de Chêne"
                title="Récolter une Couronne de Chêne"
              >
                <span className="harvestable-chest-circle">
                  <img
                    src="/res/coffre.webp"
                    alt=""
                    className="harvestable-chest-img"
                    draggable={false}
                  />
                </span>
              </button>

              {myBursts.map(b => (
                <span key={b.id} className="harvestable-chest-burst" aria-hidden>
                  {/* Flash "gling" — éclat blanc bref qui scintille au spawn */}
                  <span className="harvestable-chest-gling" />
                  {/* Pièce d'or 🪙 +N qui s'élève en disparaissant */}
                  <span className="harvestable-chest-coin">
                    <span className="harvestable-chest-coin-icon">{'🪙'}</span>
                    <span className="harvestable-chest-coin-plus">+{b.value}</span>
                  </span>
                </span>
              ))}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
