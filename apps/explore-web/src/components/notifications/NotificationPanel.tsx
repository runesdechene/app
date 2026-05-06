import { useNotificationStore, Notification } from '../../stores/notificationStore'
import { useMapStore } from '../../stores/mapStore'
import './NotificationPanel.css'

const TYPE_ICONS: Record<Notification['type'], string> = {
  like_carnet: '\u2764\uFE0F',
  new_carnet: '\uD83D\uDCDC',
  exploration: '\uD83E\uDDED',
  milestone_likes: '\uD83C\uDF1F',
  milestone_vues: '\uD83D\uDC41\uFE0F',
  milestone_exploration: '\u26F0\uFE0F',
  claim_lost: '\u2694\uFE0F',
  // V097 \u2014 La Cour
  place_court_attack: '\u2694\uFE0F',
  place_court_high_threat: '\uD83D\uDD25',
  place_taken_remote: '\u26A1',
  place_taken_remote_self: '\uD83C\uDFF4',
  place_taken_back_gps: '\uD83D\uDEE1\uFE0F',
  place_reaffirmed: '\uD83D\uDEE1\uFE0F',
  mecene_principal_gained: '\uD83E\uDE99',
}

function formatMessage(notif: Notification): string {
  const d = notif.data
  const place = d.placeTitle || 'un de vos lieux'
  switch (notif.type) {
    case 'like_carnet':
      return `${d.actorName || 'Quelqu\'un'} a aimé votre récit sur ${d.placeTitle || 'un lieu'}`
    case 'new_carnet':
      return `${d.actorName || 'Quelqu\'un'} a écrit un récit sur un lieu que vous avez exploré`
    case 'exploration': {
      const count = d.visitorsToday ?? 1
      if (count > 1) {
        return `${count} explorateurs ont visité un lieu que vous avez exploré`
      }
      return `${d.lastVisitorName || 'Quelqu\'un'} a visité un lieu que vous avez exploré`
    }
    case 'milestone_likes':
      return `Votre récit a atteint ${d.likeCount} cœurs`
    case 'milestone_vues':
      return `L'un de vos lieux a atteint ${d.viewCount} vues`
    case 'milestone_exploration':
      return `L'un de vos lieux a atteint ${d.explorerCount} explorateurs`
    case 'claim_lost':
      return `Une autre Maison d'Héritage a pris l'ascendant sur l'un de vos lieux`
    // V097 — La Cour
    case 'place_court_attack':
      return `${d.actorName || 'Quelqu\'un'} s'intéresse à ${place}`
    case 'place_court_high_threat':
      return `${place} est sous forte pression`
    case 'place_taken_remote':
      return `Vous avez perdu ${place} — un mécène a pris l'ascendant`
    case 'place_taken_remote_self':
      if (d.fromVacant) {
        return `Vous avez posé votre marque sur ${place} — confirmez-la sur place`
      }
      return `Vous tenez ${place} à distance — confirmez-le sur place`
    case 'place_taken_back_gps':
      return `L'ancien veilleur a repris ${place} par la marche`
    case 'place_reaffirmed': {
      const cleared = d.threatsCleared ?? 0
      return cleared > 0
        ? `${place} : ${cleared} menace${cleared > 1 ? 's' : ''} effacée${cleared > 1 ? 's' : ''} par le veilleur`
        : `Le veilleur de ${place} est repassé sur place`
    }
    case 'mecene_principal_gained':
      return `Vous êtes désormais Mécène Principal de ${place}`
  }
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  const weeks = Math.floor(days / 7)
  return `${weeks} sem.`
}

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const notifications = useNotificationStore((s) => s.notifications)

  function handleClick(notif: Notification) {
    if (notif.data.placeId) {
      useMapStore.getState().setSelectedPlaceId(notif.data.placeId)
    }
    onClose()
  }

  return (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <span className="notification-panel-title">Notifications</span>
        <button className="notification-panel-close" onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className="notification-panel-list">
        {notifications.length === 0 ? (
          <div className="notification-panel-empty">Aucune notification</div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              className={`notification-item${notif.read ? '' : ' notification-unread'}`}
              onClick={() => handleClick(notif)}
            >
              <span className="notification-icon">{TYPE_ICONS[notif.type]}</span>
              <div className="notification-content">
                <span className="notification-message">{formatMessage(notif)}</span>
                <span className="notification-time">{getTimeAgo(notif.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
