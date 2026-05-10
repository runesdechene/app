import { useAuth } from '../../hooks/useAuth'
import { ProfileMenu } from '../auth/ProfileMenu'
import { NotificationBell } from '../notifications/NotificationBell'
import { VersionBadge } from '../map/badges/VersionBadge'
import { useChangelogStore } from '../../stores/changelogStore'
import logoImg from '../../assets/logo_couleur_mobile.webp'
import shopIcon from '../../assets/shop_icon.webp'
import './MobileTopBar.css'

const SHOPIFY_URL = 'https://runesdechene.com'

interface MobileTopBarProps {
  /** Callback ouverture modale faction (transmis à ProfileMenu). */
  onFactionModal?: () => void
}

export function MobileTopBar({ onFactionModal }: MobileTopBarProps) {
  const { user, signOut } = useAuth()

  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="mobile-topbar-logo-btn"
        onClick={() => useChangelogStore.getState().open()}
        aria-label="Voir le changelog"
      >
        <img src={logoImg} alt="Runes de Chêne" className="mobile-topbar-logo" />
        <VersionBadge />
      </button>
      <div className="mobile-topbar-spacer" />
      <a
        href={SHOPIFY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-topbar-shop"
        aria-label="Visiter la boutique"
      >
        <img src={shopIcon} alt="" />
      </a>
      <NotificationBell />
      {user?.email && (
        <ProfileMenu
          email={user.email}
          onSignOut={signOut}
          onFactionModal={onFactionModal ?? (() => {})}
        />
      )}
    </header>
  )
}
