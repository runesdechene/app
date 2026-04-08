import { useState } from 'react'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.read).length)

  return (
    <div className="notification-bell-wrapper">
      <button
        className="notification-bell"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <span className="notification-bell-icon">{'\uD83D\uDD14'}</span>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  )
}
