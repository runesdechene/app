import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useFogStore } from '../../stores/fogStore'
import { useMapStore } from '../../stores/mapStore'

interface ProfileData {
  id: string
  lastName: string
  role: string
  profileImage: { id: string; url: string } | null
  faction: { id: string; title: string; color: string; pattern: string | null } | null
}

interface ProfileMenuProps {
  email: string
  onSignOut: () => void
  onFactionModal: () => void
}

export function ProfileMenu({ email, onSignOut, onFactionModal }: ProfileMenuProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const userId = useFogStore(s => s.userId)

  useEffect(() => {
    async function fetchProfile() {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email_address', email)
        .single()

      if (!user) return

      const { data } = await supabase.rpc('get_my_informations', {
        p_user_id: user.id,
      })

      if (data && !data.error) {
        setProfile(data as ProfileData)
      }
    }

    fetchProfile()
  }, [email])

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

  const initial = profile?.lastName?.[0]?.toUpperCase() || email[0].toUpperCase()

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
        {profile?.profileImage ? (
          <img
            src={profile.profileImage.url}
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
              {profile?.lastName || email}
            </span>
            {profile?.role === 'admin' && (
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
            {profile?.faction ? (
              <span className="faction-current">
                <span
                  className="faction-selector-dot"
                  style={{ backgroundColor: profile.faction.color }}
                />
                {profile.faction.title}
              </span>
            ) : (
              'Rejoindre une faction'
            )}
          </button>

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-action" onClick={onSignOut}>
            Se deconnecter
          </button>
        </div>
      )}
    </div>
  )
}
