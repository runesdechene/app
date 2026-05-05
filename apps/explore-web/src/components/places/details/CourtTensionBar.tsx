import './CourtTensionBar.css'
import type { CourtStatus } from '../../../types/court'

interface CourtTensionBarProps {
  scoreVeilleur: number
  menaceHaute: number
  /** @deprecated V086 — le statut est désormais dans la pilule top-right de PlaceCourtView */
  status?: CourtStatus
}

/** Position du trait "+50 acquis" sur la barre, en pourcentage. */
const FAVEUR_BASE = 50

export function CourtTensionBar({ scoreVeilleur, menaceHaute }: CourtTensionBarProps) {
  const total = scoreVeilleur + menaceHaute
  const veilleurPct = total > 0 ? Math.round((scoreVeilleur / total) * 100) : 100
  // Trait à la position des 50 acquis dans le total — visible seulement
  // si le score veilleur dépasse 50 (sinon il est exactement au bord droit
  // de la zone veilleur, donc indifférenciable de la frontière).
  const showFaveurMark = scoreVeilleur > FAVEUR_BASE
  const faveurMarkPct = total > 0 ? (FAVEUR_BASE / total) * 100 : 0

  return (
    <div className="court-tension">
      <div
        className="court-tension-bar"
        role="img"
        aria-label={`Faveur veilleur ${scoreVeilleur}, menace ${menaceHaute}`}
      >
        <div className="court-tension-fill veilleur" style={{ width: `${veilleurPct}%` }} />
        <div className="court-tension-fill challenger" style={{ width: `${100 - veilleurPct}%` }} />
        {showFaveurMark && (
          <span
            className="court-tension-mark"
            style={{ left: `${faveurMarkPct}%` }}
            title="Faveur acquise au plantage : 50"
            aria-hidden
          />
        )}
      </div>
      <div className="court-tension-scores">
        <span className="court-score-veilleur">Faveur {scoreVeilleur}</span>
        {menaceHaute > 0 && <span className="court-score-menace">Menace {menaceHaute}</span>}
      </div>
    </div>
  )
}
