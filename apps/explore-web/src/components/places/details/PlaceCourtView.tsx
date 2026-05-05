import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import { CourtTensionBar } from './CourtTensionBar'
import { PatronsList } from './PatronsList'
import { CourtChronicle } from './CourtChronicle'
import { InvestCrownsModal } from '../actions/InvestCrownsModal'
import './PlaceCourtView.css'
import type { PlaceCourtState, CourtSide, CreateChallengerExpeditionResult } from '../../../types/court'

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
      setErrorMsg('Impossible de charger la Cour pour le moment.')
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

  // Lieu pas veillé → silence (pas de section Cour)
  if (notVeilled) return null

  if (loading || !state) {
    return <div className="court-loading">{errorMsg ?? 'Chargement de la Cour…'}</div>
  }

  const { veilleur, scoreVeilleur, threats, menaceHaute, status, topPatrons, chronicle, callerContext } = state
  const isMember = callerContext?.isMemberOfVeilleur ?? false
  const userChallengerExp = callerContext?.challengerExpeditions?.[0]
  const challengerThreat = userChallengerExp ? threats.find(x => x.expeditionId === userChallengerExp) : null

  const handleSupport = () => {
    setInvestTarget({
      expeditionId: veilleur.expeditionId,
      expeditionName: veilleur.name,
      side: 'defense',
      currentScore: scoreVeilleur - 50,  // l'UI affiche "+amount à la défense" (faveur 50 reste implicite)
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
      setErrorMsg(r.error === 'no_faction' ? 'Vous devez choisir une faction d\'abord.' : r.error)
      return
    }
    // Refetch + ouvre la modale d'investissement sur la nouvelle expé
    await fetchState()
    setInvestTarget({
      expeditionId: r.expeditionId,
      expeditionName: 'Mon expédition',
      side: 'attack',
      currentScore: 0,
    })
  }

  const showChallengeFlow = !isMember && !userChallengerExp
  const showInvestChallenger = !isMember && userChallengerExp

  return (
    <div className="court-view">
      <h3 className="court-section-title">La Cour</h3>

      <CourtTensionBar
        scoreVeilleur={scoreVeilleur}
        menaceHaute={menaceHaute ?? 0}
        status={status}
      />

      <div className="court-veilleur">
        <div className="court-veilleur-name">
          Veilleur : <strong>{veilleur.name}</strong>
          {veilleur.byInfluence && <span className="court-by-influence"> · tient ce lieu à distance</span>}
        </div>
        <div className="court-veilleur-members">
          {veilleur.members.map(m => (
            <span key={m.userId} className="court-member-pill">{m.displayName}</span>
          ))}
        </div>
      </div>

      <div className="court-actions">
        <button onClick={handleSupport} disabled={balance < 1}>
          {isMember ? 'Renforcer la veille' : 'Soutenir le veilleur'}
        </button>
        {showInvestChallenger && (
          <button className="challenge" onClick={handleChallenge} disabled={balance < 1}>
            Investir pour mon expédition
          </button>
        )}
        {showChallengeFlow && (
          <button className="challenge" onClick={handleCreateChallenger} disabled={balance < 1 || creatingExp}>
            {creatingExp ? 'Création…' : 'Défier'}
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
