import { useEffect, useState, useRef } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { EmailChangeModal } from './EmailChangeModal'
import { useCalendarRef } from '../../hooks/useCalendarRef'
import { CALENDAR_LABELS } from '../../lib/calendarUtils'

interface ProfileMenuProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function ProfileMenu({ email, onSignOut, onFactionModal }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { calendarRef, setCalendarRef } = useCalendarRef()

  // Lire directement depuis playerStore au lieu de refaire un appel RPC
  const userId = usePlayerStore(s => s.userId)
  const userName = usePlayerStore(s => s.userName)
  const userAvatarUrl = usePlayerStore(s => s.userAvatarUrl)
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const userFactionTitle = usePlayerStore(s => s.userFactionTitle)

  // Fermer le menu si clic a l'exterieur
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const displayName = userName || email
  const initial = displayName[0].toUpperCase()

  function handleViewProfile() {
    if (!userId) return
    setOpen(false)
    useMapStore.getState().setSelectedPlayerId(userId)
  }

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button
        className="toolbar-btn profile-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Mon profil"
      >
        {userAvatarUrl ? (
          <img
            src={userAvatarUrl}
            alt=""
            className="profile-btn-avatar"
          />
        ) : (
          <span className="profile-btn-initial">{initial}</span>
        )}
      </button>

      {open && (
        <div className="profile-dropdown">
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
            onClick={() => { setOpen(false); onFactionModal() }}
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
              'Rejoindre une faction'
            )}
          </button>

          <button
            className="profile-dropdown-action"
            onClick={() => { setOpen(false); setShowEmailChange(true) }}
          >
            Changer mon email
          </button>

          <div className="profile-dropdown-divider" />

          <div className="profile-dropdown-calendar">
            <span className="profile-dropdown-calendar-label">Référentiel calendaire</span>
            {(['gregorian', 'auc', 'constantinople'] as const).map(ref => (
              <button
                key={ref}
                className={`profile-dropdown-action calendar-ref-option ${calendarRef === ref ? 'active' : ''}`}
                onClick={() => setCalendarRef(ref)}
              >
                {calendarRef === ref && <span className="calendar-ref-check">✓</span>}
                {CALENDAR_LABELS[ref]}
              </button>
            ))}
          </div>

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
