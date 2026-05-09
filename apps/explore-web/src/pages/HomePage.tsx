import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { StatsBar } from '../components/home/StatsBar'
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { ProfileMenu } from '../components/auth/ProfileMenu'
import { FactionModal } from '../components/auth/FactionModal'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import logoImg from '../assets/logo_couleur_mobile.webp'
import './HomePage.css'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const [showFactionModal, setShowFactionModal] = useState(false)
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)

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

      <p className="home-page-skeleton">Sections à venir…</p>

      {showDailyEnigma && (
        <DailyEnigma
          onClose={() => {
            setShowDailyEnigma(false)
            setEnigmaRefreshKey((k) => k + 1)
          }}
        />
      )}
      {showFactionModal && <FactionModal onClose={() => setShowFactionModal(false)} />}
      <BottomTabbar />
    </div>
  )
}
