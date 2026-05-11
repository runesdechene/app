import { useState, useCallback, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useVeille } from '../../../hooks/useVeille'
import { VeillePartageeModal } from '../modals/VeillePartageeModal'
import { pushVeilleOverride } from '../../../lib/loadInitialVeilles'
import { supabase } from '../../../lib/supabase'
import etendardIcon from '../../../assets/etendard.png'
import type { NearbyPlanter } from '../../../types/veille'
import './VeilleFrame.css'

interface Props {
  placeId: string
  placeLocation: { latitude: number; longitude: number }
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

/**
 * V0.7 — Bouton inline "Planter mon étendard". Refonte 2026-05-02 : ce composant
 * était une grosse frame avec header + état + hint. Tout ça est désormais
 * redondant : la pilule "Veillé par {nom}" sous le titre du lieu donne déjà
 * l'état, et le bouton vit dans la ligne "Ils ont foulé ces terres" (ExplorerRow).
 * Plus que le bouton + la modale opt-in expédition.
 *
 * 1 tap = visit + plant_flag (visit en parallèle, erreurs ignorées).
 */
export function VeilleFrame({ placeId, placeLocation }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const { veille, refresh, plant, fetchNearby } = useVeille(placeId)
  const [planting, setPlanting] = useState(false)
  const [optInCandidates, setOptInCandidates] = useState<NearbyPlanter[] | null>(null)

  // V096 — le bouton reste affiché même pour le veilleur plein, car
  // replanter sur son propre lieu efface désormais les menaces challengers
  // (cas D "réaffirmation IRL"). On garde le refresh au mount pour la
  // donnée de veille (utilisée ailleurs si besoin).
  useEffect(() => { void refresh() }, [refresh])
  void veille // évite warn unused — l'état est utilisé via refresh

  const distanceKm = userPosition
    ? haversineKm({ lat: userPosition.lat, lng: userPosition.lng },
                  { lat: placeLocation.latitude, lng: placeLocation.longitude })
    : null
  const onSpot = distanceKm !== null && distanceKm <= 0.1
  const canPlant = !!(userId && userFactionId && onSpot && !planting)

  const doPlant = useCallback(async (partners: string[]) => {
    if (!userId || !userPosition) return
    setPlanting(true)
    // 1 tap = visit + plant. visit_place_gps en parallèle, erreurs ignorées
    // (place_explorers a ON CONFLICT DO NOTHING — doublon silencieux).
    const visitPromise = Promise.resolve(supabase.rpc('visit_place_gps', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPosition.lat,
      p_user_lng: userPosition.lng,
    })).then(() => {}, () => {/* visite secondaire, on ignore */})
    const result = await plant(userId, userPosition.lat, userPosition.lng, partners)
    await visitPromise
    setPlanting(false)
    setOptInCandidates(null)
    if ('error' in result) {
      const msg = result.error === 'too_far'
        ? `Trop loin (${result.distanceKm} km). Approche-toi à moins de 100 m.`
        : result.error === 'no_faction'
          ? 'Tu n\'as pas encore choisi d\'Héritage.'
          : result.error === 'place_not_found'
            ? 'Ce lieu n\'existe plus.'
            : result.error === 'already_yours'
              ? 'Tu veilles déjà sur ce lieu — pas besoin de replanter ton étendard.'
              : result.error === 'cooldown'
                ? `Tu as déjà planté ici récemment. Reviens dans ${result.remainingHours ?? '?'} h.`
                : 'Connecte-toi pour planter.'
      alert(msg)
      return
    }
    pushVeilleOverride(placeId, result.factionId, result.isNeutral, result.members)
    await refresh()
  }, [userId, userPosition, plant, refresh, placeId])

  const handlePlant = useCallback(async () => {
    if (!userId || !userPosition) return
    const candidates = await fetchNearby(userId)
    if (candidates.length === 0) {
      await doPlant([])
      return
    }
    setOptInCandidates(candidates)
  }, [userId, userPosition, fetchNearby, doPlant])

  if (!userId || !userFactionId) return null

  return (
    <>
      <button
        className={`veille-plant-btn${planting ? ' planting' : ''}`}
        disabled={!canPlant}
        onClick={handlePlant}
        title={onSpot ? 'Planter ton étendard sur ce lieu' : 'Vous devez être à moins de 100 m du lieu'}
        aria-label="Planter mon étendard (GPS)"
      >
        <img src={etendardIcon} alt="" className="veille-plant-icon" />
        <span>{planting ? '…' : 'Planter mon étendard (GPS)'}</span>
      </button>

      {optInCandidates && (
        <VeillePartageeModal
          candidates={optInCandidates}
          onCancel={() => setOptInCandidates(null)}
          onConfirm={(ids) => doPlant(ids)}
        />
      )}
    </>
  )
}
