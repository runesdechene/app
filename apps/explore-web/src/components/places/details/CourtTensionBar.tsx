import './CourtTensionBar.css'
import type { CourtStatus } from '../../../types/court'

interface CourtTensionBarProps {
  scoreVeilleur: number
  menaceHaute: number
  /** @deprecated V086 — le statut est désormais dans la pilule top-right de PlaceCourtView */
  status?: CourtStatus
}

const FAVEUR_BASE = 50

export function CourtTensionBar({ scoreVeilleur, menaceHaute }: CourtTensionBarProps) {
  const total = scoreVeilleur + menaceHaute
  const veilleurPct = total > 0 ? Math.round((scoreVeilleur / total) * 100) : 100
  // Trait acquis '50' visible quand la défense supplémentaire commence (score > 50)
  const showFaveurMark = scoreVeilleur > FAVEUR_BASE
  const faveurMarkPct = total > 0 ? (FAVEUR_BASE / total) * 100 : 0
  // Largeur minimale pour afficher le chiffre dedans (sinon il déborde)
  const showVeilleurNumber = veilleurPct >= 18
  const showMenaceNumber = menaceHaute > 0 && (100 - veilleurPct) >= 18

  return (
    <div
      className="court-tension-bar"
      role="img"
      aria-label={`Faveur veilleur ${scoreVeilleur}, menace ${menaceHaute}`}
    >
      <div className="court-tension-fill veilleur" style={{ width: `${veilleurPct}%` }}>
        {showVeilleurNumber && <span className="court-tension-num">{scoreVeilleur}</span>}
      </div>
      <div className="court-tension-fill challenger" style={{ width: `${100 - veilleurPct}%` }}>
        {showMenaceNumber && <span className="court-tension-num">{menaceHaute}</span>}
      </div>
      {showFaveurMark && (
        <span
          className="court-tension-mark"
          style={{ left: `${faveurMarkPct}%` }}
          title="Faveur acquise au plantage : 50"
          aria-hidden
        />
      )}
    </div>
  )
}
