import type { Defi } from '../../types/defi'
import { DefiTagBadge } from './DefiTagBadge'

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
  const progressLabel = defi.claimed ? '✓' : `${progress}/${defi.target}`

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
      </div>
    </div>
  )
}
