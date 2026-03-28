import { useState } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import { ctByLevel } from '../../hooks/useConstructionTypes'
import type { ConstructionTypeInfo } from '../../hooks/useConstructionTypes'

interface Props {
  placeId: string
  currentClaim: NonNullable<PlaceDetail['claim']>
  constructionTypes: ConstructionTypeInfo[]
  placeLocation: { latitude: number; longitude: number }
}

export function FortifyButton({ placeId, currentClaim, constructionTypes, placeLocation }: Props) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const energyRaw = usePlayerStore(s => s.energy)
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const energyCycle = usePlayerStore(s => s.energyCycle)
  const isFull = energyRaw >= maxEnergy
  const elapsedInTick = energyCycle - nextPointIn
  const fractionOfTick = energyCycle > 0 ? elapsedInTick / energyCycle : 0
  const energy = isFull ? maxEnergy : Math.min(energyRaw + fractionOfTick, maxEnergy)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userId = usePlayerStore(s => s.userId)
  const [fortifying, setFortifying] = useState(false)
  const [fortified, setFortified] = useState(false)
  const [localLevel, setLocalLevel] = useState(currentClaim.fortificationLevel)
  const [error, setError] = useState<string | null>(null)

  const maxLevel = constructionTypes.length > 0 ? Math.max(...constructionTypes.map(t => t.level)) : 4
  const currentCt = ctByLevel(constructionTypes, localLevel)
  const nextCt = ctByLevel(constructionTypes, localLevel + 1)
  const maxCt = ctByLevel(constructionTypes, maxLevel)

  // Pas la meme faction → pas de bouton
  if (currentClaim.factionId !== userFactionId) return null

  // Niveau max atteint
  if (localLevel >= maxLevel) {
    return (
      <div className="fortify-section fortify-max">
        {maxCt?.image_url && <img src={maxCt.image_url} alt={maxCt.name} className="fortify-illustration" />}
        <div className="fortify-current-info">
          <span className="fortify-current-name">{maxCt?.name ?? 'Max'} — Fortification maximale</span>
          <span className="fortify-current-desc">{maxCt?.description ?? ''}</span>
        </div>
      </div>
    )
  }

  // Calcul distance
  const userPosition = usePlayerStore(s => s.userPosition)
  let distanceKm = 999
  if (userPosition) {
    const R = 6371
    const dLat = (placeLocation.latitude - userPosition.lat) * Math.PI / 180
    const dLng = (placeLocation.longitude - userPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(userPosition.lat*Math.PI/180)*Math.cos(placeLocation.latitude*Math.PI/180)*Math.sin(dLng/2)**2
    distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  const distMult = distanceKm < 0.5 ? 0.5 : distanceKm < 10 ? 1 : distanceKm < 50 ? 2 : 3
  const baseCost = nextCt?.cost ?? 0
  const cost = Math.max(1, Math.round(baseCost * distMult * 2) / 2)
  const nextName = nextCt?.name ?? ''
  // Use raw (server-side) energy for afford check, not interpolated display value
  const canAfford = energyRaw >= cost

  async function handleFortify() {
    if (!userId || !canAfford) return
    setFortifying(true)
    setError(null)

    const userPos = usePlayerStore.getState().userPosition
    const { data } = await supabase.rpc('fortify_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
    })

    if (data?.error) {
      const errorMessages: Record<string, string> = {
        not_enough_energy: `Pas assez d'énergie (${Math.floor(data.energy ?? 0)}/${data.cost ?? '?'} ⚡)`,
        not_your_faction: 'Ce lieu ne fait pas partie de votre héritage',
        no_faction: 'Vous devez rejoindre un héritage',
        max_level: 'Niveau de fortification maximum atteint',
      }
      setError(errorMessages[data.error] ?? data.error)
      if (data.energy !== undefined) {
        usePlayerStore.getState().setEnergy(data.energy)
      }
      setFortifying(false)
      return
    }

    if (data?.success) {
      setLocalLevel(data.fortificationLevel)
      setPlaceOverride(placeId, { fortificationLevel: data.fortificationLevel })
      if (data.energy !== undefined) {
        usePlayerStore.getState().setEnergy(data.energy)
      }
      if (data.notorietyPoints !== undefined) {
        usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)
      }

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Fortification renforcée : ${data.fortificationName} ! +5 Gloire`,
        timestamp: Date.now(),
      })

      setFortified(true)
      setTimeout(() => setFortified(false), 2000)
    }

    setFortifying(false)
  }

  if (fortified && localLevel >= maxLevel) {
    const fMaxCt = ctByLevel(constructionTypes, maxLevel)
    return (
      <div className="fortify-section fortify-max">
        {fMaxCt?.image_url && <img src={fMaxCt.image_url} alt={fMaxCt.name} className="fortify-illustration" />}
        <div className="fortify-current-info">
          <span className="fortify-current-name">{fMaxCt?.name ?? 'Max'} — Fortification maximale</span>
          <span className="fortify-current-desc">{fMaxCt?.description ?? ''}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fortify-section">
      {localLevel > 0 && currentCt && (
        <div className="fortify-current">
          {currentCt.image_url && <img src={currentCt.image_url} alt={currentCt.name} className="fortify-illustration" />}
          <div className="fortify-current-info">
            <span className="fortify-current-name">{currentCt.name}</span>
            <span className="fortify-current-desc">{currentCt.description}</span>
          </div>
        </div>
      )}
      <button
        className="fortify-btn"
        onClick={handleFortify}
        disabled={fortifying || !canAfford}
      >
        {nextCt?.image_url && <img src={nextCt.image_url} alt={nextCt.name} className="fortify-btn-illustration" />}
        {fortifying
          ? 'Fortification...'
          : canAfford
            ? `Fortifier \u2192 ${nextName} (${cost} \u26A1)`
            : `Pas assez d'énergie (${Math.floor(energy)}/${cost})`}
      </button>
      {error && <p className="fortify-error">{error}</p>}
    </div>
  )
}
