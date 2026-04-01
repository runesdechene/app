import { useState, useEffect } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import { ctByLevel } from '../../hooks/useConstructionTypes'
import type { ConstructionTypeInfo } from '../../hooks/useConstructionTypes'

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
  currentClaim: NonNullable<PlaceDetail['claim']>
  constructionTypes: ConstructionTypeInfo[]
  placeLocation?: { latitude: number; longitude: number }
}

export function FortifyButton({ placeId, currentClaim, constructionTypes }: Props) {
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
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  const maxLevel = constructionTypes.length > 0 ? Math.max(...constructionTypes.map(t => t.level)) : 4
  const currentCt = ctByLevel(constructionTypes, localLevel)
  const nextCt = ctByLevel(constructionTypes, localLevel + 1)
  const maxCt = ctByLevel(constructionTypes, maxLevel)

  const isOwnFaction = currentClaim.factionId === userFactionId

  // Fetch le vrai coût depuis le serveur — seulement si notre faction et pas au max
  useEffect(() => {
    if (!userId || !isOwnFaction || localLevel >= maxLevel) return
    setPreviewLoading(true)
    const userPos = usePlayerStore.getState().userPosition
    supabase.rpc('preview_action_cost', {
      p_user_id: userId,
      p_place_id: placeId,
      p_action: 'fortify',
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
      p_fortify_level: localLevel + 1,
    }).then(({ data, error }) => {
      console.log('[COST PREVIEW fortify]', { data, error })
      if (data) setPreview(data as CostPreview)
      setPreviewLoading(false)
    })
  }, [userId, placeId, localLevel, isOwnFaction])

  // Pas la meme faction → pas de bouton
  if (!isOwnFaction) return null

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

  const cost = preview?.cost ?? 1
  const canAfford = energyRaw >= cost
  const d = preview?.detail
  const nextName = nextCt?.name ?? ''

  async function handleFortify() {
    if (!userId || !canAfford) return
    setFortifying(true)
    setError(null)

    // Forcer la regen côté serveur avant l'action
    await supabase.rpc('get_user_energy', { p_user_id: userId })

    const userPos = usePlayerStore.getState().userPosition
    const { data } = await supabase.rpc('fortify_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
      p_glory_mult: usePlayerStore.getState().activeBuff === 'double_glory' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '2') : 1,
    })

    if (data?.error) {
      const errorMessages: Record<string, string> = {
        not_enough_energy: `Pas assez d'énergie (${(data.energy ?? 0).toFixed(1)}/${(data.cost ?? 0).toFixed(1)} ⚡)`,
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
      if (data.notorietyPoints !== undefined) usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)

      // Refresh complet de l'énergie depuis le serveur (énergie + nextPointIn + cycle)
      const { data: refreshed } = await supabase.rpc('get_user_energy', { p_user_id: userId })
      if (refreshed) {
        usePlayerStore.setState({
          energy: refreshed.energy,
          maxEnergy: refreshed.maxEnergy,
          nextPointIn: refreshed.nextPointIn,
          energyCycle: refreshed.energyCycle,
        })
      } else if (data.energy !== undefined) {
        usePlayerStore.getState().setEnergy(data.energy)
      }

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Fortification renforcée : ${data.fortificationName} ! 🎖️ +${data.gloryGain ?? 5} Gloire`,
        timestamp: Date.now(),
      })

      if (usePlayerStore.getState().activeBuff === 'double_glory') {
        usePlayerStore.getState().setActiveBuff(null)
        localStorage.removeItem('activeBuffValue')
      }
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
        disabled={fortifying || !canAfford || previewLoading}
      >
        {nextCt?.image_url && <img src={nextCt.image_url} alt={nextCt.name} className="fortify-btn-illustration" />}
        {fortifying
          ? 'Fortification...'
          : previewLoading
            ? 'Calcul du coût...'
            : canAfford
              ? `Fortifier \u2192 ${nextName} (${cost} \u26A1)`
              : `Pas assez d'énergie (${energy.toFixed(1)}/${cost} ⚡)`}
      </button>
      {d && (
        <div className="claim-cost-detail">
          <span>{'\uD83D\uDCCD'} Distance ({d.distanceKm} km) : {d.distanceMult === 1 ? 'x1' : d.distanceMult < 1 ? `x${d.distanceMult} (sur place)` : `x${d.distanceMult}`}</span>
          {d.fortifCost > 0 && (
            <span>{'\uD83D\uDEE1\uFE0F'} Coût fortification : +{d.fortifCost}</span>
          )}
          {d.tagReduction > 0 && (
            <span style={{ color: '#2a7a30' }}>{'\uD83C\uDF96\uFE0F'} Bonus héritage : -{d.tagReduction}%</span>
          )}
          {preview?.gloryPreview && (
            <span style={{ color: '#b8860b' }}>{'\uD83C\uDF96\uFE0F'} Gloire : +{preview.gloryPreview}</span>
          )}
        </div>
      )}
      {error && <p className="fortify-error">{error}</p>}
    </div>
  )
}
