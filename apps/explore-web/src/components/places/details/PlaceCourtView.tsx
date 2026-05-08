import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import { useMapStore } from '../../../stores/mapStore'
import { CourtTensionBar } from './CourtTensionBar'
import { PatronsList } from './PatronsList'
import './PlaceCourtView.css'
import type { PlaceCourtState, CourtSide, CreateChallengerExpeditionResult, InvestCrownsResult, CourtStatus } from '../../../types/court'

interface PlaceCourtViewProps {
  placeId: string
  placeTitle: string
}

const STATUS_LABELS: Record<CourtStatus, string> = {
  paisible:       'Paisible',
  convoite:       'Convoité',
  sous_pression:  'Sous pression',
  en_siege:       'En siège',
  vacant:         'Lieu vierge',
}

interface PendingTaps {
  side: CourtSide
  expId: string
  count: number
}

interface BurstAnim {
  id: number
  side: CourtSide
}

const TAP_DEBOUNCE_MS = 250

function playClickSound() {
  try {
    const s = new Audio('/res/influence_click.mp3')
    s.volume = 0.5
    void s.play().catch(() => {})
  } catch { /* silent */ }
}

export function PlaceCourtView({ placeId, placeTitle: _placeTitle }: PlaceCourtViewProps) {
  const userId = usePlayerStore(s => s.userId)
  const balance = useCrownsStore(s => s.balance)
  const setCrownsBalance = useCrownsStore(s => s.setBalance)
  const refreshCrowns = useCrownsStore(s => s.refresh)

  const [state, setState] = useState<PlaceCourtState | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [notVeilled, setNotVeilled] = useState(false)
  const [creatingExp, setCreatingExp] = useState(false)
  const [bursts, setBursts] = useState<BurstAnim[]>([])
  // Tick pour forcer rerender quand pendingTapsRef change
  const [, forceUpdate] = useState(0)

  // Pending taps (refs pour éviter les races avec setTimeout/RPC)
  const pendingRef = useRef<PendingTaps | null>(null)
  const sendTimerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)

  // Helper qui relit le ref via fonction (évite le narrowing TS post-affectation null)
  const readPending = (): PendingTaps | null => pendingRef.current

  const fetchState = useCallback(async () => {
    if (!placeId) return
    const { data, error } = await supabase.rpc('get_place_court_state', {
      p_place_id: placeId,
      p_user_id: userId,
    })
    setLoading(false)
    if (error) {
      console.error('[PlaceCourtView] get_place_court_state error', error)
      setErrorMsg('Impossible de charger les informations pour le moment.')
      return
    }
    const d = data as PlaceCourtState & { error?: string }
    if (d.error === 'place_not_found') {
      setNotVeilled(true)
      setState(null)
      return
    }
    if (d.error) {
      setErrorMsg(d.error)
      setState(null)
      return
    }
    setNotVeilled(false)
    setState(d)
    setErrorMsg(null)
  }, [placeId, userId])

  useEffect(() => {
    setLoading(true)
    void fetchState()
  }, [fetchState])

  // Cleanup timer au démontage
  useEffect(() => () => {
    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current)
      sendTimerRef.current = null
    }
  }, [])

  const sendPendingTaps = useCallback(async () => {
    if (inFlightRef.current) return
    const pending = pendingRef.current
    if (!pending || pending.count <= 0) return
    if (!userId) return

    inFlightRef.current = true
    pendingRef.current = null
    forceUpdate(n => n + 1)

    try {
      const { data, error } = await supabase.rpc('invest_crowns', {
        p_user_id: userId,
        p_place_id: placeId,
        p_target_expedition_id: pending.expId,
        p_amount: pending.count,
      })
      if (error) {
        console.error('[PlaceCourtView] invest_crowns error', error)
        // Resync balance + state
        if (userId) await refreshCrowns(userId)
        await fetchState()
        return
      }
      const r = data as InvestCrownsResult & { error?: string; balance?: number }
      if (r.error) {
        console.warn('[PlaceCourtView] invest_crowns refused:', r.error)
        if (userId) await refreshCrowns(userId)
        await fetchState()
        return
      }
      // Aligne la balance avec le serveur (peut différer si pendant ce temps user a tapé X fois en plus)
      // On ajoute la diff entre la balance optimistic affichée et la balance serveur
      setCrownsBalance(r.balance)
      await fetchState()
    } finally {
      inFlightRef.current = false
      // S'il y a eu d'autres taps pendant que le RPC tournait → reflusher
      const after = readPending()
      if (after && after.count > 0) {
        void sendPendingTaps()
      }
    }
  }, [userId, placeId, fetchState, refreshCrowns, setCrownsBalance])

  const queueTap = useCallback((side: CourtSide, expId: string) => {
    const currentPending = readPending()
    if (balance < 1 + (currentPending?.count ?? 0)) return // plus de Couronnes en stock optimistic

    playClickSound()

    // Optimistic balance --
    setCrownsBalance(balance - 1)

    // Burst animation
    const id = Date.now() + Math.random()
    setBursts(prev => [...prev, { id, side }])
    window.setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== id))
    }, 900)

    // Empile le tap
    const existing = readPending()
    if (!existing || existing.expId !== expId) {
      pendingRef.current = { side, expId, count: 1 }
    } else {
      existing.count += 1
    }
    forceUpdate(n => n + 1)

    // Debounce envoi
    if (sendTimerRef.current) window.clearTimeout(sendTimerRef.current)
    sendTimerRef.current = window.setTimeout(() => {
      sendTimerRef.current = null
      void sendPendingTaps()
    }, TAP_DEBOUNCE_MS)
  }, [balance, setCrownsBalance, sendPendingTaps])

  if (notVeilled) return null
  if (loading || !state) {
    return <div className="court-loading">{errorMsg ?? 'Chargement…'}</div>
  }

  const { vacant, veilleur, scoreVeilleur, defenseFavorPoints, threats, menaceHaute, status, topPatrons, callerContext } = state
  const isMember = callerContext?.isMemberOfVeilleur ?? false
  const userChallengerExp = callerContext?.challengerExpeditions?.[0]
  const challengerThreat = userChallengerExp ? threats.find(x => x.expeditionId === userChallengerExp) : null

  // Score optimistic (en local + pending)
  const pendingTaps = readPending()
  const pendingDefense = pendingTaps && veilleur && pendingTaps.expId === veilleur.expeditionId && pendingTaps.side === 'defense' ? pendingTaps.count : 0
  const pendingAttack = pendingTaps && userChallengerExp && pendingTaps.expId === userChallengerExp && pendingTaps.side === 'attack' ? pendingTaps.count : 0
  const optimisticVeilleurScore = scoreVeilleur + pendingDefense
  const optimisticChallengerScore = (challengerThreat?.score ?? 0) + pendingAttack
  const optimisticMenace = userChallengerExp ? Math.max(menaceHaute ?? 0, optimisticChallengerScore) : (menaceHaute ?? 0)

  const supportExpId = veilleur?.expeditionId ?? null
  const handleSupportTap = () => {
    if (!supportExpId || balance < 1) return
    queueTap('defense', supportExpId)
  }

  const handleContestTap = async () => {
    if (balance < 1 || creatingExp) return
    if (userChallengerExp) {
      queueTap('attack', userChallengerExp)
      return
    }
    // Premier tap : il faut créer l'expé challenger d'abord
    setCreatingExp(true)
    const { data, error } = await supabase.rpc('create_challenger_expedition', {
      p_user_id: userId,
      p_place_id: placeId,
    })
    setCreatingExp(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    const r = data as CreateChallengerExpeditionResult & { error?: string }
    if (r.error) {
      setErrorMsg(r.error === 'no_faction' ? "Vous devez choisir une faction d'abord." : r.error)
      return
    }
    await fetchState()
    queueTap('attack', r.expeditionId)
  }

  // V0.7.6 — variable `initials` retirée (l'avatar du veilleur n'est plus
  // dupliqué dans le header, il est rendu par CourtTensionBar avec sa propre
  // logique de fallback initiale).

  return (
    <div className={`court-view court-status-${status}`}>
      {/* Statut en absolute top-right */}
      <div className={`court-status-pill court-status-${status}`}>
        {STATUS_LABELS[status]}
      </div>

      {/* Ligne vacant : message d'invitation à poser sa marque */}
      {vacant && (
        <div className="court-vacant-row">
          <div className="court-vacant-icon">🏴</div>
          <div className="court-vacant-text">
            <span className="court-leader-label">Lieu vierge</span>
            <span className="court-vacant-title">Personne ne veille ici</span>
            <span className="court-vacant-hint">1 Couronne suffit pour t'établir — ensuite c'est la course au plus offrant</span>
          </div>
        </div>
      )}

      {/* V0.7.6 (8/05) — Ligne veilleur : texte seul, l'avatar n'est plus
          dupliqué ici (il apparaît à côté de la jauge de tension en dessous). */}
      {!vacant && veilleur && (
      <div className="court-leader-row">
        <div className="court-leader-text">
          <span className="court-leader-label">Lieu veillé par</span>
          <div className="court-leader-name-row">
            {veilleur.leaderUserId ? (
              <button
                type="button"
                className="court-leader-name court-leader-name-btn"
                onClick={() => useMapStore.getState().setSelectedPlayerId(veilleur.leaderUserId!)}
                title={`Voir le profil de ${veilleur.leaderName}`}
              >
                {veilleur.leaderName}
              </button>
            ) : (
              <span className="court-leader-name">{veilleur.leaderName}</span>
            )}
            {veilleur.factionPattern && veilleur.factionColor && (
              <span
                className="court-leader-faction-icon"
                style={{
                  backgroundColor: veilleur.factionColor,
                  WebkitMaskImage: `url(${veilleur.factionPattern})`,
                  maskImage: `url(${veilleur.factionPattern})`,
                }}
                title={veilleur.name}
                aria-label={`Faction : ${veilleur.name}`}
              />
            )}
          </div>
          {!veilleur.byInfluence && (
            <span className="court-faveur-acquise">Acquis par sa visite sur le lieu</span>
          )}
          {veilleur.byInfluence && (
            <span className="court-by-influence">tient ce lieu à distance</span>
          )}
        </div>
      </div>
      )}

      {/* V0.7.6 — Jauge gravée + cluster avatars (cf. mockup F validé) */}
      <CourtTensionBar
        scoreVeilleur={optimisticVeilleurScore}
        menaceHaute={optimisticMenace}
        defenseFavorPoints={defenseFavorPoints ?? 0}
        patrons={topPatrons}
        veilleur={veilleur}
      />

      {/* Boutons tap-rafale */}
      <div className="court-actions">
        {!vacant && (
          <button
            className="court-btn-support"
            onClick={handleSupportTap}
            disabled={balance < 1}
            aria-label={isMember ? 'Renforcer la veille' : 'Soutenir le veilleur'}
          >
            <span className="court-btn-icon">🛡</span>
            <span className="court-btn-label">{isMember ? 'Renforcer la veille' : 'Soutenir le veilleur'}</span>
            <span className="court-btn-cost">−1 🪙</span>
            {bursts.filter(b => b.side === 'defense').map(b => (
              <span key={b.id} className="court-btn-burst">+1</span>
            ))}
          </button>
        )}
        {(vacant || !isMember) && (
          <button
            className="court-btn-contest"
            onClick={handleContestTap}
            disabled={balance < 1 || creatingExp}
            aria-label={vacant ? 'Poser ma marque sur ce lieu vierge' : 'Influencer ce lieu'}
          >
            <span className="court-btn-icon">⚔</span>
            <span className="court-btn-label">
              {creatingExp ? 'Préparation…' : (vacant ? 'Poser ma marque' : 'Influencer')}
            </span>
            <span className="court-btn-cost">−1 🪙</span>
            {bursts.filter(b => b.side === 'attack').map(b => (
              <span key={b.id} className="court-btn-burst">+1</span>
            ))}
          </button>
        )}
      </div>

      {balance < 1 && (
        <p className="court-no-balance">
          Vous n'avez plus de Couronnes. Récoltez sur vos lieux veillés, sortez des lieux du brouillard ou résolvez des énigmes.
        </p>
      )}
      {errorMsg && <p className="court-error">{errorMsg}</p>}

      <PatronsList patrons={topPatrons} currentUserId={userId ?? undefined} />
    </div>
  )
}
