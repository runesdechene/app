import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import { CourtTensionBar } from './CourtTensionBar'
import { PatronsList } from './PatronsList'
import { CourtChronicle } from './CourtChronicle'
import { InvestCrownsModal } from '../actions/InvestCrownsModal'
import './PlaceCourtView.css'
import type { PlaceCourtState, CourtSide, CreateChallengerExpeditionResult, CourtStatus } from '../../../types/court'

interface PlaceCourtViewProps {
  placeId: string
  placeTitle: string
}

interface InvestTarget {
  expeditionId: string
  expeditionName: string
  side: CourtSide
  currentScore: number
}

const STATUS_LABELS: Record<CourtStatus, string> = {
  paisible:       'Paisible',
  convoite:       'Convoité',
  sous_pression:  'Sous pression',
  en_siege:       'En siège',
}

export function PlaceCourtView({ placeId, placeTitle }: PlaceCourtViewProps) {
  const userId = usePlayerStore(s => s.userId)
  const balance = useCrownsStore(s => s.balance)
  const [state, setState] = useState<PlaceCourtState | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTarget, setInvestTarget] = useState<InvestTarget | null>(null)
  const [creatingExp, setCreatingExp] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [notVeilled, setNotVeilled] = useState(false)

  const fetchState = useCallback(async () => {
    setLoading(true)
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
    if (d.error === 'not_veilled') {
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
  }, [placeId, userId])

  useEffect(() => { void fetchState() }, [fetchState])

  if (notVeilled) return null
  if (loading || !state) {
    return <div className="court-loading">{errorMsg ?? 'Chargement…'}</div>
  }

  const { veilleur, scoreVeilleur, threats, menaceHaute, status, topPatrons, chronicle, callerContext } = state
  const isMember = callerContext?.isMemberOfVeilleur ?? false
  const userChallengerExp = callerContext?.challengerExpeditions?.[0]
  const challengerThreat = userChallengerExp ? threats.find(x => x.expeditionId === userChallengerExp) : null

  const handleSupport = () => {
    setInvestTarget({
      expeditionId: veilleur.expeditionId,
      expeditionName: veilleur.leaderName,
      side: 'defense',
      currentScore: scoreVeilleur - 50,
    })
  }

  const handleChallenge = () => {
    if (!userChallengerExp) return
    setInvestTarget({
      expeditionId: userChallengerExp,
      expeditionName: challengerThreat?.name ?? 'Mon expédition',
      side: 'attack',
      currentScore: challengerThreat?.score ?? 0,
    })
  }

  const handleCreateChallenger = async () => {
    if (!userId || creatingExp) return
    setCreatingExp(true)
    setErrorMsg(null)
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
    setInvestTarget({
      expeditionId: r.expeditionId,
      expeditionName: 'Mon expédition',
      side: 'attack',
      currentScore: 0,
    })
  }

  const showChallengeFlow = !isMember && !userChallengerExp
  const showInvestChallenger = !isMember && !!userChallengerExp

  return (
    <div className={`court-view court-status-${status}`}>
      {/* Statut en absolute top-right */}
      <div className={`court-status-pill court-status-${status}`}>
        {STATUS_LABELS[status]}
      </div>

      {/* Lieu protégé par [Leader] + boule colorée avec icône faction */}
      <div className="court-leader-row">
        <div className="court-leader-text">
          <span className="court-leader-label">Lieu protégé par</span>
          <span className="court-leader-name">{veilleur.leaderName}</span>
          {veilleur.byInfluence && (
            <span className="court-by-influence">tient ce lieu à distance</span>
          )}
        </div>
        {veilleur.factionColor && (
          <div
            className="court-leader-orb"
            style={{ backgroundColor: veilleur.factionColor }}
            title={veilleur.name}
            aria-label={`Faction : ${veilleur.name}`}
          >
            {veilleur.factionPattern && (
              <span
                className="court-leader-orb-icon"
                style={{
                  WebkitMaskImage: `url(${veilleur.factionPattern})`,
                  maskImage: `url(${veilleur.factionPattern})`,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Jauge faveur / menace */}
      <CourtTensionBar
        scoreVeilleur={scoreVeilleur}
        menaceHaute={menaceHaute ?? 0}
        status={status}
      />

      {/* Boutons */}
      <div className="court-actions">
        <button onClick={handleSupport} disabled={balance < 1}>
          {isMember ? 'Renforcer la veille' : 'Soutenir le veilleur'}
        </button>
        {showInvestChallenger && (
          <button className="challenge" onClick={handleChallenge} disabled={balance < 1}>
            Influencer
          </button>
        )}
        {showChallengeFlow && (
          <button className="challenge" onClick={handleCreateChallenger} disabled={balance < 1 || creatingExp}>
            {creatingExp ? 'Préparation…' : 'Influencer'}
          </button>
        )}
      </div>

      {balance < 1 && (
        <p className="court-no-balance">
          Vous n'avez plus de Couronnes. Récoltez sur vos lieux veillés ou résolvez des énigmes pour en gagner.
        </p>
      )}
      {errorMsg && <p className="court-error">{errorMsg}</p>}

      <PatronsList patrons={topPatrons} currentUserId={userId ?? undefined} />

      <CourtChronicle entries={chronicle} />

      {investTarget && (
        <InvestCrownsModal
          placeId={placeId}
          placeTitle={placeTitle}
          expeditionId={investTarget.expeditionId}
          expeditionName={investTarget.expeditionName}
          side={investTarget.side}
          scoreToBeat={investTarget.side === 'attack' ? scoreVeilleur : undefined}
          currentScore={investTarget.currentScore}
          balance={balance}
          onClose={() => setInvestTarget(null)}
          onSuccess={() => { void fetchState() }}
        />
      )}
    </div>
  )
}
