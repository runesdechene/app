import './IOSInstallGuideModal.css'

interface Props {
  open: boolean
  onLater: () => void
  onUnderstood: () => void
}

export function IOSInstallGuideModal({ open, onLater, onUnderstood }: Props) {
  if (!open) return null
  return (
    <div className="ios-install-backdrop" onClick={onLater}>
      <div className="ios-install-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="ios-install-title">Sur iPhone : ajoute Runes de Chêne à ton écran d'accueil</h2>
        <p className="ios-install-intro">
          Pour recevoir tes notifications, l'app doit être lancée depuis l'écran d'accueil.
        </p>
        <ol className="ios-install-steps">
          <li>
            <span className="ios-step-num">1</span>
            <span>Touche le bouton <strong>Partager</strong> en bas de Safari (carré + flèche vers le haut).</span>
          </li>
          <li>
            <span className="ios-step-num">2</span>
            <span>Choisis <strong>Sur l'écran d'accueil</strong>.</span>
          </li>
          <li>
            <span className="ios-step-num">3</span>
            <span>Confirme avec <strong>Ajouter</strong> en haut à droite.</span>
          </li>
          <li>
            <span className="ios-step-num">4</span>
            <span>Lance Runes de Chêne depuis ton écran d'accueil.</span>
          </li>
        </ol>
        <div className="ios-install-actions">
          <button className="ios-install-btn ios-install-btn--secondary" onClick={onLater}>
            Plus tard
          </button>
          <button className="ios-install-btn ios-install-btn--primary" onClick={onUnderstood}>
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}
