import { useAuth } from '../../hooks/useAuth'
import { ProfileMenu } from '../auth/ProfileMenu'
import { NotificationBell } from '../notifications/NotificationBell'
import logoImg from '../../assets/logo_couleur_mobile.webp'
import './MobileTopBar.css'

const SHOPIFY_URL = 'https://runesdechene.com'

interface MobileTopBarProps {
  /** Quand true, applique un dégradé en bas (sur /carte mobile pour fondre vers la carte). */
  fadeOutBottom?: boolean
  /** Callback ouverture modale faction (transmis à ProfileMenu). */
  onFactionModal?: () => void
}

export function MobileTopBar({ fadeOutBottom = false, onFactionModal }: MobileTopBarProps) {
  const { user, signOut } = useAuth()

  return (
    <header className={`mobile-topbar${fadeOutBottom ? ' mobile-topbar--fade' : ''}`}>
      <img src={logoImg} alt="Runes de Chêne" className="mobile-topbar-logo" />
      <div className="mobile-topbar-spacer" />
      <a
        href={SHOPIFY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-topbar-shop"
        aria-label="Visiter la boutique"
      >
        🏪
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
