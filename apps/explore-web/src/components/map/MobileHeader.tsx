import { useState, useRef, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { useCrownsStore } from '../../stores/crownsStore'
import logoImg from '../../assets/logo_couleur_mobile.webp'
import shopIcon from '../../assets/shop_icon.webp'

interface MobileHeaderProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function MobileHeader({ email, onSignOut, onFactionModal }: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Lire directement depuis playerStore au lieu de refaire un appel RPC
  const userId = usePlayerStore(s => s.userId)
  const userName = usePlayerStore(s => s.userName)
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const userFactionTitle = usePlayerStore(s => s.userFactionTitle)

  // V0.7 — Couronnes de Chêne (compteur compact dans la barre top)
  const crownsBalance = useCrownsStore(s => s.balance)

  // Fermer si clic exterieur
  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  function handleViewProfile() {
    setMenuOpen(false)
    if (userId) useMapStore.getState().setSelectedPlayerId(userId)
  }

  const displayName = userName || email

  return (
    <div className="mobile-header" ref={ref}>
      <img
        src={logoImg}
        alt="Runes de Chêne"
        className="mobile-header-logo"
        onClick={() => {
          setMenuOpen(false)
          useMobileNavStore.getState().closePanel()
          useMapStore.getState().setSelectedPlayerId(null)
          useMapStore.getState().setSelectedPlaceId(null)
        }}
      />

      <div className="mobile-header-right">
        {userId && (
          <button
            type="button"
            className="mobile-header-crowns"
            onClick={handleViewProfile}
            title={`${crownsBalance} Couronne${crownsBalance > 1 ? 's' : ''} de Chêne — voir profil`}
            aria-label={`${crownsBalance} Couronnes de Chêne`}
          >
            <span className="mobile-header-crowns-icon" aria-hidden>{'🪙'}</span>
            <span className="mobile-header-crowns-count">{crownsBalance}</span>
          </button>
        )}

        <a href="https://runesdechene.com" target="_blank" rel="noopener noreferrer" className="mobile-header-shop">
          <img src={shopIcon} alt="Boutique" className="mobile-header-shop-icon" />
        </a>

        <button
          className="mobile-header-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>
      </div>

      {menuOpen && (
        <div className="profile-dropdown mobile-header-menu">
          <div className="profile-dropdown-header">
            <span className="profile-dropdown-name">
              {displayName}
            </span>
            {isAdmin && (
              <span className="profile-dropdown-admin">Admin</span>
            )}
          </div>

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-action" onClick={handleViewProfile}>
            Voir mon profil
          </button>

          <button
            className="profile-dropdown-action"
            onClick={() => { setMenuOpen(false); onFactionModal() }}
          >
            {userFactionId ? (
              <span className="faction-current">
                <span
                  className="faction-selector-dot"
                  style={{ backgroundColor: userFactionColor ?? undefined }}
                />
                {userFactionTitle}
              </span>
            ) : (
              'Rejoindre une faction'
            )}
          </button>

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-action" onClick={onSignOut}>
            Se deconnecter
          </button>
        </div>
      )}
    </div>
  )
}
