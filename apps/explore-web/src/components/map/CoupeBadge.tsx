import { useState } from 'react'
import { CoupeModal } from './CoupeModal'

/**
 * V0.7 phase 3 — Bouton toolbar qui ouvre la Coupe des Héritages.
 * Style cohérent avec NotorietyBadge / CrownsBadge (.notoriety-badge).
 */
export function CoupeBadge() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="notoriety-badge coupe-badge"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="Coupe des Héritages"
        aria-label="Coupe des Héritages"
      >
        <span className="notoriety-icon" aria-hidden>{'🏆'}</span>
      </button>

      {open && <CoupeModal onClose={() => setOpen(false)} />}
    </>
  )
}
