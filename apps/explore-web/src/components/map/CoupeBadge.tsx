import { useState } from 'react'
import { useCoupe } from '../../hooks/useCoupe'
import { usePlayerStore } from '../../stores/playerStore'
import { CoupeModal } from './CoupeModal'

/**
 * V0.7 phase 3 — Bouton toolbar qui ouvre la Coupe des Héritages.
 * Affiche le score perso de la saison courante (myBreakdown.score).
 * Polling 30s pour ressentir la progression quasi-temps réel.
 *
 * Visible uniquement quand le mode Coupe est activé (factionColorMode).
 * Mode désactivé = on cache aussi le scoreboard, cohérent avec le toggle off.
 */
export function CoupeBadge() {
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const [open, setOpen] = useState(false)
  const { state } = useCoupe(factionColorMode, 30000)
  const myScore = state?.myBreakdown?.score ?? 0

  if (!factionColorMode) return null

  return (
    <>
      <button
        type="button"
        className="notoriety-badge coupe-badge"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title={'Héritages'}
        aria-label={'Héritages'}
      >
        <span className="notoriety-icon" aria-hidden>{'🏆'}</span>
        <span className="notoriety-value" key={`coupe-${myScore}`}>{myScore}</span>
      </button>

      {open && <CoupeModal onClose={() => setOpen(false)} />}
    </>
  )
}
