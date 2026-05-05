import './CourtTensionBar.css'
import type { CourtStatus } from '../../../types/court'

interface CourtTensionBarProps {
  scoreVeilleur: number
  menaceHaute: number
  /** @deprecated V086 — le statut est désormais affiché dans une pilule
   *  absolute top-right de PlaceCourtView. Conservé en prop pour rétrocompat. */
  status?: CourtStatus
}

export function CourtTensionBar({ scoreVeilleur, menaceHaute }: CourtTensionBarProps) {
  const total = scoreVeilleur + menaceHaute
  const veilleurPct = total > 0 ? Math.round((scoreVeilleur / total) * 100) : 100

  return (
    <div className="court-tension">
      <div className="court-tension-bar" role="img" aria-label={`Faveur veilleur ${scoreVeilleur}, menace ${menaceHaute}`}>
        <div className="court-tension-fill veilleur" style={{ width: `${veilleurPct}%` }} />
        <div className="court-tension-fill challenger" style={{ width: `${100 - veilleurPct}%` }} />
      </div>
      <div className="court-tension-scores">
        <span className="court-score-veilleur">Faveur {scoreVeilleur}</span>
        {menaceHaute > 0 && <span className="court-score-menace">Menace {menaceHaute}</span>}
      </div>
    </div>
  )
}
