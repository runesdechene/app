import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface ProfileData {
  id: string
  lastName: string
  biography: string
  rank: string
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

  useEffect(() => {
    async function fetchProfile() {
      // Trouver le user ID par email
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

  // Fermer le menu si clic à l'extérieur
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
            {profile?.rank && profile.rank !== 'guest' && (
              <span className="profile-dropdown-rank">{profile.rank}</span>
            )}
          </div>

          {profile?.biography && (
            <p className="profile-dropdown-bio">{profile.biography}</p>
          )}

          {/* Faction */}
          <div className="profile-dropdown-divider" />

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
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
