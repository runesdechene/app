import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface FactionData {
  id: string
  title: string
  color: string
  pattern: string | null
}

interface ProfileData {
  id: string
  lastName: string
  biography: string
  rank: string
  profileImage: { id: string; url: string } | null
  faction: FactionData | null
}

interface ProfileMenuProps {
  email: string
  onSignOut: () => void
}

export function ProfileMenu({ email, onSignOut }: ProfileMenuProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [factions, setFactions] = useState<FactionData[]>([])
  const [changingFaction, setChangingFaction] = useState(false)
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

  // Charger les factions quand on ouvre le sélecteur
  useEffect(() => {
    if (!changingFaction) return

    supabase
      .from('factions')
      .select('id, title, color, pattern')
      .order('order')
      .then(({ data }) => {
        if (data) setFactions(data as FactionData[])
      })
  }, [changingFaction])

  // Fermer le menu si clic à l'extérieur
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setChangingFaction(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function selectFaction(factionId: string | null) {
    if (!profile) return

    await supabase.rpc('set_user_faction', {
      p_user_id: profile.id,
      p_faction_id: factionId,
    })

    // Mettre à jour le profil local
    if (factionId) {
      const faction = factions.find(f => f.id === factionId) ?? null
      setProfile(prev => prev ? { ...prev, faction } : null)
    } else {
      setProfile(prev => prev ? { ...prev, faction: null } : null)
    }

    setChangingFaction(false)
  }

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
            {profile?.rank && profile.rank !== 'guest' && (
              <span className="profile-dropdown-rank">{profile.rank}</span>
            )}
          </div>

          {profile?.biography && (
            <p className="profile-dropdown-bio">{profile.biography}</p>
          )}

          {/* Faction */}
          <div className="profile-dropdown-divider" />

          {changingFaction ? (
            <div className="faction-selector">
              <p className="faction-selector-title">Choisir une faction</p>
              {factions.map(f => (
                <button
                  key={f.id}
                  className={`faction-selector-option ${profile?.faction?.id === f.id ? 'faction-selector-active' : ''}`}
                  onClick={() => selectFaction(f.id)}
                >
                  <span
                    className="faction-selector-dot"
                    style={{ backgroundColor: f.color }}
                  />
                  {f.title}
                </button>
              ))}
              {profile?.faction && (
                <button
                  className="faction-selector-option faction-selector-leave"
                  onClick={() => selectFaction(null)}
                >
                  Quitter ma faction
                </button>
              )}
              <button
                className="faction-selector-option faction-selector-cancel"
                onClick={() => setChangingFaction(false)}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              className="profile-dropdown-action"
              onClick={() => setChangingFaction(true)}
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
          )}

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-action" onClick={onSignOut}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
