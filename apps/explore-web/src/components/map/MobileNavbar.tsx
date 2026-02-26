import { useMobileNavStore } from '../../stores/mobileNavStore'
import { useToastStore } from '../../stores/toastStore'
import { useChatStore } from '../../stores/chatStore'
import { useFogStore } from '../../stores/fogStore'
import { useMapStore } from '../../stores/mapStore'

export function MobileNavbar() {
  const activePanel = useMobileNavStore(s => s.activePanel)
  const togglePanel = useMobileNavStore(s => s.togglePanel)
  const closePanel = useMobileNavStore(s => s.closePanel)
  const seenAt = useMobileNavStore(s => s.notificationsSeenAt)
  const chatSeenAt = useMobileNavStore(s => s.chatSeenAt)
  const userId = useFogStore(s => s.userId)
  const unseenCount = useToastStore(s => s.toasts.filter(t => t.timestamp > seenAt && t.actorId !== userId).length)
  const unseenChat = useChatStore(s => {
    const all = [...s.generalMessages, ...s.factionMessages]
    return all.filter(m => new Date(m.createdAt).getTime() > chatSeenAt && m.userId !== userId).length
  })
  const avatarUrl = useFogStore(s => s.userAvatarUrl)
  const userName = useFogStore(s => s.userName)

  const initial = userName ? userName.charAt(0).toUpperCase() : '?'

  function handleProfileTap() {
    // Fermer tout panneau ouvert
    closePanel()
    // Ouvrir le profil joueur en grand
    if (userId) {
      useMapStore.getState().setSelectedPlayerId(userId)
    }
  }

  function handlePanelTap(panel: 'notifications' | 'chat') {
    // Fermer le profil si ouvert
    useMapStore.getState().setSelectedPlayerId(null)
    togglePanel(panel)
  }

  function handleMapTap() {
    // Tout fermer : panneau, profil, place panel
    closePanel()
    useMapStore.getState().setSelectedPlayerId(null)
    useMapStore.getState().setSelectedPlaceId(null)
  }

  const nothingOpen = activePanel === null

  return (
    <nav className="mobile-navbar">
      {/* Carte */}
      <button
        className={`mobile-nav-item${nothingOpen ? ' active' : ''}`}
        onClick={handleMapTap}
        aria-label="Carte"
      >
        <span className="mobile-nav-icon">&#128506;</span>
        <span className="mobile-nav-label">Carte</span>
      </button>

      {/* Notifications */}
      <button
        className={`mobile-nav-item${activePanel === 'notifications' ? ' active' : ''}`}
        onClick={() => handlePanelTap('notifications')}
        aria-label="Notifications"
      >
        <span className="mobile-nav-icon">&#128276;</span>
        {unseenCount > 0 && (
          <span className="mobile-nav-badge">{unseenCount > 9 ? '9+' : unseenCount}</span>
        )}
        <span className="mobile-nav-label">Activite</span>
      </button>

      {/* Chat */}
      <button
        className={`mobile-nav-item${activePanel === 'chat' ? ' active' : ''}`}
        onClick={() => handlePanelTap('chat')}
        aria-label="Messagerie"
      >
        <span className="mobile-nav-icon">&#128172;</span>
        {unseenChat > 0 && (
          <span className="mobile-nav-badge">{unseenChat > 9 ? '9+' : unseenChat}</span>
        )}
        <span className="mobile-nav-label">Messages</span>
      </button>

      {/* Profil — ouvre le PlayerProfileModal directement */}
      <button
        className="mobile-nav-item"
        onClick={handleProfileTap}
        aria-label="Profil"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="mobile-nav-avatar" />
        ) : (
          <span className="mobile-nav-icon mobile-nav-initial">{initial}</span>
        )}
        <span className="mobile-nav-label">Profil</span>
      </button>
    </nav>
  )
}
