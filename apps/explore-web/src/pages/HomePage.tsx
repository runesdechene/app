import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { StatsBar } from '../components/home/StatsBar'
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { HomeQuestsBoard } from '../components/home/HomeQuestsBoard'
import { FragmentsCarousel } from '../components/home/FragmentsCarousel'
import { PlacesSection } from '../components/home/PlacesSection'
import { ProfileMenu } from '../components/auth/ProfileMenu'
import { FactionModal } from '../components/auth/FactionModal'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { ExpeditionModal } from '../components/expeditions/ExpeditionModal'
import logoImg from '../assets/logo_couleur_mobile.webp'
import './HomePage.css'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const [showFactionModal, setShowFactionModal] = useState(false)
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)

  // Initialiser fog state + énergie + couronnes (mêmes hooks que MapPage)
  usePlayer()
  useResourceTimers()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!user) return null

  return (
    <div className="home-page">
      <header className="home-topbar">
        <img src={logoImg} alt="Runes de Chêne" className="home-topbar-logo" />
        <div className="home-topbar-right">
          <NotificationBell />
          {user.email && (
            <ProfileMenu
              email={user.email}
              onSignOut={signOut}
              onFactionModal={() => setShowFactionModal(true)}
            />
          )}
        </div>
      </header>

      <StatsBar />

      <DailyEnigmaCard
        onOpen={() => setShowDailyEnigma(true)}
        refreshKey={enigmaRefreshKey}
      />

      <HomeQuestsBoard onOpenExpedition={setSelectedExpeditionId} />

      <FragmentsCarousel />

      <PlacesSection />

      <p className="home-page-skeleton">Sections à venir…</p>

      {showDailyEnigma && (
        <DailyEnigma
          onClose={() => {
            setShowDailyEnigma(false)
            setEnigmaRefreshKey((k) => k + 1)
          }}
        />
      )}
      {selectedExpeditionId && (
        <ExpeditionModal
          expeditionId={selectedExpeditionId}
          onClose={() => setSelectedExpeditionId(null)}
        />
      )}
      {showFactionModal && <FactionModal onClose={() => setShowFactionModal(false)} />}
      <BottomTabbar />
    </div>
  )
}
