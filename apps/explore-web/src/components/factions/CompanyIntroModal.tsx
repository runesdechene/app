import { createPortal } from 'react-dom'
import './CompanyIntroModal.css'

interface Props {
  onChoose: () => void
  onCreate: () => void
  onClose: () => void
}

/**
 * Pop-up d'accueil « Les Compagnies arrivent » — prend le joueur par la main :
 * Choisir une Compagnie (→ explorer) ou Créer la sienne (→ formulaire, 200🪙).
 */
export function CompanyIntroModal({ onChoose, onCreate, onClose }: Props) {
  return createPortal(
    <div className="company-intro-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="company-intro">
        <button className="company-intro-close" onClick={onClose} aria-label="Fermer">×</button>

        <div className="company-intro-eyebrow">✨ Grande nouveauté</div>
        <div className="company-intro-emblem">🛡️</div>
        <h2 className="company-intro-title">Les Compagnies arrivent</h2>
        <p className="company-intro-text">
          Rassemble-toi sous une bannière. <b>Rejoins une Compagnie</b> et fais-la grimper au
          classement par tes actions — ou <b>fonde la tienne</b> et mène les tiens.
        </p>

        <div className="company-intro-actions">
          <button className="company-intro-btn company-intro-btn-primary" onClick={onChoose}>
            Choisir une Compagnie
          </button>
          <button className="company-intro-btn company-intro-btn-secondary" onClick={onCreate}>
            Créer une Compagnie — 200 🪙
          </button>
        </div>

        <button className="company-intro-later" onClick={onClose}>Plus tard</button>
      </div>
    </div>,
    document.body,
  )
}
