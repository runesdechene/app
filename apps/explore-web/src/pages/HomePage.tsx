import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { usePlayerStore } from '../stores/playerStore'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { useExpeditionsStore } from '../stores/expeditionsStore'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
// EnigmaFragmentsList masquée — fragments absorbés par badge DailyEnigmaCard (maquette 09/05/2026)
// import { EnigmaFragmentsList } from '../components/home/EnigmaFragmentsList'
import { DailyQuestsList } from '../components/quests/DailyQuestsList'
import { ExpeditionsList } from '../components/expeditions/ExpeditionsList'
import { PlacesSection } from '../components/home/PlacesSection'
import { MapActivityList } from '../components/home/MapActivityList'
import { FactionModal } from '../components/auth/FactionModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { FragmentEnigma } from '../components/enigma/FragmentEnigma'
import { ExpeditionCreator } from '../components/expeditions/ExpeditionCreator'
import { ExpeditionModal } from '../components/expeditions/ExpeditionModal'
import { PlacePanel } from '../components/places/views/PlacePanel'
import { useMapStore } from '../stores/mapStore'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userFactionId = usePlayerStore((s) => s.userFactionId)
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId)

  const [showFactionModal, setShowFactionModal] = useState(false)
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

  // Sync store → local state pour expéditions (même pattern que home-pivot)
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

  usePlayer()
  useResourceTimers()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!user) return null

  return (
    <div className="home-page">
      <MobileTopBar onFactionModal={() => setShowFactionModal(true)} />
      <MobileStatsBar />

      <main className="home-page-scroll">
        <section className="home-section">
          <DailyEnigmaCard
            onOpen={() => setShowDailyEnigma(true)}
            refreshKey={enigmaRefreshKey}
          />
          {/* EnigmaFragmentsList retirée — compteur fragments intégré au badge DailyEnigmaCard */}
        </section>

        <section className="home-section">
          <div className="home-card">
            <h2 className="home-card-title">Événements & Quêtes</h2>
            <DailyQuestsList />
            <ExpeditionsList onOpenExpedition={setSelectedExpeditionId} />
            <button
              type="button"
              className="home-section-cta"
              onClick={() => setCreatorOpen(true)}
            >
              + Créer une expédition
            </button>
          </div>
        </section>

        <section className="home-section">
          <PlacesSection />
        </section>

        <section className="home-section">
          <h2 className="home-section-title">Activité de la carte</h2>
          <MapActivityList limit={5} onSeeMore={() => navigate('/activite')} />
        </section>
      </main>

      <BottomTabbar />

      {showFactionModal && (
        <FactionModal
          onClose={() => setShowFactionModal(false)}
          currentFactionId={userFactionId}
        />
      )}
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
      {/* Modale lieu — s'ouvre par-dessus la home quand on clique un lieu
          dans MapActivityList ou PlacesSection (state partagé useMapStore). */}
      <PlacePanel
        placeId={selectedPlaceId}
        onClose={() => setSelectedPlaceId(null)}
        userEmail={user?.email ?? null}
      />
      <GameToast />
    </div>
  )
}
