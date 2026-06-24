import { useMobileNavStore } from '../../../stores/mobileNavStore'
import { useToastStore } from '../../../stores/toastStore'
import { useChatStore } from '../../../stores/chatStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'

export function MobileNavbar() {
  const activePanel = useMobileNavStore(s => s.activePanel)
  const togglePanel = useMobileNavStore(s => s.togglePanel)
  const closePanel = useMobileNavStore(s => s.closePanel)
  const seenAt = useMobileNavStore(s => s.notificationsSeenAt)
  const chatSeenAt = useMobileNavStore(s => s.chatSeenAt)
  const userId = usePlayerStore(s => s.userId)
  const unseenCount = useToastStore(s => s.toasts.filter(t => t.timestamp > seenAt && t.actorId !== userId).length)
  const unseenChat = useChatStore(s => {
    const companyMsgs = Object.values(s.companyMessages).flat()
    const all = [...s.generalMessages, ...companyMsgs]
    return all.filter(m => new Date(m.createdAt).getTime() > chatSeenAt && m.userId !== userId).length
  })
  const avatarUrl = usePlayerStore(s => s.userAvatarUrl)
  const userName = usePlayerStore(s => s.userName)

  const initial = userName ? userName.charAt(0).toUpperCase() : '?'

  function handleProfileTap() {
    closePanel()
    if (userId) {
      useMapStore.getState().setSelectedPlayerId(userId)
    }
  }

  function handlePanelTap(panel: 'notifications' | 'chat' | 'quests') {
    useMapStore.getState().setSelectedPlayerId(null)
    togglePanel(panel)
  }

  function handleMapTap() {
    closePanel()
    useMapStore.getState().setSelectedPlayerId(null)
    useMapStore.getState().setSelectedPlaceId(null)
  }

  const nothingOpen = activePanel === null

  return (
    <nav className="mobile-navbar">
      <button
        className={`mobile-nav-item${nothingOpen ? ' active' : ''}`}
        onClick={handleMapTap}
        aria-label="Carte"
      >
        <span className="mobile-nav-icon">&#128506;</span>
        <span className="mobile-nav-label">Carte</span>
      </button>

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

      <button
        className={`mobile-nav-item${activePanel === 'quests' ? ' active' : ''}`}
        onClick={() => handlePanelTap('quests')}
        aria-label="Tableau de Quetes"
      >
        <span className="mobile-nav-icon">&#128203;</span>
        <span className="mobile-nav-label">Quetes</span>
      </button>

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
