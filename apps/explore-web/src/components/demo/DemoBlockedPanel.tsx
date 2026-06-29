import './DemoBlockedPanel.css'

export function DemoBlockedPanel({ feature }: { feature: string }) {
  return (
    <div className="demo-blocked">
      <div className="demo-blocked-card">
        <h2 className="demo-blocked-title">Fonction réservée</h2>
        <p className="demo-blocked-text">
          {feature} ne sont pas accessibles en mode démo.
        </p>
        <p className="demo-blocked-hint">
          Crée ton compte pour rejoindre une Compagnie et jouer pour de vrai.
        </p>
      </div>
    </div>
  )
}
