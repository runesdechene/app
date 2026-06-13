import { changelogVersions, currentChangelog, renderMarkdown, type VersionBlock } from '../../lib/changelog'
import '../map/badges/VersionBadge.css'

function renderLines(v: VersionBlock) {
  return v.lines.map((entry, i) => {
    if (entry.type === 'heading') return <h4 key={i} className="version-modal-section">{entry.text}</h4>
    if (entry.type === 'paragraph') return <p key={i} className="version-modal-paragraph">{renderMarkdown(entry.text)}</p>
    return <p key={i} className="version-modal-bullet">— {renderMarkdown(entry.text)}</p>
  })
}

/**
 * Corps du changelog (titre + contenu de la version courante + historique
 * repliable). Surface partagée : modale (VersionBadge), onglet « Mise à jour »
 * de la leftbar desktop, carte d'accueil mobile.
 */
export function ChangelogList({ historyCount = 4 }: { historyCount?: number }) {
  if (!currentChangelog) return null
  const history = changelogVersions.slice(1, 1 + historyCount)

  return (
    <div className="changelog-list">
      {currentChangelog.title && <h3 className="version-modal-title">{currentChangelog.title}</h3>}
      <div className="version-modal-content">{renderLines(currentChangelog)}</div>

      {history.length > 0 && (
        <div className="version-modal-history">
          {history.map((v, i) => (
            <details key={i}>
              <summary>{v.version}{v.title ? ` — ${v.title}` : ''}</summary>
              <div className="version-modal-content">{renderLines(v)}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
