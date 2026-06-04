import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import { renderInlineRichText } from '../../../lib/renderRichText'
import { LikeButton } from './LikeButton'
import type { V05Contribution } from '../../../types/placeDetail'
import './CommentCard.css'

interface CommentCardProps {
  comment: V05Contribution
  replies: V05Contribution[]
  isReply?: boolean
  onPhotoOpen: (photos: string[], index: number) => void
  onReply: (parentId: number) => void
  onChanged: () => void
}

export function CommentCard({ comment, replies, isReply = false, onPhotoOpen, onReply, onChanged }: CommentCardProps) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(comment.likedByMe)
  const [count, setCount] = useState(comment.votesUp)
  const [busy, setBusy] = useState(false)

  // Like générique : ouvert à tous, y compris son propre commentaire.
  async function toggleLike() {
    if (!userId || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('toggle_contribution_like', {
      p_user_id: userId, p_contribution_id: comment.id,
    })
    const res = data as { success?: boolean; liked?: boolean; votesUp?: number } | null
    if (!error && res?.success) { setLiked(res.liked ?? false); setCount(res.votesUp ?? 0); onChanged() }
    setBusy(false)
  }

  return (
    <div className={`cmt${isReply ? ' cmt-reply' : ''}`} id={`comment-${comment.id}`}>
      <button className="cmt-av-btn" onClick={() => useMapStore.getState().setSelectedPlayerId(comment.userId)} aria-label={comment.userName}>
        {comment.userAvatar
          ? <img className="cmt-av" src={comment.userAvatar} alt="" />
          : <span className="cmt-av cmt-av-fb">{comment.userName.charAt(0).toUpperCase()}</span>}
      </button>
      <div className="cmt-main">
        <div className="cmt-top">
          <span className="cmt-name">{comment.userName}</span>
          {comment.content && <span className="cmt-text"> {renderInlineRichText(comment.content)}</span>}
        </div>
        {comment.images.length > 0 && (
          <div className="cmt-photos">
            {comment.images.map((u, i) => (
              <img key={i} src={u} alt="" loading="lazy" onClick={() => onPhotoOpen(comment.images, i)} />
            ))}
          </div>
        )}
        <div className="cmt-meta">
          <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
          <LikeButton liked={liked} count={count} disabled={!userId || busy} variant="mini" onToggle={toggleLike} />
          {!isReply && <button className="cmt-reply-btn" onClick={() => onReply(comment.id)}>Répondre</button>}
        </div>

        {replies.length > 0 && (
          <div className="cmt-replies">
            {replies.map(r => (
              <CommentCard key={r.id} comment={r} replies={[]} isReply onPhotoOpen={onPhotoOpen} onReply={() => onReply(comment.id)} onChanged={onChanged} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `${h} h`
  const j = Math.floor(h / 24); if (j < 7) return `${j} j`
  return `${Math.floor(j / 7)} sem.`
}
