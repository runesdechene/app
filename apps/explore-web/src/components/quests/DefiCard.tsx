import type { Defi } from '../../types/defi'
import { DefiTagBadge } from './DefiTagBadge'
import { formatDeadlineCountdown } from '../../lib/deadlineCountdown'

interface Props {
  defi: Defi
  label: string
  onClick: () => void
}

/**
 * Carte d'un défi — design unifié pour les trois cadences (jour / semaine /
 * collectif). Cliquable → ouvre la modale détail.
 *
 * Même rangée pour tous : pastille de cadence près de l'icône (porte le label,
 * donc plus de titre de section au-dessus), titre, pastille d'avancement, puis
 * une barre de progression fine. Le collectif n'a plus de cadre dédié : juste
 * la même barre (le détail "ta contribution" reste dans la modale).
 */
export function DefiCard({ defi, label, onClick }: Props) {
  const progress = Math.min(defi.progress, defi.target)
  const pct = defi.target > 0 ? Math.min(100, Math.round((progress / defi.target) * 100)) : 0
  // Collectif accompli : objectif atteint. Le joueur a-t-il participé à temps (≤ completedAt) ?
  const collectiveDone = defi.scope === 'collective' && !!defi.completedAt
  const tooLate =
    collectiveDone && (!defi.myFirstContribAt || defi.myFirstContribAt > defi.completedAt!)
  const progressLabel = defi.claimed ? '✓' : tooLate ? '🔒' : `${progress}/${defi.target}`
  // Date limite : compte à rebours uniquement sur les défis hebdo non réclamés et non accomplis.
  const countdown =
    defi.cadence === 'weekly' && !defi.claimed && !collectiveDone
      ? formatDeadlineCountdown(defi.endsAt)
      : null

  const keyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  return (
    <div
      className={`defi-card${defi.claimed ? ' defi-card-completed' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={keyActivate}
    >
      <span className="defi-card-icon"><DefiTagBadge defi={defi} size={28} /></span>
      <div className="defi-card-body">
        <div className="defi-card-head">
          <span className="defi-card-pill">{label}</span>
          <span className="defi-card-title">{defi.title}</span>
          <span
            className="defi-card-progress"
            aria-label={`Avancement ${progress} sur ${defi.target}`}
          >
            {progressLabel}
          </span>
        </div>
        <div className="cqc-bar">
          <div className="cqc-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {countdown && <span className="defi-card-deadline">⏳ {countdown}</span>}
      </div>
    </div>
  )
}
