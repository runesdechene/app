import { useEffect, useState } from 'react'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { DailyEnigmaCard } from './DailyEnigmaCard'
import { HomeBannerCard } from './HomeBannerCard'
import { DefisBoard } from '../quests/DefisBoard'
import { MissionEntryCard } from '../quests/MissionEntryCard'
import { MissionModalHost } from '../missions/MissionModalHost'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import { PlacesSection } from './PlacesSection'
import { MapActivityList } from './MapActivityList'
import { CoupeHeritagesSection } from './coupe/CoupeHeritagesSection'
import { HomeNouvellesSection } from './HomeNouvellesSection'
import { DailyEnigma } from '../enigma/DailyEnigma'
import { FragmentEnigma } from '../enigma/FragmentEnigma'
import { ExpeditionCreator } from '../expeditions/ExpeditionCreator'
import { ExpeditionModal } from '../expeditions/ExpeditionModal'
import { UpdateBanner } from '../pwa/UpdateBanner'
import '../../pages/HomePage.css'

export interface HomeFeedProps {
  /** Ouvre la FactionModal (sélection/changement de Maison). Fournie par le parent
   *  (MobileLayout via Outlet sur mobile, MapPage sur desktop). */
  openFactionModal: () => void
  /** Affiche la section "Activité de la carte" en bas du feed. Défaut : true.
   *  Desktop : false — l'activité a son propre onglet dans la leftbar. */
  showActivity?: boolean
  /** Handler du bouton "voir plus" d'activité (mobile : navigate('/activite')). */
  onSeeMoreActivity?: () => void
  /** Affiche la section "Coupe des Héritages". Défaut : true.
   *  Desktop : false — masquée dans la leftbar. */
  showCoupe?: boolean
}

/**
 * Feed de la home — les "3 raisons de revenir" (rituel/lien/aventure).
 * Source unique partagée entre la page mobile /accueil (HomePage) et la
 * leftbar desktop (DesktopSidebar). Rend les sections + les modales propres
 * au feed (énigme, fragment, expédition, mission). Les hooks d'init globaux
 * (usePlayer/useChat/etc.) sont montés par le parent (MobileLayout / MapPage).
 */
export function HomeFeed({ openFactionModal, showActivity = true, onSeeMoreActivity, showCoupe = true }: HomeFeedProps) {
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [fragmentEnigma, setFragmentEnigma] = useState<{
    fragmentId: number
    name: string
    icon: string | null
    iconUrl: string | null
  } | null>(null)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)
  const [selectedExpeditionTab, setSelectedExpeditionTab] = useState<'info' | 'chat'>('info')
  const [creatorOpen, setCreatorOpen] = useState(false)

  // Sync store → local state pour expéditions
  const pendingOpenExp = useExpeditionsStore((s) => s.pendingOpenExpeditionId)
  const requestOpenExp = useExpeditionsStore((s) => s.requestOpenExpedition)
  useEffect(() => {
    if (pendingOpenExp) {
      setSelectedExpeditionId(pendingOpenExp)
      setSelectedExpeditionTab(useExpeditionsStore.getState().pendingOpenExpeditionTab)
      requestOpenExp(null)
    }
  }, [pendingOpenExp, requestOpenExp])

  const pendingCreator = useExpeditionsStore((s) => s.pendingOpenCreator)
  const requestCreator = useExpeditionsStore((s) => s.requestOpenCreator)
  useEffect(() => {
    if (pendingCreator) {
      setCreatorOpen(true)
      requestCreator(false)
    }
  }, [pendingCreator, requestCreator])

  // V0.7.11 (10/05) — au mount, parse ?expedition=<id> pour ouvrir la modale
  // d'expé directement (utilisé par les push notifications type
  // expedition_message qui pointent sur /accueil?expedition=<id>). On nettoie
  // l'URL après pour qu'un refresh ne ré-ouvre pas la modale.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const expeditionId = params.get('expedition')
    if (expeditionId) {
      requestOpenExp(expeditionId)
      params.delete('expedition')
      const newSearch = params.toString()
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }
  }, [requestOpenExp])

  return (
    <>
      <main className="home-page-scroll">
        <UpdateBanner />
        <HomeBannerCard />

        <section className="home-section">
          <DailyEnigmaCard
            onOpen={() => setShowDailyEnigma(true)}
            onOpenFragment={(f) => setFragmentEnigma(f)}
            refreshKey={enigmaRefreshKey}
          />
        </section>

        <HomeNouvellesSection />

        <section className="home-section">
          <div className="home-card">
            <header className="home-card-header">
              <h2 className="home-card-title">Événements & Quêtes</h2>
              <button
                type="button"
                className="home-card-cta-mini"
                onClick={() => setCreatorOpen(true)}
              >
                + Créer
              </button>
            </header>
            <DefisBoard />
            <section className="qbp-section"><h4 className="qbp-section-title">Mission</h4><MissionEntryCard /></section>
            <ExpeditionsList onOpenExpedition={setSelectedExpeditionId} />
          </div>
        </section>

        <section className="home-section home-section--no-padding">
          <PlacesSection />
        </section>

        {showCoupe && (
          <section className="home-section">
            <CoupeHeritagesSection openFactionModal={openFactionModal} />
          </section>
        )}

        {showActivity && (
          <section className="home-section">
            <h2 className="home-section-title">Activité de la carte</h2>
            <MapActivityList limit={5} onSeeMore={onSeeMoreActivity} />
          </section>
        )}
      </main>

      {showDailyEnigma && (
        <DailyEnigma
          onClose={() => {
            setShowDailyEnigma(false)
            setEnigmaRefreshKey((k) => k + 1)
          }}
        />
      )}
      {fragmentEnigma && (
        <FragmentEnigma
          fragment={fragmentEnigma}
          onClose={() => {
            setFragmentEnigma(null)
            setEnigmaRefreshKey((k) => k + 1)
          }}
        />
      )}
      {creatorOpen && (
        <ExpeditionCreator
          onClose={() => setCreatorOpen(false)}
          onCreated={(id) => {
            setCreatorOpen(false)
            setSelectedExpeditionId(id)
          }}
        />
      )}
      {selectedExpeditionId && (
        <ExpeditionModal
          key={selectedExpeditionId}
          expeditionId={selectedExpeditionId}
          initialMobileTab={selectedExpeditionTab}
          onClose={() => setSelectedExpeditionId(null)}
        />
      )}
      <MissionModalHost />
    </>
  )
}
