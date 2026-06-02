import { useState } from 'react'
import { PlaceCourtView } from './PlaceCourtView'
import './CourtFold.css'

interface CourtFoldProps {
  placeId: string
  placeTitle: string
  guardianName: string | null
}

export function CourtFold({ placeId, placeTitle, guardianName }: CourtFoldProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="court-fold-wrap">
      <button className="court-fold-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="court-fold-crown">👑</span>
        <span className="court-fold-label">
          Conquête{guardianName ? <> — veillé par <b>{guardianName}</b></> : null}
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
