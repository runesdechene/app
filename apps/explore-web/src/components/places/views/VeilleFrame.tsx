import { useState, useCallback, useEffect, useMemo } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { usePlayersStore } from '../../../stores/playersStore'
import { useGloryRulesStore } from '../../../stores/gloryRulesStore'
import { useVictoryModalStore } from '../../../stores/victoryModalStore'
import { useDefisStore } from '../../../stores/defisStore'
import { useVeille } from '../../../hooks/useVeille'
import { VeillePartageeModal } from '../modals/VeillePartageeModal'
import { OnSiteActionModal } from '../modals/OnSiteActionModal'
import { pushVeilleOverride } from '../../../lib/loadInitialVeilles'
import type { NearbyPlanter } from '../../../types/veille'
import './VeilleFrame.css'

interface Props {
  placeId: string
  placeTitle: string
  placeLocation: { latitude: number; longitude: number }
  /** Délègue la visite (sans planter) au flux de PlacePanel (visit_place_gps + notation). */
  onVisit?: () => void
  /** Le joueur a déjà visité ce lieu (place_explorers) → option visite grisée. */
  alreadyVisited?: boolean
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
 * V0.9.55 — Action unique sur place : bouton « Marquer ma visite » qui ouvre un
 * popup à 3 choix (planter seul / planter avec des compagnons / visiter sans planter).
 * Les compagnons sont les joueurs CONNECTÉS à < 200 m (positions live via presence,
 * usePlayersStore) — les sélectionner les ajoute à l'expédition ET les marque visiteurs
 * (plant_flag, mig 246). La visite sans planter est déléguée à PlacePanel (onVisit).
 */
export function VeilleFrame({ placeId, placeTitle, placeLocation, onVisit, alreadyVisited }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const userName = usePlayerStore(s => s.userName)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const userPosition = usePlayerStore(s => s.userPosition)
  const players = usePlayersStore(s => s.players)
  const { veille, refresh, plant } = useVeille(placeId)
  const [planting, setPlanting] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showCompanions, setShowCompanions] = useState(false)

  useEffect(() => { void refresh() }, [refresh])

  const isAlreadyVeilleurGps = !!(
    veille && veille.vacant === false && !veille.byInfluence &&
    userId && veille.members.some(m => m.userId === userId)
  )

  const distanceKm = userPosition
    ? haversineKm({ lat: userPosition.lat, lng: userPosition.lng },
                  { lat: placeLocation.latitude, lng: placeLocation.longitude })
    : null
  const onSpot = distanceKm !== null && distanceKm <= 0.2

  // Compagnons = joueurs connectés (presence) à < 200 m du lieu, hors soi.
  const companions: NearbyPlanter[] = useMemo(() => {
    const out: NearbyPlanter[] = []
    for (const p of players.values()) {
      if (p.userId === userId) continue
      const d = haversineKm({ lat: p.position.lat, lng: p.position.lng },
                            { lat: placeLocation.latitude, lng: placeLocation.longitude })
      if (d <= 0.2) {
        out.push({
          userId: p.userId,
          displayName: p.name,
          avatarUrl: p.avatarUrl,
          factionColor: p.factionColor,
          factionId: '',
        })
      }
    }
    return out
  }, [players, userId, placeLocation])

  const doPlant = useCallback(async (partners: string[], expeditionName?: string) => {
    if (!userId || !userPosition) return
    setPlanting(true)
    const wasVacant = !!(veille && veille.vacant === true)
    const result = await plant(userId, userPosition.lat, userPosition.lng, partners, expeditionName)
    setPlanting(false)
    setShowCompanions(false)
    setShowActionModal(false)
    if ('error' in result) {
      const msg = result.error === 'too_far'
        ? `Trop loin (${result.distanceKm} km). Approche-toi à moins de 200 m.`
        : result.error === 'no_faction'
          ? 'Tu n\'as pas encore choisi de Compagnie.'
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
    pushVeilleOverride(placeId, result.factionId, result.isNeutral, result.members, expeditionName)
    await refresh()
    useDefisStore.getState().refresh(userId)
    const isReaffirm = isAlreadyVeilleurGps
    const rules = useGloryRulesStore.getState().rules
    useVictoryModalStore.getState().show({
      placeTitle,
      fromVacant: wasVacant,
      factionColor: userFactionColor,
      mode: isReaffirm ? 'reaffirm_gps' : 'plant_gps',
      gloryGain:  isReaffirm ? undefined : Number(rules['glory.plant_flag'] ?? 0),
      coupeGain:  isReaffirm ? undefined : Number(rules['coupe.plant_flag'] ?? 0),
      courBonus:  isReaffirm ? undefined : (result.plantBonus ?? 0),
      threatsCleared: isReaffirm ? (result.threatsCleared ?? 0) : undefined,
    })
  }, [userId, userPosition, plant, refresh, placeId, placeTitle, userFactionColor, veille, isAlreadyVeilleurGps])

  if (!userId || !userFactionId) return null

  return (
    <>
      <button
        className={`veille-plant-btn${planting ? ' planting' : ''}`}
        disabled={!onSpot || planting}
        onClick={() => setShowActionModal(true)}
        title={onSpot ? 'Marquer ma visite / planter mon étendard' : 'Vous devez être à moins de 200 m du lieu'}
        aria-label="Marquer ma visite"
      >
        <span>{'\u{1F4CD}'} {planting ? '…' : 'Marquer ma visite'}</span>
      </button>

      {showActionModal && (
        <OnSiteActionModal
          placeTitle={placeTitle}
          isAlreadyVeilleurGps={isAlreadyVeilleurGps}
          alreadyVisited={!!alreadyVisited}
          hasCompanionsNearby={companions.length > 0}
          onPlantSolo={() => { setShowActionModal(false); void doPlant([]) }}
          onPlantCompanions={() => { setShowActionModal(false); setShowCompanions(true) }}
          onVisit={() => { setShowActionModal(false); onVisit?.() }}
          onClose={() => setShowActionModal(false)}
        />
      )}

      {showCompanions && (
        <VeillePartageeModal
          candidates={companions}
          defaultName={userName ? `Expédition de ${userName}` : ''}
          onCancel={() => setShowCompanions(false)}
          onConfirm={(ids, name) => doPlant(ids, name)}
        />
      )}
    </>
  )
}
