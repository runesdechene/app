import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useNotificationStore } from '../../stores/notificationStore'
import { usePlayerStore } from '../../stores/playerStore'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.read).length)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function handleToggle() {
    if (!open && unreadCount > 0) {
      markAllRead()
      const userId = usePlayerStore.getState().userId
      if (userId) supabase.rpc('mark_notifications_read', { p_user_id: userId }).then(() => {})
    }
    setOpen(!open)
  }

  // Close on outside click — utile sur desktop (le panel flotte en haut à
  // droite). Sur mobile le panel est plein écran (modal-mobile-fullscreen)
  // et a son propre bouton de fermeture, donc un clic outside n'est pas
  // applicable (rien autour du panel) — pas d'effet nuisible non plus.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (wrapperRef.current?.contains(target)) return // clic sur la bell elle-même
      if (panelRef.current?.contains(target)) return  // clic dans le panel
      setOpen(false)
    }
    // setTimeout 0 pour éviter que le clic qui a ouvert le panel ne le ferme aussitôt
    const id = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="notification-bell-wrapper">
      <button
        className="notification-bell"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <span className="notification-bell-icon">{'🔔'}</span>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && createPortal(
        <div ref={panelRef}>
          <NotificationPanel onClose={() => setOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  )
}
