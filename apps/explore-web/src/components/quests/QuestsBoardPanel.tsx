import { useEffect, useState } from 'react'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import './QuestsBoardPanel.css'

/**
 * Panneau Tableau de Quêtes — toujours monté.
 *
 * Desktop : position fixe sous les notifications toast (top calé sous .game-toast-container).
 * Mobile : caché par défaut, devient plein écran quand le mobileNav active le panel 'quests'
 *          (pattern aligné avec les panneaux notifications/chat — cf. mobile.css).
 *
 * V1 : seules les Expéditions sont rendues. Missions et Quêtes du jour
 * apparaissent en ghost rows "Bientôt".
 */

interface Props {
  onOpenExpedition: (expeditionId: string) => void
  onOpenCreator: () => void
  onOpenArchives: () => void
}

export function QuestsBoardPanel({ onOpenExpedition, onOpenCreator, onOpenArchives }: Props) {
  const activePanel = useMobileNavStore((s) => s.activePanel)
  const closePanel = useMobileNavStore((s) => s.closePanel)
  const [collapsed, setCollapsed] = useState(false)

  // Sur mobile, les autres panels (notifications/chat/profile) prennent l'écran
  // → on cache le panel quêtes pour éviter le double rendu.
  const isHiddenOnMobile = activePanel !== null && activePanel !== 'quests'
  const isMobileFullscreen = activePanel === 'quests'

  // Écouter Échap pour fermer le mobile fullscreen
  useEffect(() => {
    if (!isMobileFullscreen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobileFullscreen, closePanel])

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <aside
      className={[
        'qbp',
        collapsed && 'qbp-collapsed',
        isHiddenOnMobile && 'qbp-mobile-hidden',
        isMobileFullscreen && 'qbp-mobile-fullscreen',
      ].filter(Boolean).join(' ')}
      role="complementary"
      aria-label="Tableau de Quêtes"
    >
      <header className="qbp-header">
        <div className="qbp-titlewrap">
          <div className="qbp-eyebrow">Tableau · {today}</div>
          <h2 className="qbp-title">À l'horizon</h2>
        </div>
        <div className="qbp-actions">
          <button className="qbp-cta-mini" onClick={onOpenCreator}>+ Créer</button>
          {isMobileFullscreen ? (
            <button className="qbp-close" onClick={closePanel} aria-label="Fermer">×</button>
          ) : (
            <button
              className="qbp-collapse"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Déplier' : 'Replier'}
              title={collapsed ? 'Déplier' : 'Replier'}
            >{collapsed ? '▾' : '▴'}</button>
          )}
        </div>
      </header>

      {!collapsed && (
        <>
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
        </>
      )}
    </aside>
  )
}
