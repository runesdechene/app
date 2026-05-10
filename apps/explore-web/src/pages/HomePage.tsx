import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useExpeditionsStore } from '../stores/expeditionsStore'
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { DailyQuestsList } from '../components/quests/DailyQuestsList'
import { ExpeditionsList } from '../components/expeditions/ExpeditionsList'
import { PlacesSection } from '../components/home/PlacesSection'
import { MapActivityList } from '../components/home/MapActivityList'
import { CoupeHeritagesSection } from '../components/home/coupe/CoupeHeritagesSection'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { FragmentEnigma } from '../components/enigma/FragmentEnigma'
import { ExpeditionCreator } from '../components/expeditions/ExpeditionCreator'
import { ExpeditionModal } from '../components/expeditions/ExpeditionModal'
import type { MobileLayoutContext } from './MobileLayout'
import './HomePage.css'

/**
 * Page /accueil — hub des 3 raisons de revenir (rituel/lien/aventure).
 * MobileTopBar / BottomTabbar / hooks d'init / modales lieu&joueur sont
 * dans MobileLayout parent. Cette page rend juste le scroll de sections
 * + les modales spécifiques à la home (énigme, fragment, expédition).
 */
export default function HomePage() {
  const navigate = useNavigate()
  const { openFactionModal } = useOutletContext<MobileLayoutContext>()
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [fragmentEnigma, setFragmentEnigma] = useState<{
    fragmentId: number
    name: string
    icon: string | null
    iconUrl: string | null
  } | null>(null)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  // Sync store → local state pour expéditions
  const pendingOpenExp = useExpeditionsStore((s) => s.pendingOpenExpeditionId)
  const requestOpenExp = useExpeditionsStore((s) => s.requestOpenExpedition)
  useEffect(() => {
    if (pendingOpenExp) {
      setSelectedExpeditionId(pendingOpenExp)
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

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  return (
    <>
      <main className="home-page-scroll">
        <section className="home-section">
          <DailyEnigmaCard
            onOpen={() => setShowDailyEnigma(true)}
            onOpenFragment={(f) => setFragmentEnigma(f)}
            refreshKey={enigmaRefreshKey}
          />
        </section>

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
            <DailyQuestsList />
            <ExpeditionsList onOpenExpedition={setSelectedExpeditionId} />
          </div>
        </section>

        <section className="home-section home-section--no-padding">
          <PlacesSection />
        </section>

        <section className="home-section">
          <CoupeHeritagesSection openFactionModal={openFactionModal} />
        </section>

        <section className="home-section">
          <h2 className="home-section-title">Activité de la carte</h2>
          <MapActivityList limit={5} onSeeMore={() => navigate('/activite')} />
        </section>
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
          expeditionId={selectedExpeditionId}
          onClose={() => setSelectedExpeditionId(null)}
        />
      )}
    </>
  )
}
