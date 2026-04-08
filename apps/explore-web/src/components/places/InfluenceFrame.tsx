import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
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

/** Influence click sound */
function playPopSound() {
  try {
    const s = new Audio('/res/influence_click.mp3')
    s.volume = 0.5
    s.play()
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

export function InfluenceFrame({ placeId, influence, factionColors, factionPatterns, factionNames, placeLocation: _placeLocation, onInfluencePlaced: _onInfluencePlaced }: InfluenceFrameProps) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userPosition = usePlayerStore(s => s.userPosition)
  // Optimistic local score deltas (faction -> bonus points added locally)
  const [localBonus, setLocalBonus] = useState<Map<string, number>>(new Map())
  const [pulseFaction, setPulseFaction] = useState<string | null>(null)
  const [shakeStock, setShakeStock] = useState(false)
  const [betrayalConfirmed, setBetrayalConfirmed] = useState(false)
  const [betrayalTarget, setBetrayalTarget] = useState<{ factionId: string; buttonEl: HTMLElement } | null>(null)

  // Reset confirmation quand on change de lieu
  useEffect(() => { setBetrayalConfirmed(false) }, [placeId])

  const pendingRef = useRef(false)

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
    if (influenceStock <= 0) {
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
      const result = data as { remainingStock?: number; placeInfluence?: Array<{ factionId: string; placed: number; permanent: number; content: number; total: number }> }
      if (result.remainingStock != null) {
        usePlayerStore.getState().setInfluenceStock(result.remainingStock)
      }
      // Mettre à jour la carte : faction dominante
      if (result.placeInfluence) {
        const dominant = result.placeInfluence.reduce((best, pi) =>
          pi.total > (best?.total ?? 0) ? pi : best, result.placeInfluence[0])
        if (dominant) {
          const { setPlaceOverride } = useMapStore.getState()
          setPlaceOverride(placeId, {
            factionId: dominant.factionId,
            tagColor: factionColors.get(dominant.factionId) ?? undefined,
            factionPattern: factionPatterns.get(dominant.factionId) ?? undefined,
            claimed: true,
            score: dominant.total,
          })
        }
      }
    }

    pendingRef.current = false
    setTimeout(() => setPulseFaction(null), 300)
  }, [userId, userFactionId, influenceStock, placeId, userPosition])

  const canClick = userId && userFactionId && influenceStock > 0

  return (
    <div className="influence-frame">
      <div className="influence-frame-header">
        <span className="influence-frame-title">🏆 Coupe des Héritages</span>
        {userId && (
          <span className={`influence-frame-stock${!canClick ? ' influence-frame-stock-exhausted' : ''}${shakeStock ? ' influence-frame-stock-shake' : ''}`}>
            {influenceStock <= 0
              ? 'Plus de points disponibles'
              : `${influenceStock} points à placer`
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
              onClick={(e) => {
                if (!canClick) return
                if (b.factionId !== userFactionId && !betrayalConfirmed) {
                  setBetrayalTarget({ factionId: b.factionId, buttonEl: e.currentTarget })
                  return
                }
                handleClick(b.factionId, e.currentTarget)
              }}
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

      {/* Confirmation trahison */}
      {betrayalTarget && (
        <div className="influence-betrayal-overlay">
          <div className="influence-betrayal-dialog">
            <p>Tiens, vous soutenez un autre Heritage ? Un agent double, c'est intéressant 👀</p>
            <p style={{ fontSize: '0.85em', opacity: 0.7 }}>Confirmer ?</p>
            <div className="influence-betrayal-actions">
              <button onClick={() => setBetrayalTarget(null)}>Non, erreur</button>
              <button onClick={() => {
                setBetrayalConfirmed(true)
                setBetrayalTarget(null)
                handleClick(betrayalTarget.factionId, betrayalTarget.buttonEl)
              }}>Influencer</button>
            </div>
          </div>
        </div>
      )}

      {influenceStock <= 0 && (
        <div className="influence-frame-hint">
          <span className="influence-frame-hint-title">Comment gagner de l'influence ?</span>
          <ul className="influence-frame-hint-list">
            <li>🔮 Résoudre les énigmes du jour → stock à placer</li>
            <li>🧭 Visiter un lieu en GPS → stock à placer</li>
            <li>📜 Écrire un récit → influence permanente</li>
          </ul>
        </div>
      )}

    </div>
  )
}
