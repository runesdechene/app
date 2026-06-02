import { useState, useCallback } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Point } from 'geojson'
import type { PlaceProperties } from '../../../hooks/usePlaces'
import { useCrownsStore } from '../../../stores/crownsStore'
import { usePlayerStore } from '../../../stores/playerStore'
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

  const handleClick = useCallback((e: React.MouseEvent, placeId: string) => {
    e.stopPropagation()
    if (!userId || busyPlaceIds.has(placeId)) return

    const meta = harvestable.get(placeId)
    const expectedGain = meta?.gain ?? 1

    // Marker maintenu visible pendant l'animation (sinon le store retire placeId
    // de harvestableSet dès que la RPC réussit ~300ms et démonte le <Marker> →
    // l'animation disparaît avant d'avoir joué).
    setBusyPlaceIds(prev => new Set(prev).add(placeId))

    // Burst de feedback immédiat (animation optimiste)
    const burstId = Date.now()
    setBursts(prev => [...prev, { id: burstId, placeId, value: expectedGain }])

    // Bruit "gling" — son d'influence V0.5 réutilisé (cohérent identité sonore RdC).
    try {
      const s = new Audio('/res/influence_click.mp3')
      s.volume = 0.5
      s.play().catch(() => {})
    } catch { /* silent fallback */ }

    // RPC en arrière-plan — on n'attend pas pour démonter, sinon l'animation est tronquée.
    const harvestPromise = harvest(userId, placeId)

    void harvestPromise.then(result => {
      if ('error' in result) {
        console.warn('[crowns] harvest failed:', result.error)
      }
    })

    // Cleanup synchronisé avec la fin de l'animation pièce qui s'élève (1.6s + marge).
    window.setTimeout(() => {
      setBursts(prev => prev.filter(n => n.id !== burstId))
      setBusyPlaceIds(prev => {
        const next = new Set(prev)
        next.delete(placeId)
        return next
      })
    }, 1700)
  }, [userId, harvestable, harvest, busyPlaceIds])

  // Set d'affichage = harvestable courant ∪ busy (animations en cours).
  // Garde le marker monté jusqu'à la fin du burst, même si le store a déjà
  // retiré le placeId après une RPC réussie.
  const displayedSet = new Set<string>(harvestableSet)
  for (const id of busyPlaceIds) displayedSet.add(id)

  if (!geojson || displayedSet.size === 0) return null

  const harvestableFeatures = geojson.features.filter(f =>
    displayedSet.has(f.properties.id),
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
