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

interface CostPreview {
  cost: number
  energy: number
  canAfford: boolean
  gloryPreview: number
  detail: {
    baseCost: number
    distanceKm: number
    distanceMult: number
    tagReduction: number
    sameFaction: boolean
    fortifCost: number
    zoneCost: number
    sizeCost: number
  }
}

interface Props {
  placeId: string
  currentClaim: PlaceDetail['claim']
  placeLocation?: { latitude: number; longitude: number }
  onClaimed?: () => void
}

export function ClaimButton({ placeId, currentClaim, onClaimed }: Props) {
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
  const activeBuff = usePlayerStore(s => s.activeBuff)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  // Fetch le vrai coût depuis le serveur — SEULEMENT si on peut veiller (pas notre faction)
  const isOwnFaction = currentClaim?.factionId === factionId
  useEffect(() => {
    if (!userId || isOwnFaction) {
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    const userPos = usePlayerStore.getState().userPosition
    supabase.rpc('preview_action_cost', {
      p_user_id: userId,
      p_place_id: placeId,
      p_action: 'claim',
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
    }).then(({ data, error }) => {
      console.log('[COST PREVIEW claim]', { data, error })
      if (data) setPreview(data as CostPreview)
      setPreviewLoading(false)
    })
  }, [userId, placeId, isOwnFaction])

  if (!userId || !factionId || !factionTitle || !factionColor) return null

  // Déjà veillé par la même faction
  if (currentClaim?.factionId === factionId && !claimed) {
    return (
      <div className="claim-section claim-owned">
        <span className="place-claim-dot" style={{ backgroundColor: factionColor }} />
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

  const claimFree = activeBuff === 'free_claim'
  const claimDiscount = activeBuff === 'discount_claim' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '0') : 0

  // Coût final (serveur comme source de vérité)
  let claimCost = preview?.cost ?? 1
  if (claimFree) claimCost = 0
  else if (claimDiscount > 0) claimCost = Math.max(0.5, Math.round((claimCost * (1 - claimDiscount / 100)) * 2) / 2)

  const canAffordClaim = claimCost === 0 || energyRaw >= claimCost
  const d = preview?.detail

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
      p_glory_mult: usePlayerStore.getState().activeBuff === 'double_glory' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '2') : 1,
    })

    if (rpcError) {
      setClaimError(rpcError.message || 'Erreur serveur')
      setClaiming(false)
      return
    }

    if (data?.error) {
      const errorMessages: Record<string, string> = {
        not_enough_energy: `Pas assez d'énergie (${(data.energy ?? 0).toFixed(1)}/${(data.claimCost ?? 0).toFixed(1)} ⚡)`,
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
      const buff = usePlayerStore.getState().activeBuff
      if (buff === 'free_claim' || buff === 'discount_claim' || buff === 'double_glory') {
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
      if (data.energy !== undefined) usePlayerStore.getState().setEnergy(data.energy)
      if (data.notorietyPoints !== undefined) usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Vous veillez à présent sur ce lieu ! 🎖️ +${data.gloryGain ?? 5} Gloire`,
        timestamp: Date.now(),
      })
      onClaimed?.()
    }

    setClaiming(false)
  }

  return (
    <div className="claim-section">
      <button
        className="claim-btn"
        style={{ borderColor: factionColor, color: factionColor }}
        onClick={handleClaim}
        disabled={claiming || !canAffordClaim || previewLoading}
      >
        {claiming
          ? 'En cours...'
          : previewLoading
            ? 'Calcul du coût...'
            : claimFree
              ? 'Veiller sur ce lieu (gratuit ✨)'
              : canAffordClaim
                ? `Veiller sur ce lieu (${claimCost} \u26A1)`
                : `Pas assez d'énergie (${energy.toFixed(1)}/${claimCost} ⚡)`}
      </button>
      {d && !claimFree && (
        <div className="claim-cost-detail">
          <span>{'\uD83D\uDCCD'}({d.distanceKm} km) : {d.distanceMult === 1 ? 'x1' : d.distanceMult < 1 ? `x${d.distanceMult} (sur place)` : `x${d.distanceMult}`}</span>
          {d.fortifCost > 0 && (
            <span>{'\uD83D\uDEE1\uFE0F'} Fortification : +{d.fortifCost}</span>
          )}
          {d.zoneCost > 0 && (
            <span>{'\uD83D\uDEE1\uFE0F'} Voisins fortifiés : +{d.zoneCost}</span>
          )}
          {d.sizeCost > 0 && (
            <span>{'\uD83C\uDFF0'} Territoire : +{d.sizeCost}</span>
          )}
          {d.tagReduction > 0 && (
            <span style={{ color: '#2a7a30' }}>{'\uD83C\uDF96\uFE0F'} Héritage: -{d.tagReduction}%</span>
          )}
          {preview?.gloryPreview && (
            <span style={{ color: '#b8860b' }}>{'\uD83C\uDF96\uFE0F'} +{preview.gloryPreview}</span>
          )}
        </div>
      )}
      {claimError && (
        <p className="claim-error">{claimError}</p>
      )}
    </div>
  )
}
