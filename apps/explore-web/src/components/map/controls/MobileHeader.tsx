import { useState, useRef, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import { useMobileNavStore } from '../../../stores/mobileNavStore'
import { useChangelogStore } from '../../../stores/changelogStore'
import { supabase } from '../../../lib/supabase'
import { EmailChangeModal } from '../../auth/EmailChangeModal'
import { PushSettings } from '../../notifications/PushSettings'
import { VersionBadge } from '../badges/VersionBadge'
import logoImg from '../../../assets/logo_couleur_mobile.webp'
import shopIcon from '../../../assets/shop_icon.webp'

interface MobileHeaderProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function MobileHeader({ email, onSignOut, onFactionModal }: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Lire directement depuis playerStore au lieu de refaire un appel RPC
  const userId = usePlayerStore(s => s.userId)
  const userName = usePlayerStore(s => s.userName)
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const userFactionTitle = usePlayerStore(s => s.userFactionTitle)
  const brouillerPistes = usePlayerStore(s => s.brouillerPistes)
  const [savingBrouiller, setSavingBrouiller] = useState(false)

  async function setBrouiller(value: boolean) {
    if (savingBrouiller || value === brouillerPistes) return
    setSavingBrouiller(true)
    usePlayerStore.getState().setBrouillerPistes(value)
    if (!value) usePlayerStore.getState().setPublicPosition(null)
    const { error } = await supabase.rpc('set_brouiller_pistes', { p_enabled: value })
    if (error) {
      console.warn('[MobileHeader] set_brouiller_pistes failed', error)
      usePlayerStore.getState().setBrouillerPistes(!value)
    }
    setSavingBrouiller(false)
  }

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
      <button
        type="button"
        className="mobile-header-logo-btn"
        onClick={() => {
          setMenuOpen(false)
          useMobileNavStore.getState().closePanel()
          useMapStore.getState().setSelectedPlayerId(null)
          useMapStore.getState().setSelectedPlaceId(null)
          useChangelogStore.getState().open()
        }}
        aria-label="Voir le changelog"
      >
        <img
          src={logoImg}
          alt="Runes de Chêne"
          className="mobile-header-logo"
        />
        <VersionBadge />
      </button>

      <div className="mobile-header-right">
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
              'Choisir ta classe'
            )}
          </button>

          <button
            className="profile-dropdown-action"
            onClick={() => { setMenuOpen(false); setShowEmailChange(true) }}
          >
            Changer mon email
          </button>

          <div className="profile-dropdown-divider" />

          <div className="profile-dropdown-calendar">
            <span className="profile-dropdown-calendar-label">Visibilité de ma position</span>
            <button
              className={`profile-dropdown-action calendar-ref-option ${brouillerPistes ? 'active' : ''}`}
              onClick={() => setBrouiller(true)}
              disabled={savingBrouiller}
            >
              {brouillerPistes && <span className="calendar-ref-check">✓</span>}
              🔒 Pistes brouillées (50 km)
            </button>
            <button
              className={`profile-dropdown-action calendar-ref-option ${!brouillerPistes ? 'active' : ''}`}
              onClick={() => setBrouiller(false)}
              disabled={savingBrouiller}
            >
              {!brouillerPistes && <span className="calendar-ref-check">✓</span>}
              👁️ Position GPS exacte
            </button>
          </div>

          <PushSettings />

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-action" onClick={onSignOut}>
            Se deconnecter
          </button>
        </div>
      )}

      {showEmailChange && (
        <EmailChangeModal
          currentEmail={email}
          onClose={() => setShowEmailChange(false)}
        />
      )}
    </div>
  )
}
