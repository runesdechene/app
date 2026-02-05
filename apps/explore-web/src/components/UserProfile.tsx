import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface UserProfileData {
  id: string
  email_address: string
  first_name: string | null
  last_name: string
  profile_image_id: string | null
  biography: string
  rank: string
  placesCount: number
}

export function UserProfile({ authEmail }: { authEmail: string }) {
  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email_address', authEmail)
        .single()

      if (userError || !user) {
        console.error('User not found:', userError?.message)
        setLoading(false)
        return
      }

      const { count: placesCount } = await supabase
        .from('places_explored')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setProfile({
        ...user,
        placesCount: placesCount || 0
      })
      setLoading(false)
    }

    fetchProfile()
  }, [authEmail])

  if (loading) {
    return (
      <div className="user-profile loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="user-profile empty">
        <p>Profil non trouvé</p>
        <p className="muted">Email: {authEmail}</p>
      </div>
    )
  }

  const avatarUrl = profile.profile_image_id 
    ? `https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/avatars/${profile.profile_image_id}`
    : null

  return (
    <div className="user-profile">
      <div className="profile-header">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="avatar" />
        ) : (
          <div className="avatar placeholder">
            {profile.first_name?.[0] || profile.last_name[0]}
          </div>
        )}
        <div className="profile-info">
          <h2>{profile.first_name} {profile.last_name}</h2>
          <span className="rank">{profile.rank}</span>
        </div>
      </div>

      {profile.biography && (
        <p className="biography">{profile.biography}</p>
      )}

      <div className="profile-stats">
        <div className="stat">
          <span className="stat-value">{profile.placesCount}</span>
          <span className="stat-label">Lieux explorés</span>
        </div>
      </div>
    </div>
  )
}
