import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useFogStore } from '../../stores/fogStore'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import logoImg from '../../assets/logo_couleur_mobile.webp'
import shopIcon from '../../assets/shop_icon.webp'

interface ProfileData {
  id: string
  lastName: string
  role: string
  faction: { id: string; title: string; color: string } | null
}

interface MobileHeaderProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function MobileHeader({ email, onSignOut, onFactionModal }: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const userId = useFogStore(s => s.userId)

  useEffect(() => {
    async function fetchProfile() {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email_address', email)
        .single()
      if (!user) return
      const { data } = await supabase.rpc('get_my_informations', { p_user_id: user.id })
      if (data && !data.error) setProfile(data as ProfileData)
    }
    fetchProfile()
  }, [email])

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
        <a href="https://www.runesdechene.com" target="_blank" rel="noopener noreferrer" className="mobile-header-shop">
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
              {profile?.lastName || email}
            </span>
            {profile?.role === 'admin' && (
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
            {profile?.faction ? (
              <span className="faction-current">
                <span
                  className="faction-selector-dot"
                  style={{ backgroundColor: profile.faction.color }}
                />
                {profile.faction.title}
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
