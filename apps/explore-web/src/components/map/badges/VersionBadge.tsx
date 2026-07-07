import { useChangelogStore } from '../../../stores/changelogStore'
import { ChangelogList } from '../../changelog/ChangelogList'
import { currentChangelog, shortVersion, markChangelogSeen } from '../../../lib/changelog'
import { isDemoMode } from '../../../lib/demo/isDemoMode'
import './VersionBadge.css'

interface VersionBadgeProps {
  /** 'overlay' (default) : posé en absolute par-dessus le logo dans la top
   *  bar mobile. 'floating' : fixed en bas à droite, pour les contextes sans
   *  logo (desktop carte). */
  variant?: 'overlay' | 'floating'
}

/**
 * Mini badge cliquable. Au clic, ouvre le ChangelogModal via le store. Sur
 * mobile, posé par-dessus le logo (variant overlay). Sur desktop, en floating
 * bas-droite (variant floating).
 */
export function VersionBadge({ variant = 'overlay' }: VersionBadgeProps = {}) {
  const open = useChangelogStore(s => s.open)
  if (isDemoMode()) return null // borne démo : pas de badge nouveautés
  if (!currentChangelog) return null
  return (
    <button
      type="button"
      className={`version-badge version-badge-${variant}`}
      onClick={(e) => { e.stopPropagation(); open() }}
      aria-label={`Voir le changelog (${currentChangelog.version})`}
    >
      {shortVersion(currentChangelog.version)}
    </button>
  )
}

/**
 * Modale changelog. Montée une seule fois dans RequireAuth, écoute le store.
 *
 * V0.9.68 — PLUS d'auto-ouverture au lancement (le pop-up à l'accueil embêtait
 * les gens). Le changelog se consulte désormais via l'onglet « Mise à jour » de
 * la leftbar (desktop) ou la carte d'accueil (mobile). Cette modale reste
 * ouvrable manuellement au clic sur le badge de version.
 */
export function ChangelogModal() {
  const isOpen = useChangelogStore(s => s.isOpen)
  const close = useChangelogStore(s => s.close)

  function handleClose() {
    markChangelogSeen()
    close()
  }

  if (!currentChangelog || !isOpen) return null

  return (
    <div className="version-modal-overlay" onClick={handleClose}>
      <div className="version-modal" onClick={e => e.stopPropagation()}>
        <div className="version-modal-header">
          <h2>{currentChangelog.version}</h2>
          <button className="version-modal-close" onClick={handleClose}>
            &#10005;
          </button>
        </div>
        <ChangelogList />
      </div>
    </div>
  )
}
