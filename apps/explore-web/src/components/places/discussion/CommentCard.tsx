import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import { renderRichText } from '../../../lib/renderRichText'
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

  // Like générique : ouvert à tous, y compris son propre commentaire (collaboratif).
  async function toggleLike() {
    if (!userId || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('toggle_contribution_like', {
      p_user_id: userId, p_contribution_id: comment.id,
    })
    const res = data as { success?: boolean; liked?: boolean; votesUp?: number } | null
    if (!error && res?.success) {
      setLiked(res.liked ?? false)
      setCount(res.votesUp ?? 0)
      onChanged()
    }
    setBusy(false)
  }

  return (
    <div className={`cmt${isReply ? ' cmt-is-reply' : ''}`} id={`comment-${comment.id}`}>
      <button className="cmt-av-btn" onClick={() => useMapStore.getState().setSelectedPlayerId(comment.userId)} aria-label={comment.userName}>
        {comment.userAvatar
          ? <img className="cmt-av" src={comment.userAvatar} alt="" />
          : <span className="cmt-av cmt-av-fallback">{comment.userName.charAt(0).toUpperCase()}</span>}
      </button>
      <div className="cmt-body">
        <div className="cmt-bubble">
          <div className="cmt-head">
            <span className="cmt-name">{comment.userName}</span>
            <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
          </div>
          {comment.content && <div className="cmt-text">{renderRichText(comment.content)}</div>}
          {comment.images.length > 0 && (
            <div className="cmt-photos">
              {comment.images.map((u, i) => (
                <img key={i} src={u} alt="" loading="lazy" onClick={() => onPhotoOpen(comment.images, i)} />
              ))}
            </div>
          )}
        </div>
        <div className="cmt-foot">
          <button className={`cmt-act${liked ? ' liked' : ''}`} onClick={toggleLike} disabled={!userId || busy}>
            <span className="cmt-act-ico">{liked ? '❤' : '🤍'}</span>{count > 0 && <span className="cmt-act-n">{count}</span>}
          </button>
          {!isReply && (
            <button className="cmt-act" onClick={() => onReply(comment.id)}>
              <span className="cmt-act-ico">↩</span> Répondre
            </button>
          )}
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
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24); if (j < 7) return `il y a ${j} j`
  return `il y a ${Math.floor(j / 7)} sem.`
}
