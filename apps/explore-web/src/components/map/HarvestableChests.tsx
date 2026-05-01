import { useState, useCallback } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import type { FeatureCollection, Point } from 'geojson'
import type { PlaceProperties } from '../../hooks/usePlaces'
import { useCrownsStore } from '../../stores/crownsStore'
import { usePlayerStore } from '../../stores/playerStore'
import './HarvestableChests.css'

interface FloatingNumber {
  id: number
  placeId: string
  value: number
}

interface Props {
  /** GeoJSON enrichi des places — on lit géométrie + id depuis là */
  geojson: FeatureCollection<Point, PlaceProperties> | null
}

/**
 * V0.7 phase 2 — Marqueurs coffre Couronnes de Chêne sur les lieux récoltables.
 *
 * Visible uniquement pour les lieux où le user actuel est dans l'expé active
 * et où le timer 24h s'est écoulé (driven par crownsStore.harvestableSet,
 * peuplé via get_my_crowns_state au boot et après chaque récolte).
 *
 * Click coffre → animation +1 + RPC harvest_crown + retrait du marker.
 * Le coffre couvre visuellement l'icône lieu (60×60 vs 32×32) — pas de modif map-layers.
 */
export function HarvestableChests({ geojson }: Props) {
  const harvestableSet = useCrownsStore(s => s.harvestableSet)
  const harvestable = useCrownsStore(s => s.harvestable)
  const harvest = useCrownsStore(s => s.harvest)
  const userId = usePlayerStore(s => s.userId)

  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([])
  const [busyPlaceIds, setBusyPlaceIds] = useState<Set<string>>(new Set())

  const handleClick = useCallback(async (e: React.MouseEvent, placeId: string) => {
    e.stopPropagation()
    if (!userId || busyPlaceIds.has(placeId)) return

    const meta = harvestable.get(placeId)
    const expectedGain = meta?.gain ?? 1

    setBusyPlaceIds(prev => new Set(prev).add(placeId))

    // Animation optimiste : on lance le +N tout de suite
    const tempId = Date.now()
    setFloatingNumbers(prev => [...prev, { id: tempId, placeId, value: expectedGain }])

    // Hook audio placeholder — Uriel fournira le fichier plus tard.
    // Une fois le fichier dispo dans /res/crown_harvest.mp3 :
    //   const audio = new Audio('/res/crown_harvest.mp3')
    //   audio.volume = 0.4
    //   audio.play().catch(() => {})

    // Cleanup de l'anim après 1.6s
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(n => n.id !== tempId))
    }, 1600)

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
        const floats = floatingNumbers.filter(n => n.placeId === placeId)

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
                title="Récolter"
              >
                <img src="/res/coffre.webp" alt="" className="harvestable-chest-img" draggable={false} />
              </button>
              {floats.map(n => (
                <span key={n.id} className="harvestable-chest-float">+{n.value}</span>
              ))}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
