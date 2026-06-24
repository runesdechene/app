import { useEffect, useState, useRef } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useGeolocPromptStore } from '../../stores/geolocPromptStore'
import { EmailChangeModal } from './EmailChangeModal'
import { PushSettings } from '../notifications/PushSettings'
import { supabase } from '../../lib/supabase'

interface ProfileMenuProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function ProfileMenu({ email, onSignOut, onFactionModal }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Lire directement depuis playerStore au lieu de refaire un appel RPC
  const userId = usePlayerStore(s => s.userId)
  const userName = usePlayerStore(s => s.userName)
  const userAvatarUrl = usePlayerStore(s => s.userAvatarUrl)
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userFactionColor = usePlayerStore(s => s.userFactionColor)
  const userFactionTitle = usePlayerStore(s => s.userFactionTitle)
  const brouillerPistes = usePlayerStore(s => s.brouillerPistes)
  const [savingBrouiller, setSavingBrouiller] = useState(false)

  async function setBrouiller(value: boolean) {
    if (savingBrouiller || value === brouillerPistes) return
    setSavingBrouiller(true)
    // Optimistic: applique localement, le serveur suit.
    usePlayerStore.getState().setBrouillerPistes(value)
    // Si on désactive, libérer la position floutée pour broadcaster la vraie au prochain track.
    // Si on réactive, useBrouillagePistes recalculera (transition false→true).
    if (!value) usePlayerStore.getState().setPublicPosition(null)
    const { error } = await supabase.rpc('set_brouiller_pistes', { p_enabled: value })
    if (error) {
      console.warn('[ProfileMenu] set_brouiller_pistes failed', error)
      usePlayerStore.getState().setBrouillerPistes(!value)
    }
    setSavingBrouiller(false)
  }

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
              'Rejoindre une Compagnie'
            )}
          </button>

          <button
            className="profile-dropdown-action"
            onClick={() => { setOpen(false); setShowEmailChange(true) }}
          >
            Changer mon email
          </button>

          {/* Sélecteur "Référentiel calendaire" masqué 2026-05-02 (Uriel — pas utilisé en
              pratique). Le grégorien reste le défaut côté display (PlacePanel, PlaceInfos).
              EraSelector continue de marcher pour la saisie multi-calendrier des années à
              l'ajout d'un lieu. Décommenter si on veut réactiver l'option pour les passionnés. */}

          <div className="profile-dropdown-divider" />

          <div className="profile-dropdown-calendar">
            <span className="profile-dropdown-calendar-label">Visibilité de ma position</span>
            <button
              className={`profile-dropdown-action calendar-ref-option ${brouillerPistes ? 'active' : ''}`}
              onClick={() => setBrouiller(true)}
              disabled={savingBrouiller}
            >
              {brouillerPistes && <span className="calendar-ref-check">✓</span>}
              🔒 Pistes brouillées (50 km)
            </button>
            <button
              className={`profile-dropdown-action calendar-ref-option ${!brouillerPistes ? 'active' : ''}`}
              onClick={() => setBrouiller(false)}
              disabled={savingBrouiller}
            >
              {!brouillerPistes && <span className="calendar-ref-check">✓</span>}
              👁️ Position GPS exacte
            </button>
          </div>

          <PushSettings />

          <button
            className="profile-dropdown-action"
            onClick={() => { setOpen(false); useGeolocPromptStore.getState().open() }}
          >
            📍 Activer ma position GPS
          </button>

          <button
            className="profile-dropdown-action"
            onClick={() => { setOpen(false); usePlayerStore.getState().setReplayTutorial(true) }}
          >
            🎓 Rejouer le tutoriel
          </button>

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
