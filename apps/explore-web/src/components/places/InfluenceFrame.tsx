import { useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import './InfluenceFrame.css'

interface InfluenceEntry {
  factionId: string
  placed: number
  content: number
  total: number
}

interface InfluenceFrameProps {
  placeId: string
  influence: InfluenceEntry[]
  factionColors: Map<string, string>
  factionPatterns: Map<string, string>
  factionNames: Map<string, string>
  placeLocation: { latitude: number; longitude: number }
  onInfluencePlaced: () => void
}

export function InfluenceFrame({ placeId, influence, factionColors, factionPatterns, factionNames, placeLocation, onInfluencePlaced }: InfluenceFrameProps) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userPosition = usePlayerStore(s => s.userPosition)
  const gameMode = usePlayerStore(s => s.gameMode)

  const [loading, setLoading] = useState(false)
  const [pulseFaction, setPulseFaction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (gameMode !== 'conquest') return null

  const isGps = useMemo(() => {
    if (!userPosition) return false
    const R = 6371
    const dLat = (placeLocation.latitude - userPosition.lat) * Math.PI / 180
    const dLng = (placeLocation.longitude - userPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userPosition.lat * Math.PI / 180) * Math.cos(placeLocation.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < 0.1
  }, [userPosition, placeLocation])

  // Build banners: all factions, sorted by total influence DESC, user's faction highlighted
  const banners = useMemo(() => {
    const influenceMap = new Map(influence.map(i => [i.factionId, i]))
    const allIds = Array.from(factionColors.keys())
    return allIds
      .map(id => ({
        factionId: id,
        total: influenceMap.get(id)?.total ?? 0,
        placed: influenceMap.get(id)?.placed ?? 0,
        content: influenceMap.get(id)?.content ?? 0,
        color: factionColors.get(id) ?? '#8A7B6A',
        pattern: factionPatterns.get(id) ?? null,
        name: factionNames.get(id) ?? id,
      }))
      .sort((a, b) => b.total - a.total)
  }, [influence, factionColors, factionPatterns, factionNames])

  const dominant = banners[0]?.factionId

  const handleClick = useCallback(async (factionId: string) => {
    if (!userId || !userFactionId || loading) return
    if (influenceStock <= 0) {
      setError('Plus d\u2019influence disponible.')
      return
    }

    setLoading(true)
    setError(null)
    setPulseFaction(factionId)

    const params: Record<string, unknown> = {
      p_user_id: userId,
      p_place_id: placeId,
      p_points: 1,
      p_target_faction_id: factionId,
    }
    if (userPosition) {
      params.p_user_lat = userPosition.lat
      params.p_user_lng = userPosition.lng
    }

    const { data, error: rpcError } = await supabase.rpc('place_influence_action', params)

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      setTimeout(() => setPulseFaction(null), 300)
      return
    }

    const result = data as { success?: boolean; error?: string; remainingStock?: number; pointsPlaced?: number }

    if (result.error) {
      const messages: Record<string, string> = {
        no_faction: 'Rejoignez un H\u00e9ritage d\u2019abord.',
        not_enough_influence: 'Stock \u00e9puis\u00e9.',
        daily_remote_limit: 'Limite \u00e0 distance atteinte (5/jour).',
      }
      setError(messages[result.error] ?? result.error)
      setLoading(false)
      setTimeout(() => setPulseFaction(null), 300)
      return
    }

    if (result.remainingStock != null) {
      usePlayerStore.getState().setInfluenceStock(result.remainingStock)
    }

    useToastStore.getState().addToast({
      type: 'claim',
      message: `+1 influence ${factionId === userFactionId ? 'pour ton H\u00e9ritage' : ''} !`.replace('  ', ' '),
      timestamp: Date.now(),
    })

    setLoading(false)
    setTimeout(() => setPulseFaction(null), 300)
    onInfluencePlaced()
  }, [userId, userFactionId, influenceStock, loading, placeId, userPosition, onInfluencePlaced])

  const canClick = userId && userFactionId && influenceStock > 0

  return (
    <div className="influence-frame">
      <div className="influence-frame-header">
        <span className="influence-frame-title">Influence des H\u00e9ritages</span>
        {userId && (
          <span className="influence-frame-stock">
            {influenceStock} pt{influenceStock !== 1 ? 's' : ''}
            {isGps ? ' \u00b7 sur place' : ` \u00b7 \u00e0 distance`}
          </span>
        )}
      </div>

      <div className="influence-banners">
        {banners.map(b => {
          const isOwn = b.factionId === userFactionId
          const isDominant = b.factionId === dominant && b.total > 0
          const isPulsing = pulseFaction === b.factionId
          return (
            <button
              key={b.factionId}
              className={`influence-banner${isOwn ? ' influence-banner-own' : ''}${isDominant ? ' influence-banner-dominant' : ''}${isPulsing ? ' influence-banner-pulse' : ''}`}
              onClick={() => handleClick(b.factionId)}
              disabled={!canClick || loading}
              title={`Cliquer pour +1 influence ${b.name}`}
            >
              <div className="influence-banner-flag">
                {b.pattern ? (
                  <img src={b.pattern} alt="" className="influence-banner-pattern" />
                ) : (
                  <div className="influence-banner-color" style={{ backgroundColor: b.color }} />
                )}
                {isDominant && <span className="influence-banner-crown">\u2B50</span>}
              </div>
              <span className="influence-banner-score">{b.total}</span>
            </button>
          )
        })}
      </div>

      {error && <p className="influence-frame-error">{error}</p>}
      {!isGps && userId && userFactionId && (
        <p className="influence-frame-hint">5 clics/jour max \u00e0 distance</p>
      )}
    </div>
  )
}
