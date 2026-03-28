import { useEffect, useState } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

interface Props {
  placeId: string
  currentClaim: PlaceDetail['claim']
  placeLocation: { latitude: number; longitude: number }
  onClaimed?: () => void
}

export function ClaimButton({ placeId, currentClaim, placeLocation, onClaimed }: Props) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const energyRaw = usePlayerStore(s => s.energy)
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const energyCycle = usePlayerStore(s => s.energyCycle)
  const isFull = energyRaw >= maxEnergy
  const elapsedInTick = energyCycle - nextPointIn
  const fractionOfTick = energyCycle > 0 ? elapsedInTick / energyCycle : 0
  const energy = isFull ? maxEnergy : Math.min(energyRaw + fractionOfTick, maxEnergy)
  const userId = usePlayerStore(s => s.userId)
  const factionId = usePlayerStore(s => s.userFactionId)
  const factionTitle = usePlayerStore(s => s.userFactionTitle)
  const factionColor = usePlayerStore(s => s.userFactionColor)
  const factionPattern = usePlayerStore(s => s.userFactionPattern)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [zoneMult, setZoneMult] = useState(0.5)
  const [sizeMult, setSizeMult] = useState(0)
  const [tagReduction, setTagReduction] = useState(0)
  const userPosition = usePlayerStore(s => s.userPosition)
  const fortLevel = currentClaim?.fortificationLevel ?? 0
  const zoneFort = currentClaim?.zoneFortification ?? 0
  const zoneCount = currentClaim?.zoneNeighborCount ?? 0
  const zoneBonus = Math.floor(zoneFort * zoneMult)
  const sizeBonus = Math.floor(zoneCount * sizeMult)

  // Distance et multiplicateur
  let distanceKm = 999
  if (userPosition) {
    const R = 6371
    const dLat = (placeLocation.latitude - userPosition.lat) * Math.PI / 180
    const dLng = (placeLocation.longitude - userPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(userPosition.lat*Math.PI/180)*Math.cos(placeLocation.latitude*Math.PI/180)*Math.sin(dLng/2)**2
    distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  const activeBuff = usePlayerStore(s => s.activeBuff)
  const claimFree = activeBuff === 'free_claim'
  const claimDiscount = activeBuff === 'discount_claim' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '0') : 0
  const distMult = distanceKm < 0.5 ? 0.5 : distanceKm < 10 ? 1 : distanceKm < 50 ? 2 : 3
  let baseCostWithDist = claimFree ? 0 : 1 * distMult * (1 - tagReduction / 100)
  if (claimDiscount > 0) baseCostWithDist = Math.max(0, baseCostWithDist - claimDiscount)
  const claimCost = claimFree ? 0 : Math.max(0.5, Math.round((baseCostWithDist + fortLevel + zoneBonus + sizeBonus) * 2) / 2)

  useEffect(() => {
    supabase.from('app_settings').select('key, value').in('key', ['zone_fort_multiplier', 'territory_size_defense_mult'])
      .then(({ data }) => {
        if (data) for (const r of data) {
          if (r.key === 'zone_fort_multiplier') setZoneMult(parseFloat(r.value) || 0.5)
          if (r.key === 'territory_size_defense_mult') setSizeMult(parseFloat(r.value) || 0)
        }
      })
    // Fetch tag reduction for this place
    if (userId) {
      supabase.rpc('get_faction_tag_reduction', { p_user_id: userId, p_place_id: placeId })
        .then(({ data }) => { if (data != null) setTagReduction(Number(data) || 0) })
    }
  }, [userId, placeId])

  if (!userId || !factionId || !factionTitle || !factionColor) return null

  // Déjà revendiqué par la même faction
  if (currentClaim?.factionId === factionId && !claimed) {
    return (
      <div className="claim-section claim-owned">
        <span
          className="place-claim-dot"
          style={{ backgroundColor: factionColor }}
        />
        Votre territoire
      </div>
    )
  }

  if (claimed) {
    return (
      <div
        className="claim-section claim-success claim-animate"
        style={{ '--claim-color-rgb': hexToRgb(factionColor) } as React.CSSProperties}
      >
        Protégé pour {factionTitle} !
      </div>
    )
  }

  // Use raw (server-side) energy for afford check, not interpolated display value
  const canAffordClaim = energyRaw >= claimCost

  async function handleClaim() {
    if (!canAffordClaim) return
    setClaiming(true)
    setClaimError(null)

    const userPos = usePlayerStore.getState().userPosition
    const { data, error: rpcError } = await supabase.rpc('claim_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
      p_free: usePlayerStore.getState().activeBuff === 'free_claim',
    })

    if (rpcError) {
      setClaimError(rpcError.message || 'Erreur serveur')
      setClaiming(false)
      return
    }

    if (data?.error) {
      const errorMessages: Record<string, string> = {
        not_enough_energy: `Pas assez d'énergie (${Math.floor(data.energy ?? 0)}/${data.claimCost ?? '?'} ⚡)`,
        no_faction: 'Vous devez rejoindre un héritage',
        already_claimed: 'Ce lieu est déjà sous votre protection',
      }
      setClaimError(errorMessages[data.error] ?? data.error)
      if (data.energy !== undefined) {
        usePlayerStore.getState().setEnergy(data.energy)
      }
      setClaiming(false)
      return
    }

    if (data?.success) {
      const claimBuff = usePlayerStore.getState().activeBuff
      if (claimBuff === 'free_claim' || claimBuff === 'discount_claim') {
        usePlayerStore.getState().setActiveBuff(null)
        localStorage.removeItem('activeBuffValue')
      }
      setClaimed(true)
      setPlaceOverride(placeId, {
        claimed: true,
        factionId: factionId ?? undefined,
        tagColor: factionColor ?? undefined,
        factionPattern: factionPattern ?? undefined,
        fortificationLevel: 0,
      })
      if (data.energy !== undefined) {
        usePlayerStore.getState().setEnergy(data.energy)
      }
      if (data.notorietyPoints !== undefined) usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Vous veillez à présent sur ce lieu ! +5 Gloire`,
        timestamp: Date.now(),
      })

      // Refetch place data to update UI (fortify button, etc.)
      onClaimed?.()
    }

    setClaiming(false)
  }

  return (
    <div className="claim-section">
      <button
        className="claim-btn"
        style={{
          borderColor: factionColor,
          color: factionColor,
        }}
        onClick={handleClaim}
        disabled={claiming || !canAffordClaim}
      >
        {claiming
          ? 'En cours...'
          : canAffordClaim
            ? `Veiller sur ce lieu (${claimCost} \u26A1${(zoneBonus + sizeBonus) > 0 ? ` dont ${zoneBonus + sizeBonus} zone` : ''})`
            : `Pas assez d'énergie (${Math.floor(energy)}/${claimCost})`}
      </button>
      <div className="claim-cost-detail">
        {distMult > 1 && (
          <span>{'\uD83D\uDCCD'} Distance ({Math.round(distanceKm)} km) : x{distMult}</span>
        )}
        {distMult < 1 && (
          <span>{'\uD83D\uDCCD'} Sur place : x{distMult}</span>
        )}
        {fortLevel > 0 && (
          <span>{'\uD83D\uDEE1\uFE0F'} Fortification : +{fortLevel}</span>
        )}
        {zoneBonus > 0 && (
          <span>{'\uD83D\uDEE1\uFE0F'} Voisins fortifies : +{zoneBonus}</span>
        )}
        {sizeBonus > 0 && (
          <span>{'\uD83C\uDFF0'} Taille du territoire : +{sizeBonus}</span>
        )}
        {tagReduction > 0 && (
          <span style={{ color: '#2a7a30' }}>{'\uD83C\uDF96\uFE0F'} Bonus héritage : -{tagReduction}%</span>
        )}
      </div>
      {claimError && (
        <p className="claim-error">{claimError}</p>
      )}
    </div>
  )
}
