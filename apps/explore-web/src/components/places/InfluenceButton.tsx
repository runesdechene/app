import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import './InfluenceButton.css'

interface InfluenceButtonProps {
  placeId: string
  placeLocation: { latitude: number; longitude: number }
  onInfluencePlaced: () => void
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

export function InfluenceButton({ placeId, placeLocation, onInfluencePlaced }: InfluenceButtonProps) {
  const userId = usePlayerStore(s => s.userId)
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userPosition = usePlayerStore(s => s.userPosition)
  const userFactionId = usePlayerStore(s => s.userFactionId)

  const [amount, setAmount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGps = useMemo(() => {
    if (!userPosition) return false
    const dist = haversineKm(userPosition.lat, userPosition.lng, placeLocation.latitude, placeLocation.longitude)
    return dist < 0.1 // < 100m
  }, [userPosition, placeLocation])

  if (!userId || !userFactionId) return null
  if (influenceStock <= 0) {
    return (
      <div className="influence-btn-wrap">
        <div className="influence-btn-header">
          <span className="influence-btn-stock">
            Stock d&apos;influence : <span className="influence-btn-stock-value">0</span>
          </span>
        </div>
        <p className="influence-btn-limit">
          Plus d&apos;influence disponible. Gagnez-en via les &eacute;nigmes, contributions ou visites GPS.
        </p>
      </div>
    )
  }

  const maxAmount = influenceStock

  async function handleSubmit() {
    if (!userId || loading || amount <= 0) return
    setLoading(true)
    setError(null)

    const params: Record<string, unknown> = {
      p_user_id: userId,
      p_place_id: placeId,
      p_points: amount,
    }
    if (userPosition) {
      params.p_user_lat = userPosition.lat
      params.p_user_lng = userPosition.lng
    }

    const { data, error: rpcError } = await supabase.rpc('place_influence_action', params)

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    const result = data as { success?: boolean; error?: string; pointsPlaced?: number; remainingStock?: number; gps?: boolean }

    if (result.error) {
      const messages: Record<string, string> = {
        no_faction: 'Rejoignez un H\u00e9ritage d\u2019abord.',
        not_enough_influence: 'Stock insuffisant.',
        daily_remote_limit: 'Limite quotidienne \u00e0 distance atteinte.',
      }
      setError(messages[result.error] ?? result.error)
      setLoading(false)
      return
    }

    // Update store
    if (result.remainingStock != null) {
      usePlayerStore.getState().setInfluenceStock(result.remainingStock)
    }

    useToastStore.getState().addToast({
      type: 'claim',
      message: `+${result.pointsPlaced ?? amount} influence plac\u00e9e !`,
      timestamp: Date.now(),
    })

    setAmount(1)
    setLoading(false)
    onInfluencePlaced()
  }

  return (
    <div className="influence-btn-wrap">
      <div className="influence-btn-header">
        <span className="influence-btn-stock">
          Stock : <span className="influence-btn-stock-value">{influenceStock}</span>
        </span>
        <span className={`influence-btn-mode ${isGps ? 'gps' : 'remote'}`}>
          {isGps ? 'Sur place' : '\u00c0 distance'}
        </span>
      </div>

      <div className="influence-btn-controls">
        <button
          className="influence-btn-minus"
          onClick={() => setAmount(a => Math.max(1, a - 1))}
          disabled={amount <= 1}
        >
          -
        </button>
        <span className="influence-btn-amount">{amount}</span>
        <input
          type="range"
          className="influence-btn-slider"
          min={1}
          max={maxAmount}
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
        />
        <button
          className="influence-btn-plus"
          onClick={() => setAmount(a => Math.min(maxAmount, a + 1))}
          disabled={amount >= maxAmount}
        >
          +
        </button>
      </div>

      <button
        className="influence-btn-submit"
        onClick={handleSubmit}
        disabled={loading || amount <= 0}
      >
        {loading ? 'Placement...' : `Placer ${amount} influence`}
      </button>

      {!isGps && (
        <p className="influence-btn-limit">Max 5/jour \u00e0 distance</p>
      )}
      {isGps && (
        <p className="influence-btn-limit">Sur place &mdash; illimit\u00e9</p>
      )}

      {error && <p className="influence-btn-error">{error}</p>}
    </div>
  )
}
