import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNotificationStore, Notification } from '../../stores/notificationStore'
import { usePlayerStore } from '../../stores/playerStore'
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
}

function formatMessage(notif: Notification): string {
  const d = notif.data
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
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const userId = usePlayerStore((s) => s.userId)

  // Mark all as read on open
  useEffect(() => {
    if (!userId) return
    const hasUnread = notifications.some((n) => !n.read)
    if (hasUnread) {
      markAllRead()
      supabase.rpc('mark_notifications_read', { p_user_id: userId })
    }
  }, [userId, notifications, markAllRead])

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
