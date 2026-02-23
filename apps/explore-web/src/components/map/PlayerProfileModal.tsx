import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface PlayerProfile {
  userId: string
  name: string
  factionId: string | null
  factionTitle: string | null
  factionColor: string | null
  factionPattern: string | null
  profileImage: string | null
  notorietyPoints: number
  discoveredCount: number
  claimedCount: number
  likesCount: number
  placesAdded: number
  joinedAt: string
}

interface Props {
  playerId: string
  onClose: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PlayerProfileModal({ playerId, onClose }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_player_profile', { p_user_id: playerId })
      if (data) setProfile(data as unknown as PlayerProfile)
      setLoading(false)
    }
    load()
  }, [playerId])

  return (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="player-modal" onClick={e => e.stopPropagation()}>
        <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        {loading && <div className="player-modal-loading">Chargement...</div>}

        {!loading && !profile && <div className="player-modal-loading">Joueur introuvable</div>}

        {!loading && profile && (
          <>
            {/* Avatar */}
            <div className="player-modal-avatar-wrap">
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={profile.name}
                  className="player-modal-avatar"
                  style={{ borderColor: profile.factionColor ?? '#8A7B6A' }}
                />
              ) : (
                <div
                  className="player-modal-avatar-fallback"
                  style={{ background: profile.factionColor ?? '#8A7B6A' }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.factionPattern && (
                <img
                  src={profile.factionPattern}
                  alt=""
                  className="player-modal-faction-badge"
                />
              )}
            </div>

            {/* Nom + faction */}
            <h2 className="player-modal-name">{profile.name}</h2>
            {profile.factionTitle && (
              <span
                className="player-modal-faction"
                style={{ color: profile.factionColor ?? '#8A7B6A' }}
              >
                {profile.factionTitle}
              </span>
            )}

            {/* Stats */}
            <div className="player-modal-stats">
              <div className="player-modal-stat">
                <span className="player-modal-stat-value">{profile.notorietyPoints}</span>
                <span className="player-modal-stat-label">Notoriété</span>
              </div>
              <div className="player-modal-stat">
                <span className="player-modal-stat-value">{profile.discoveredCount}</span>
                <span className="player-modal-stat-label">Lieux découverts</span>
              </div>
              <div className="player-modal-stat">
                <span className="player-modal-stat-value">{profile.claimedCount}</span>
                <span className="player-modal-stat-label">Lieux revendiqués</span>
              </div>
              <div className="player-modal-stat">
                <span className="player-modal-stat-value">{profile.likesCount}</span>
                <span className="player-modal-stat-label">Likes donnés</span>
              </div>
              <div className="player-modal-stat">
                <span className="player-modal-stat-value">{profile.placesAdded}</span>
                <span className="player-modal-stat-label">Lieux ajoutés</span>
              </div>
            </div>

            {/* Date */}
            <p className="player-modal-joined">
              Explorateur depuis le {formatDate(profile.joinedAt)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
