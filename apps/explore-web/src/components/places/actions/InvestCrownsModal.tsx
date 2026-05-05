import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import './InvestCrownsModal.css'
import type { InvestCrownsResult, CourtSide } from '../../../types/court'

interface InvestCrownsModalProps {
  placeId: string
  placeTitle: string
  expeditionId: string
  expeditionName: string
  side: CourtSide
  /** Pour attaque : score à dépasser (= 50 + défense veilleur). Undefined si défense. */
  scoreToBeat?: number
  /** Score actuel de l'expé cible (pour preview "X → X+amount") */
  currentScore: number
  balance: number
  onClose: () => void
  onSuccess: (result: InvestCrownsResult) => void
}

export function InvestCrownsModal(props: InvestCrownsModalProps) {
  const { placeId, placeTitle, expeditionId, expeditionName, side, scoreToBeat, currentScore, balance, onClose, onSuccess } = props
  const userId = usePlayerStore(s => s.userId)
  const setCrownsBalance = useCrownsStore(s => s.setBalance)
  const [amount, setAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const max = Math.min(balance, 500)
  const newScore = currentScore + amount
  const willBascule = side === 'attack' && typeof scoreToBeat === 'number' && newScore > scoreToBeat

  async function handleConfirm() {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('invest_crowns', {
      p_user_id: userId,
      p_place_id: placeId,
      p_target_expedition_id: expeditionId,
      p_amount: amount,
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const result = data as InvestCrownsResult & { error?: string; balance?: number }
    if (result.error) {
      setError(result.error)
      return
    }
    setCrownsBalance(result.balance)
    onSuccess(result)
    onClose()
  }

  return (
    <div className="invest-overlay" onClick={onClose}>
      <div className="invest-modal" onClick={e => e.stopPropagation()}>
        <button className="invest-close" onClick={onClose}>{'✕'}</button>
        <h3 className="invest-title">
          {side === 'defense' ? 'Soutenir' : 'Défier'}
        </h3>
        <p className="invest-target">
          {expeditionName} sur <strong>{placeTitle}</strong>
        </p>

        <div className="invest-slider">
          <input
            type="range"
            min={1}
            max={max}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            disabled={max === 0}
          />
          <div className="invest-amount">
            {amount} <span>👑</span> sur {balance}
          </div>
        </div>

        <div className="invest-preview">
          {side === 'attack' && typeof scoreToBeat === 'number' && (
            <>
              <div>Score de votre expédition : <strong>{currentScore}</strong> → <strong>{newScore}</strong></div>
              <div>Score à battre : <strong>{scoreToBeat}</strong></div>
              {willBascule && <div className="invest-bascule">⚡ Cet investissement fera basculer le lieu !</div>}
            </>
          )}
          {side === 'defense' && (
            <div>Faveur veilleur renforcée : +<strong>{amount}</strong> au score de défense</div>
          )}
        </div>

        <p className="invest-warning">
          Vous allez investir <strong>{amount} Couronne{amount > 1 ? 's' : ''}</strong>. Brûlées définitivement.
        </p>

        {error && <div className="invest-error">{error}</div>}

        <div className="invest-buttons">
          <button className="invest-cancel" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="invest-confirm" onClick={handleConfirm} disabled={submitting || max === 0 || amount < 1}>
            {submitting ? 'Investissement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
