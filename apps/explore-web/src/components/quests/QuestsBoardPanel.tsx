import { useEffect, useState } from 'react'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import { DefisBoard } from './DefisBoard'
import { MissionEntryCard } from './MissionEntryCard'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import './QuestsBoardPanel.css'
import './DailyQuests.css'

/**
 * Panneau Tableau de Quêtes — toujours monté.
 *
 * Desktop : empilé dans .hud-left-stack avec les toasts (cf. App.css).
 * Mobile : caché par défaut, plein écran via mobileNav (data-mobile-panel='quests').
 *
 * V1 : seules les Expéditions sont rendues. Pas de ghost rows pour les types
 * non-livrés (on les ajoutera au moment de leur livraison réelle).
 * Pas de lien archives tant qu'il n'y a pas d'archives à afficher.
 */

interface Props {
  onOpenExpedition: (expeditionId: string) => void
  onOpenCreator: () => void
}

export function QuestsBoardPanel({ onOpenExpedition, onOpenCreator }: Props) {
  const activePanel = useMobileNavStore((s) => s.activePanel)
  const closePanel = useMobileNavStore((s) => s.closePanel)
  const [collapsed, setCollapsed] = useState(false)

  const isHiddenOnMobile = activePanel !== null && activePanel !== 'quests'
  const isMobileFullscreen = activePanel === 'quests'

  useEffect(() => {
    if (!isMobileFullscreen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobileFullscreen, closePanel])

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
          <h2 className="qbp-title">Quêtes & Expéditions</h2>
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

      {/* On ne démonte PAS la liste au repli — sinon flash de re-fetch au déploiement.
          On la cache en CSS via la classe parent .qbp-collapsed. */}
      <div className="qbp-content">
        <DefisBoard />
        <section className="qbp-section"><h4 className="qbp-section-title">Mission</h4><MissionEntryCard /></section>
        <ExpeditionsList onOpenExpedition={onOpenExpedition} />
      </div>

      {/* FAB "+" — visible uniquement en mode mobile-fullscreen (cf. mobile.css).
          Pattern d'app natif : action principale en bas à droite, accessible au pouce. */}
      <button
        type="button"
        className="qbp-fab-add"
        onClick={onOpenCreator}
        aria-label="Créer un événement"
        title="Créer un événement"
      >+</button>
    </aside>
  )
}
