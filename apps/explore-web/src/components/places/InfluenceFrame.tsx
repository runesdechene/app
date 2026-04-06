import { useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
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

/** Short satisfying "pop" sound via Web Audio API */
function playPopSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close(), 300)
  } catch { /* silent fallback */ }
}

/** Spawn particle burst around click position */
function spawnParticles(container: HTMLElement) {
  const emojis = ['✨', '⭐', '🌟', '💫']
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('span')
    el.className = 'influence-particle'
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)]
    const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5
    const dist = 30 + Math.random() * 25
    el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`)
    el.style.setProperty('--ty', `${Math.sin(angle) * dist}px`)
    container.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
}

export function InfluenceFrame({ placeId, influence, factionColors, factionPatterns, factionNames, placeLocation, onInfluencePlaced: _onInfluencePlaced }: InfluenceFrameProps) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userPosition = usePlayerStore(s => s.userPosition)
  const gameMode = usePlayerStore(s => s.gameMode)

  // Optimistic local score deltas (faction -> bonus points added locally)
  const [localBonus, setLocalBonus] = useState<Map<string, number>>(new Map())
  const [pulseFaction, setPulseFaction] = useState<string | null>(null)
  const [remoteUsed, setRemoteUsed] = useState(0) // clicks spent remotely on this place today
  const [shakeStock, setShakeStock] = useState(false)
  const pendingRef = useRef(false)
  const MAX_REMOTE_PER_PLACE = 5

  if (gameMode !== 'conquest') return null

  const isGps = useMemo(() => {
    if (!userPosition) return false
    const R = 6371
    const dLat = (placeLocation.latitude - userPosition.lat) * Math.PI / 180
    const dLng = (placeLocation.longitude - userPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userPosition.lat * Math.PI / 180) * Math.cos(placeLocation.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < 0.1
  }, [userPosition, placeLocation])

  // Build banners with local bonus applied
  const banners = useMemo(() => {
    const influenceMap = new Map(influence.map(i => [i.factionId, i]))
    const allIds = Array.from(factionColors.keys())
    return allIds
      .map(id => {
        const bonus = localBonus.get(id) ?? 0
        const base = influenceMap.get(id)
        return {
          factionId: id,
          total: (base?.total ?? 0) + bonus,
          placed: (base?.placed ?? 0) + bonus,
          content: base?.content ?? 0,
          color: factionColors.get(id) ?? '#8A7B6A',
          pattern: factionPatterns.get(id) ?? null,
          name: factionNames.get(id) ?? id,
        }
      })
      // Stable order: keep faction DB order (from factionColors Map insertion order)
      // No re-sorting by score to prevent banners from swapping on click
  }, [influence, factionColors, factionPatterns, factionNames, localBonus])

  const dominant = banners.reduce((best, b) => b.total > (best?.total ?? 0) ? b : best, banners[0])?.factionId

  const handleClick = useCallback(async (factionId: string, buttonEl: HTMLElement) => {
    if (!userId || !userFactionId || pendingRef.current) return
    if (influenceStock <= 0 || (!isGps && remoteUsed >= MAX_REMOTE_PER_PLACE)) {
      // Shake the stock indicator to signal "can't click"
      setShakeStock(true)
      setTimeout(() => setShakeStock(false), 500)
      return
    }

    // Optimistic update — instant feedback
    pendingRef.current = true
    setPulseFaction(factionId)
    playPopSound()
    spawnParticles(buttonEl)

    // Track remote usage
    if (!isGps) setRemoteUsed(r => r + 1)

    // Update local score + stock immediately
    setLocalBonus(prev => {
      const next = new Map(prev)
      next.set(factionId, (prev.get(factionId) ?? 0) + 1)
      return next
    })
    usePlayerStore.getState().setInfluenceStock(influenceStock - 1)

    // Fire RPC in background
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

    if (rpcError || (data as { error?: string })?.error) {
      // Rollback optimistic update
      if (!isGps) setRemoteUsed(r => Math.max(0, r - 1))
      setLocalBonus(prev => {
        const next = new Map(prev)
        const cur = prev.get(factionId) ?? 1
        if (cur <= 1) next.delete(factionId)
        else next.set(factionId, cur - 1)
        return next
      })
      usePlayerStore.getState().setInfluenceStock(influenceStock) // restore

      // Silent rollback — header already shows the state
    } else {
      // Sync real remaining stock from server
      const result = data as { remainingStock?: number }
      if (result.remainingStock != null) {
        usePlayerStore.getState().setInfluenceStock(result.remainingStock)
      }
    }

    pendingRef.current = false
    setTimeout(() => setPulseFaction(null), 300)
  }, [userId, userFactionId, influenceStock, placeId, userPosition])

  const remoteExhausted = !isGps && remoteUsed >= MAX_REMOTE_PER_PLACE
  const canClick = userId && userFactionId && influenceStock > 0 && !remoteExhausted

  return (
    <div className="influence-frame">
      <div className="influence-frame-header">
        <span className="influence-frame-title">Influence des H\u00e9ritages</span>
        {userId && (
          <span className={`influence-frame-stock${!canClick ? ' influence-frame-stock-exhausted' : ''}${shakeStock ? ' influence-frame-stock-shake' : ''}`}>
            {influenceStock > 0
              ? isGps
                ? `${influenceStock} pts \u00b7 sur place`
                : `${influenceStock} pts \u00b7 ${MAX_REMOTE_PER_PLACE - remoteUsed}/${MAX_REMOTE_PER_PLACE} ici`
              : 'Stock \u00e9puis\u00e9'
            }
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
              className={`influence-banner${isOwn ? ' influence-banner-own' : ''}${isDominant ? ' influence-banner-dominant' : ''}${isPulsing ? ' influence-banner-pulse' : ''}${b.total === 0 ? ' influence-banner-zero' : ''}`}
              onClick={(e) => { if (canClick) handleClick(b.factionId, e.currentTarget) }}
              disabled={!canClick}
              title={`+1 influence ${b.name}`}
            >
              <div className="influence-banner-flag">
                {b.pattern ? (
                  <img src={b.pattern} alt="" className="influence-banner-pattern" />
                ) : (
                  <div className="influence-banner-color" style={{ backgroundColor: b.color }} />
                )}
                {isDominant && <span className="influence-banner-crown">{'\u2B50'}</span>}
              </div>
              <span className="influence-banner-score">{b.total}</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
