import type { Defi } from '../../types/defi'
import { DefiTagBadge } from './DefiTagBadge'

interface Props {
  defi: Defi
  label: string
  onClick: () => void
}

/**
 * Carte d'un défi (individuel ou collectif). Cliquable → ouvre la modale détail.
 * Réutilise les classes CSS daily-quest-card et cqc-* existantes.
 *
 * Individuel  : progress / target + ✓ si claimed.
 * Collectif   : barre communauté + ligne "ta contribution" + ✓ si claimed.
 */
export function DefiCard({ defi, label, onClick }: Props) {
  const isCollective = defi.scope === 'collective'
  const progress = Math.min(defi.progress, defi.target)
  const pct = defi.target > 0 ? Math.min(100, Math.round((progress / defi.target) * 100)) : 0
  const progressLabel = defi.claimed ? '✓' : `${progress}/${defi.target}`

  const keyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  if (isCollective) {
    return (
      <div
        className={`community-quest-card${defi.claimed ? ' daily-quest-card-completed' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={keyActivate}
        style={{ cursor: 'pointer' }}
      >
        <div className="cqc-head">
          <DefiTagBadge defi={defi} size={20} />{' '}
          {defi.title}
        </div>
        <div className="cqc-bar">
          <div className="cqc-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="cqc-meta">
          {progress}/{defi.target} · ta contribution : {defi.myContribution}
          {defi.claimed && <span style={{ marginLeft: 6, color: '#2e7d32', fontWeight: 700 }}>✓</span>}
        </div>
      </div>
    )
  }

  return (
    <ul className="daily-quests-list" style={{ margin: 0 }}>
      <li
        className={`daily-quest-card${defi.claimed ? ' daily-quest-card-completed' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={keyActivate}
      >
        <span className="daily-quest-card-icon"><DefiTagBadge defi={defi} size={24} /></span>
        <span className="daily-quest-card-pill">{label}</span>
        <span className="daily-quest-card-title">{defi.title}</span>
        <span
          className="daily-quest-card-progress"
          aria-label={`Avancement ${progress} sur ${defi.target}`}
        >
          {progressLabel}
        </span>
      </li>
    </ul>
  )
}
