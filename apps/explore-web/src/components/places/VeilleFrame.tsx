import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useVeille } from '../../hooks/useVeille'
import { ExpeditionOptInModal } from './ExpeditionOptInModal'
import { pushVeilleOverride } from '../../lib/loadInitialVeilles'
import etendardIcon from '../../assets/etendard.png'
import type { NearbyPlanter } from '../../types/veille'
import './VeilleFrame.css'

interface Props {
  placeId: string
  placeLocation: { latitude: number; longitude: number }
}

/** Format relatif de la date de plantage, plafonné à 3 mois pour ne pas effrayer les nouveaux.
 *  Hier ou avant-hier → "depuis quelques jours"
 *  < 7 jours → "depuis X jours"
 *  < 4 semaines → "depuis X semaines"
 *  < 3 mois → "depuis X mois"
 *  ≥ 3 mois → "depuis plus de 3 mois" */
function formatVeilleSince(plantedAtIso: string): string {
  const planted = new Date(plantedAtIso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - planted)
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 1) return 'depuis aujourd’hui'
  if (days < 7) return `depuis ${days} jour${days > 1 ? 's' : ''}`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `depuis ${weeks} semaine${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 3) return `depuis ${months} mois`
  return 'depuis plus de 3 mois'
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function VeilleFrame({ placeId, placeLocation }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const { veille, refresh, plant, fetchNearby } = useVeille(placeId)
  const [planting, setPlanting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [optInCandidates, setOptInCandidates] = useState<NearbyPlanter[] | null>(null)

  useEffect(() => { refresh() }, [refresh])

  const distanceKm = userPosition
    ? haversineKm({ lat: userPosition.lat, lng: userPosition.lng },
                  { lat: placeLocation.latitude, lng: placeLocation.longitude })
    : null
  const onSpot = distanceKm !== null && distanceKm <= 0.1
  const canPlant = !!(userId && userFactionId && onSpot && !planting)

  const doPlant = useCallback(async (partners: string[]) => {
    if (!userId || !userPosition) return
    setErrorMsg(null)
    setPlanting(true)
    const result = await plant(userId, userPosition.lat, userPosition.lng, partners)
    setPlanting(false)
    setOptInCandidates(null)
    if ('error' in result) {
      const msg = result.error === 'too_far'
        ? `Trop loin (${result.distanceKm} km). Approche-toi à moins de 100m.`
        : result.error === 'no_faction'
          ? 'Tu n\'as pas encore choisi d\'Héritage.'
          : result.error === 'place_not_found'
            ? 'Ce lieu n\'existe plus.'
            : 'Connecte-toi pour planter.'
      setErrorMsg(msg)
      return
    }
    pushVeilleOverride(placeId, result.factionId, result.isNeutral, result.members)
    await refresh()
  }, [userId, userPosition, plant, refresh, placeId])

  const handlePlant = useCallback(async () => {
    if (!userId || !userPosition) return
    setErrorMsg(null)
    const candidates = await fetchNearby(userId)
    if (candidates.length === 0) {
      await doPlant([])
      return
    }
    setOptInCandidates(candidates)
  }, [userId, userPosition, fetchNearby, doPlant])

  const renderState = () => {
    if (!veille) return null
    if (veille.vacant) {
      return <div className="veille-frame-state veille-frame-vacant">Aucun veilleur. À toi de planter le premier étendard.</div>
    }
    const isSolo = veille.members.length === 1
    const names = veille.members.map(m => m.displayName.trim())
    const sinceStr = formatVeilleSince(veille.plantedAt)
    const label = isSolo
      ? <><strong>{names[0]}</strong> veille ce lieu</>
      : (veille.isNeutral
          ? <><strong>{names.join(', ')}</strong> veillent ensemble (expédition multi-faction)</>
          : <><strong>{names.join(', ')}</strong> veillent ensemble</>)
    return (
      <div className="veille-frame-state">
        <div className="veille-frame-heads">
          {veille.members.map(m => (
            <img key={m.userId}
                 src={m.avatarUrl ?? '/res/default-avatar.png'}
                 alt={m.displayName}
                 title={m.displayName}
                 className="veille-frame-avatar" />
          ))}
        </div>
        <span>{label} {sinceStr}</span>
      </div>
    )
  }

  return (
    <div className="veille-frame">
      <div className="veille-frame-header">Veille</div>

      <div className="veille-frame-row">
        <div className="veille-frame-state-wrap">
          {renderState()}
          {errorMsg && <div className="veille-frame-error">{errorMsg}</div>}
        </div>

        {userId && userFactionId && (
          <button
            className={`veille-frame-plant-btn${planting ? ' planting' : ''}`}
            disabled={!canPlant}
            onClick={handlePlant}
            title={onSpot ? 'Planter ton étendard' : 'Approche-toi à moins de 100m du lieu'}
            aria-label="Planter l'étendard"
          >
            <img src={etendardIcon} alt="" className="veille-frame-plant-icon" />
          </button>
        )}
      </div>

      {optInCandidates && (
        <ExpeditionOptInModal
          candidates={optInCandidates}
          onCancel={() => setOptInCandidates(null)}
          onConfirm={(ids) => doPlant(ids)}
        />
      )}
    </div>
  )
}
