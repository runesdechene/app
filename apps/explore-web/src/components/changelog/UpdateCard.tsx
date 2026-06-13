import { useState } from 'react'
import { useChangelogStore } from '../../stores/changelogStore'
import { currentChangelog, isChangelogUnseen } from '../../lib/changelog'
import './UpdateCard.css'

/**
 * Carte « Mise à jour » du feed d'accueil mobile. Remplace l'ancien pop-up
 * auto-ouvert au lancement : un tap ouvre la modale changelog. Pastille
 * « Nouveau » tant que la version courante n'a pas été vue.
 */
export function UpdateCard() {
  const open = useChangelogStore(s => s.open)
  const [unseen] = useState(isChangelogUnseen())
  if (!currentChangelog) return null

  return (
    <button type="button" className="update-card" onClick={() => open()}>
      <span className="update-card-icon" aria-hidden>✨</span>
      <span className="update-card-text">
        <span className="update-card-title">
          Mise à jour
          {unseen && <span className="update-card-new">Nouveau</span>}
        </span>
        <span className="update-card-sub">{currentChangelog.title || currentChangelog.version}</span>
      </span>
      <span className="update-card-chevron" aria-hidden>›</span>
    </button>
  )
}
