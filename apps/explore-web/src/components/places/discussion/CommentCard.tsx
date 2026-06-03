import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import type { V05Contribution } from '../../../types/placeDetail'
import './CommentCard.css'

interface CommentCardProps {
  comment: V05Contribution
  replies: V05Contribution[]
  onPhotoOpen: (photos: string[], index: number) => void
  onReply: (parentId: number) => void
  onChanged: () => void
}

export function CommentCard({ comment, replies, onPhotoOpen, onReply, onChanged }: CommentCardProps) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(comment.likedByMe)
  const [count, setCount] = useState(comment.votesUp)
  const [busy, setBusy] = useState(false)

  async function toggleLike(id: number, isLiked: boolean) {
    if (!userId || busy) return
    setBusy(true)
    const rpc = isLiked ? 'unlike_contribution' : 'vote_contribution'
    const args = isLiked
      ? { p_user_id: userId, p_contribution_id: id }
      : { p_user_id: userId, p_contribution_id: id, p_vote: 1 }
    const { data, error } = await supabase.rpc(rpc, args)
    if (!error && (data as { success?: boolean } | null)?.success) {
      setLiked(!isLiked); setCount(c => isLiked ? Math.max(0, c - 1) : c + 1); onChanged()
    }
    setBusy(false)
  }

  return (
    <div className="cmt" id={`comment-${comment.id}`}>
      <div className="cmt-head">
        <button className="cmt-av-btn" onClick={() => useMapStore.getState().setSelectedPlayerId(comment.userId)}>
          {comment.userAvatar
            ? <img className="cmt-av" src={comment.userAvatar} alt="" />
            : <span className="cmt-av cmt-av-fallback">{comment.userName.charAt(0).toUpperCase()}</span>}
        </button>
        <span className="cmt-name">{comment.userName}</span>
        <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
      </div>
      {comment.images.length > 0 && (
        <div className="cmt-photos">
          {comment.images.map((u, i) => (
            <img key={i} src={u} alt="" loading="lazy" onClick={() => onPhotoOpen(comment.images, i)} />
          ))}
        </div>
      )}
      <p className="cmt-text">{comment.content}</p>
      <div className="cmt-foot">
        <button className={`cmt-mini${liked ? ' liked' : ''}`} onClick={() => toggleLike(comment.id, liked)} disabled={!userId || busy}>
          {liked ? '❤' : '🤍'} {count > 0 ? count : ''}
        </button>
        <button className="cmt-mini" onClick={() => onReply(comment.id)}>↩ Répondre</button>
      </div>
      {replies.length > 0 && (
        <div className="cmt-replies">
          {replies.map(r => (
            <CommentCard key={r.id} comment={r} replies={[]} onPhotoOpen={onPhotoOpen} onReply={() => onReply(comment.id)} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24); if (j < 7) return `il y a ${j} j`
  return `il y a ${Math.floor(j / 7)} sem.`
}
