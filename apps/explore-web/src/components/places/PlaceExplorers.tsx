import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import './PlaceExplorers.css'

interface Explorer {
  userId: string
  visitedAt: string
  userName: string
  userAvatar: string | null
  factionId: string
}

interface PlaceExplorersProps {
  placeId: string
  placeTitle: string
  explorers: Explorer[]
  placeLocation: { latitude: number; longitude: number }
  isExplorer: boolean
  factionColors: Map<string, string>
  onVisited: () => void
}

/** Haversine distance in km */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function PlaceExplorers({ placeId, placeTitle, explorers, placeLocation, isExplorer, factionColors, onVisited }: PlaceExplorersProps) {
  const userId = usePlayerStore(s => s.userId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const [loading, setLoading] = useState(false)

  const isOnSite = useMemo(() => {
    if (!userPosition) return false
    return haversineKm(userPosition.lat, userPosition.lng, placeLocation.latitude, placeLocation.longitude) < 0.2
  }, [userPosition, placeLocation])

  const [revisited, setRevisited] = useState(false)

  async function handleVisit() {
    if (!userId || !userPosition || loading) return
    setLoading(true)

    const { data, error } = await supabase.rpc('visit_place_gps', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPosition.lat,
      p_user_lng: userPosition.lng,
    })

    if (!error && data && !data.error) {
      const result = data as {
        success: boolean
        influenceGain?: number
        explorationGain?: number
        newInfluenceStock?: number
        newExploration?: number
      }
      if (result.newInfluenceStock != null) {
        usePlayerStore.getState().setInfluenceStock(result.newInfluenceStock)
      }
      if (result.newExploration != null) {
        usePlayerStore.getState().setExplorationPoints(result.newExploration)
      }

      useToastStore.getState().addToast({
        type: 'explore',
        message: `Visite de ${placeTitle} validée ! +${result.influenceGain ?? 0} influence, +${result.explorationGain ?? 0} exploration`,
        highlights: [placeTitle],
        placeId,
        placeLocation,
        timestamp: Date.now(),
      })
      onVisited()
    }

    setLoading(false)
  }

  async function handleRevisit() {
    if (!userId || !userPosition || loading || revisited) return
    setLoading(true)

    const { data, error } = await supabase.rpc('revisit_place_gps', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPosition.lat,
      p_user_lng: userPosition.lng,
    })

    if (!error && data && !data.error) {
      const result = data as { influenceGain?: number; recentRevisits?: number }
      const gain = result.influenceGain ?? 0
      useToastStore.getState().addToast({
        type: 'revisit',
        message: `De retour sur ${placeTitle} ! +${gain} influence`,
        highlights: [placeTitle],
        placeId,
        placeLocation,
        timestamp: Date.now(),
      })
      setRevisited(true)
    } else if (data?.error === 'already_revisited_today') {
      setRevisited(true)
    }

    setLoading(false)
  }

  return (
    <div className="place-explorers">
      <h3 className="place-explorers-title">🧭 Explorateurs ({explorers.length})</h3>

      {explorers.length === 0 && !userId ? (
        <p className="place-explorers-empty">Personne n&apos;a encore visit&eacute; ce lieu en personne.</p>
      ) : (
        <div className="place-explorers-row">
          {explorers.map(exp => {
            const color = factionColors.get(exp.factionId) ?? '#8A7B6A'
            return exp.userAvatar ? (
              <img
                key={exp.userId}
                src={exp.userAvatar}
                alt={exp.userName}
                className="place-explorer-avatar"
                style={{ borderColor: color }}
                title={`${exp.userName} - ${new Date(exp.visitedAt).toLocaleDateString('fr-FR')}`}
                onClick={() => useMapStore.getState().setSelectedPlayerId(exp.userId)}
              />
            ) : (
              <div
                key={exp.userId}
                className="place-explorer-avatar-fallback"
                style={{ backgroundColor: color }}
                title={`${exp.userName} - ${new Date(exp.visitedAt).toLocaleDateString('fr-FR')}`}
                onClick={() => useMapStore.getState().setSelectedPlayerId(exp.userId)}
              >
                {(exp.userName || '?').charAt(0).toUpperCase()}
              </div>
            )
          })}

          {userId && !isExplorer && (
            <button
              className={`place-explorers-visit-btn${!isOnSite ? ' place-explorers-visit-btn-disabled' : ''}`}
              onClick={isOnSite ? handleVisit : undefined}
              disabled={loading || !isOnSite}
              title={!isOnSite ? 'Rendez-vous sur place pour explorer ce lieu' : undefined}
            >
              {loading ? 'Validation...' : '\uD83D\uDCCD J\'y suis alle'}
            </button>
          )}
          {userId && isExplorer && !revisited && (
            <button
              className={`place-explorers-visit-btn${!isOnSite ? ' place-explorers-visit-btn-disabled' : ''}`}
              onClick={isOnSite ? handleRevisit : undefined}
              disabled={loading || !isOnSite}
              title={!isOnSite ? 'Rendez-vous sur place pour revisiter ce lieu' : undefined}
            >
              {loading ? 'Validation...' : '\uD83D\uDCCD De retour !'}
            </button>
          )}
          {userId && isExplorer && revisited && (
            <span style={{ fontSize: 11, opacity: 0.5 }}>Revisite du jour validee</span>
          )}
        </div>
      )}
    </div>
  )
}
