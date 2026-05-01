import { useState } from 'react'
import { useCoupe } from '../../hooks/useCoupe'
import { CoupeModal } from './CoupeModal'

/**
 * V0.7 phase 3 — Bouton toolbar qui ouvre la Coupe des Héritages.
 * Affiche le score perso de la saison courante (myBreakdown.score).
 * Polling 30s pour ressentir la progression quasi-temps réel.
 */
export function CoupeBadge() {
  const [open, setOpen] = useState(false)
  const { state } = useCoupe(true, 30000)
  const myScore = state?.myBreakdown?.score ?? 0

  return (
    <>
      <button
        type="button"
        className="notoriety-badge coupe-badge"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title={'Coupe des Héritages'}
        aria-label={'Coupe des Héritages'}
      >
        <span className="notoriety-icon" aria-hidden>{'🏆'}</span>
        <span className="notoriety-value" key={`coupe-${myScore}`}>{myScore}</span>
      </button>

      {open && <CoupeModal onClose={() => setOpen(false)} />}
    </>
  )
}
