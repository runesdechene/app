import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import './CarnetCard.css'

export interface Carnet {
  id: number
  userId: string
  factionId: string
  content: string
  images: string[]        // URLs des photos liées
  rating: number | null   // 1-5 étoiles (null si pas noté)
  votesUp: number
  votesDown: number
  createdAt: string
  userName: string
  userAvatar: string | null
  // Calculé côté client
  influenceTotal?: number
  influenceBreakdown?: { text: number; photos: number; votes: number }
}

interface CarnetCardProps {
  carnet: Carnet
  isTop: boolean
  factionColor: string | null
  factionSvg: string | null
  influencePerCarnet: number   // from app_settings
  influencePerPhoto: number
  influencePerVote: number
  onVoted: () => void
  onPhotoOpen?: (photos: string[], index: number) => void
}

export function CarnetCard({ carnet, isTop, factionColor, factionSvg, influencePerCarnet, influencePerPhoto, influencePerVote, onVoted, onPhotoOpen }: CarnetCardProps) {
  const userId = usePlayerStore(s => s.userId)
  const [voting, setVoting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [localVotesUp, setLocalVotesUp] = useState(carnet.votesUp)

  // Check if user already liked this carnet
  useEffect(() => {
    if (!userId || carnet.userId === userId) return
    supabase
      .from('contribution_votes')
      .select('vote')
      .eq('contribution_id', carnet.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.vote === 1) setLiked(true)
      })
  }, [userId, carnet.id, carnet.userId])

  const textInfluence = influencePerCarnet
  const photosInfluence = carnet.images.length > 0 ? influencePerPhoto : 0
  const votesInfluence = carnet.votesUp * influencePerVote
  const totalInfluence = textInfluence + photosInfluence + votesInfluence

  async function toggleLike() {
    if (!userId || voting) return
    setVoting(true)

    if (liked) {
      // Unlike via RPC (SECURITY DEFINER)
      const { data, error } = await supabase.rpc('unlike_contribution', {
        p_user_id: userId,
        p_contribution_id: carnet.id,
      })
      const result = data as { success?: boolean } | null
      if (!error && result?.success) {
        setLiked(false)
        setLocalVotesUp(v => Math.max(0, v - 1))
        onVoted()
      }
    } else {
      // Like
      const { data, error } = await supabase.rpc('vote_contribution', {
        p_user_id: userId,
        p_contribution_id: carnet.id,
        p_vote: 1,
      })
      const result = data as { success?: boolean } | null
      if (!error && result?.success) {
        setLiked(true)
        setLocalVotesUp(v => v + 1)
        onVoted()
      }
    }

    setVoting(false)
  }

  const timeAgo = getTimeAgo(carnet.createdAt)

  return (
    <div className={`carnet-card${isTop ? ' carnet-card-top' : ''}`} id={`carnet-${carnet.id}`}>
      {/* Header */}
      <div className="carnet-header">
        <button
          className="carnet-author"
          onClick={() => useMapStore.getState().setSelectedPlayerId(carnet.userId)}
        >
          {carnet.userAvatar ? (
            <img className="carnet-avatar" src={carnet.userAvatar} alt="" />
          ) : (
            <span className="carnet-avatar carnet-avatar-fallback">
              {carnet.userName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="carnet-name">{carnet.userName}</span>
        </button>
        {factionColor && (
          <span className="carnet-faction-badge" style={{ backgroundColor: `${factionColor}20` }}>
            {factionSvg ? (
              <span
                className="carnet-faction-icon"
                style={{
                  WebkitMaskImage: `url(${factionSvg})`,
                  maskImage: `url(${factionSvg})`,
                  backgroundColor: factionColor,
                }}
              />
            ) : (
              <span className="carnet-faction-dot-inner" style={{ backgroundColor: factionColor }} />
            )}
          </span>
        )}
        {carnet.rating !== null && (
          <span className="carnet-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < carnet.rating! ? 'star-filled' : 'star-empty'}>★</span>
            ))}
          </span>
        )}
      </div>

      {/* Text */}
      <p className="carnet-text">{carnet.content}</p>

      {/* Photos */}
      {carnet.images.length > 0 && (
        <div className="carnet-photos">
          {carnet.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="carnet-photo"
              loading="lazy"
              onClick={() => onPhotoOpen?.(carnet.images, i)}
              style={{ cursor: onPhotoOpen ? 'pointer' : undefined }}
            />
          ))}
        </div>
      )}

      {/* Footer: like + date */}
      <div className="carnet-footer">
        {carnet.userId !== userId ? (
          <button
            className={`carnet-like-btn${liked ? ' carnet-liked' : ''}`}
            onClick={toggleLike}
            disabled={voting || !userId}
          >
            {liked ? '❤️' : '🤍'} {liked ? 'Aimé' : 'J\'aime'}{localVotesUp > 0 ? ` (${localVotesUp})` : ''}
          </button>
        ) : (
          localVotesUp > 0 && <span className="carnet-like-count">❤️ {localVotesUp}</span>
        )}
        <span className="carnet-date">{timeAgo}</span>
      </div>

      {/* Influence line */}
      <div className="carnet-influence-line">
        <span
          className="carnet-influence-badge"
          style={{ backgroundColor: factionColor ?? '#8a7a6a' }}
        >
          🏰 +{totalInfluence}
        </span>
        <span className="carnet-influence-breakdown">
          📖 texte +{textInfluence}
          {photosInfluence > 0 && <> · 📷 photos +{photosInfluence}</>}
          {votesInfluence > 0 && <> · 👍 votes +{votesInfluence}</>}
        </span>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days}j`
  const weeks = Math.floor(days / 7)
  return `il y a ${weeks} sem.`
}
