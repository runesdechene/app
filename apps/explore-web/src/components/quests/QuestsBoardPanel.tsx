import { useEffect, useState } from 'react'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import './QuestsBoardPanel.css'

/**
 * Panneau HUD du Tableau de Quêtes.
 * V1 : seules les Expéditions sont rendues. Missions et Quêtes du jour
 * apparaissent en ghost rows "Bientôt" pour préparer l'arrivée future
 * sans tab vide. Pas de modale full-screen, pas d'onglets — un seul flux
 * unifié sous les notifications toast (cf. spec §12.4 + maquette Scène 1).
 */

interface Props {
  onClose: () => void
  onOpenExpedition: (expeditionId: string) => void
  onOpenCreator: () => void
  onOpenArchives: () => void
}

export function QuestsBoardPanel({ onClose, onOpenExpedition, onOpenCreator, onOpenArchives }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className={`qbp-overlay${mounted ? ' qbp-mounted' : ''}`} onClick={onClose}>
      <div className="qbp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qbp-handle" />

        <header className="qbp-header">
          <div>
            <div className="qbp-eyebrow">Tableau · {today}</div>
            <h2 className="qbp-title">À l'horizon</h2>
          </div>
          <button className="qbp-cta-mini" onClick={onOpenCreator}>+ Créer</button>
        </header>

        <ExpeditionsList onOpenExpedition={onOpenExpedition} />

        <div className="qbp-future">
          <div className="qbp-future-row">
            <span className="qbp-pill qbp-pill-mission qbp-pill-ghost">
              <span className="qbp-pill-icon">🎯</span>Mission
            </span>
            <span>Bientôt — la marque te confiera des missions en échange de Couronnes</span>
          </div>
          <div className="qbp-future-row">
            <span className="qbp-pill qbp-pill-daily qbp-pill-ghost">
              <span className="qbp-pill-icon">☀️</span>Du jour
            </span>
            <span>Bientôt — des quêtes journalières automatiques</span>
          </div>
        </div>

        <button className="qbp-archives-link" onClick={onOpenArchives}>
          Voir les expéditions archivées →
        </button>
      </div>
    </div>
  )
}
