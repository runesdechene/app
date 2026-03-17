import { useState } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import { ctByLevel } from '../../hooks/useConstructionTypes'
import type { ConstructionTypeInfo } from '../../hooks/useConstructionTypes'

interface Props {
  placeId: string
  currentClaim: NonNullable<PlaceDetail['claim']>
  constructionTypes: ConstructionTypeInfo[]
}

export function FortifyButton({ placeId, currentClaim, constructionTypes }: Props) {
  const constructionPoints = usePlayerStore(s => s.constructionPoints)
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

  const cost = nextCt?.cost ?? 0
  const nextName = nextCt?.name ?? ''
  const canAfford = constructionPoints >= cost

  async function handleFortify() {
    if (!userId || !canAfford) return
    setFortifying(true)
    setError(null)

    const { data } = await supabase.rpc('fortify_place', {
      p_user_id: userId,
      p_place_id: placeId,
    })

    if (data?.error) {
      setError(data.error)
      if (data.constructionPoints !== undefined) {
        usePlayerStore.getState().setConstructionPoints(data.constructionPoints)
      }
      setFortifying(false)
      return
    }

    if (data?.success) {
      setLocalLevel(data.fortificationLevel)
      if (data.constructionPoints !== undefined) {
        usePlayerStore.getState().setConstructionPoints(data.constructionPoints)
      }
      if (data.constructionNextPointIn !== undefined) {
        usePlayerStore.getState().setConstructionNextPointIn(data.constructionNextPointIn)
      }
      if (data.notorietyPoints !== undefined) {
        usePlayerStore.getState().setNotorietyPoints(data.notorietyPoints)
      }

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Lieu fortifié : ${data.fortificationName} ! +5 Notoriété`,
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
            ? `Fortifier \u2192 ${nextName} (${cost} \uD83D\uDD28)`
            : `Pas assez de construction (${Math.floor(constructionPoints)}/${cost})`}
      </button>
      {error && <p className="fortify-error">{error}</p>}
    </div>
  )
}
