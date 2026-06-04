import { useState } from 'react'
import { PlaceCourtView } from './PlaceCourtView'
import './CourtFold.css'

interface CourtFoldProps {
  placeId: string
  placeTitle: string
  /** Nom du veilleur principal — source canonique : placeOverrides.veilleurName. */
  veilleurName: string | null
  /** Déplié d'emblée (ex. quand le mode Coupe des Héritages est actif sur la carte). */
  defaultOpen?: boolean
}

export function CourtFold({ placeId, placeTitle, veilleurName, defaultOpen = false }: CourtFoldProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="court-fold-wrap">
      <button className="court-fold-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="court-fold-crown">👑</span>
        <span className="court-fold-label">
          Conquête{veilleurName ? <> — veillé par <b>{veilleurName}</b></> : null}
        </span>
        <span className={`court-fold-chev${open ? ' open' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="court-fold-body">
          <PlaceCourtView placeId={placeId} placeTitle={placeTitle} />
        </div>
      )}
    </div>
  )
}
