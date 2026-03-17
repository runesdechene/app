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
}

export function ClaimButton({ placeId, currentClaim }: Props) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const conquestPoints = usePlayerStore(s => s.conquestPoints)
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
  const fortLevel = currentClaim?.fortificationLevel ?? 0
  const zoneFort = currentClaim?.zoneFortification ?? 0
  const zoneCount = currentClaim?.zoneNeighborCount ?? 0
  const zoneBonus = Math.floor(zoneFort * zoneMult)
  const sizeBonus = Math.floor(zoneCount * sizeMult)
  const claimCost = 1 + fortLevel + zoneBonus + sizeBonus

  useEffect(() => {
    supabase.from('app_settings').select('key, value').in('key', ['zone_fort_multiplier', 'territory_size_defense_mult'])
      .then(({ data }) => {
        if (data) for (const r of data) {
          if (r.key === 'zone_fort_multiplier') setZoneMult(parseFloat(r.value) || 0.5)
          if (r.key === 'territory_size_defense_mult') setSizeMult(parseFloat(r.value) || 0)
        }
      })
  }, [])

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
        Revendiqué pour {factionTitle} !
      </div>
    )
  }

  const canAffordClaim = conquestPoints >= claimCost

  async function handleClaim() {
    if (!canAffordClaim) return
    setClaiming(true)
    setClaimError(null)

    const { data, error: rpcError } = await supabase.rpc('claim_place', {
      p_user_id: userId,
      p_place_id: placeId,
    })

    if (rpcError) {
      console.error('claim_place RPC error:', rpcError)
      setClaimError(rpcError.message || 'Erreur serveur')
      setClaiming(false)
      return
    }

    if (data?.error) {
      setClaimError(data.error)
      if (data.conquestPoints !== undefined) {
        usePlayerStore.getState().setConquestPoints(data.conquestPoints)
      }
      setClaiming(false)
      return
    }

    if (data?.success) {
      setClaimed(true)
      setPlaceOverride(placeId, {
        claimed: true,
        factionId: factionId ?? undefined,
        tagColor: factionColor ?? undefined,
        factionPattern: factionPattern ?? undefined,
      })
      if (data.conquestPoints !== undefined) {
        usePlayerStore.getState().setConquestPoints(data.conquestPoints)
      }
      if (data.conquestNextPointIn !== undefined) {
        usePlayerStore.getState().setConquestNextPointIn(data.conquestNextPointIn)
      }
      if (data.constructionPoints !== undefined) {
        usePlayerStore.getState().setConstructionPoints(data.constructionPoints)
      }
      if (data.constructionNextPointIn !== undefined) {
        usePlayerStore.getState().setConstructionNextPointIn(data.constructionNextPointIn)
      }
      if (data.notorietyPoints !== undefined) usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Lieu revendiqué pour ${factionTitle} ! +10 Notoriété`,
        timestamp: Date.now(),
      })
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
          ? 'Revendication...'
          : canAffordClaim
            ? `Revendiquer pour ${factionTitle} (${claimCost} \u2694${(zoneBonus + sizeBonus) > 0 ? ` dont ${zoneBonus + sizeBonus} zone` : ''})`
            : `Pas assez de points de conquête (${Math.floor(conquestPoints)}/${claimCost})`}
      </button>
      {(fortLevel > 0 || zoneBonus > 0 || sizeBonus > 0) && (
        <div className="claim-cost-detail">
          {fortLevel > 0 && (
            <span>{'\uD83D\uDEE1\uFE0F'} Fortification : +{fortLevel}</span>
          )}
          {zoneBonus > 0 && (
            <span>{'\uD83D\uDEE1\uFE0F'} Voisins fortifies : +{zoneBonus}</span>
          )}
          {sizeBonus > 0 && (
            <span>{'\uD83C\uDFF0'} Taille du territoire : +{sizeBonus}</span>
          )}
        </div>
      )}
      {claimError && (
        <p className="claim-error">{claimError}</p>
      )}
    </div>
  )
}
