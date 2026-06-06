import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useAnnouncementSocial } from '../../hooks/useAnnouncements'
import { formatRelativeTime } from '../../lib/dateFormat'
import type { AnnouncementComment } from '../../types/announcement'
import '../places/modals/LikersModal.css'
import './AnnouncementSocial.css'

interface Liker { userId: string; name: string | null; avatar: string | null }

/** Réactions (❤️) + fil de commentaires (réponses 1 niveau, like par commentaire) sous une annonce. */
export function AnnouncementSocial({ announcementId }: { announcementId: string }) {
  const userId = usePlayerStore(s => s.userId)
  const { social, refresh } = useAnnouncementSocial(announcementId, userId)

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likeBusy, setLikeBusy] = useState(false)
  const [showLikers, setShowLikers] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (social) { setLiked(social.likedByMe); setLikeCount(social.likeCount) }
  }, [social])

  async function toggleLike() {
    if (!userId || likeBusy) return
    setLikeBusy(true)
    const prevLiked = liked, prevCount = likeCount
    setLiked(!prevLiked); setLikeCount(c => c + (prevLiked ? -1 : 1))
    const { data, error } = await supabase.rpc('toggle_announcement_like', { p_announcement_id: announcementId })
    const res = data as { liked?: boolean; count?: number } | null
    if (error || !res) { setLiked(prevLiked); setLikeCount(prevCount) }
    else { setLiked(!!res.liked); setLikeCount(res.count ?? 0) }
    setLikeBusy(false)
  }

  const comments = social?.comments ?? []
  const roots = useMemo(
    () => comments.filter(c => c.parentId === null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments],
  )
  const repliesByParent = useMemo(() => {
    const m = new Map<number, AnnouncementComment[]>()
    comments.filter(c => c.parentId !== null).forEach(c => {
      const arr = m.get(c.parentId!) ?? []; arr.push(c); m.set(c.parentId!, arr)
    })
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return m
  }, [comments])

  return (
    <section className="ann-social">
      <div className="ann-react">
        <button
          className={`ann-like${liked ? ' on' : ''}`}
          onClick={toggleLike}
          disabled={!userId || likeBusy}
          aria-pressed={liked}
          aria-label={liked ? "Je n'aime plus" : "J'aime"}
        >
          <span className="ann-like-heart">{liked ? '❤️' : '🤍'}</span>
        </button>
        {likeCount > 0 ? (
          <button className="ann-likers-link" onClick={() => setShowLikers(true)}>
            Aimé par {likeCount}
          </button>
        ) : (
          <span className="ann-react-label">Cette nouvelle vous parle ?</span>
        )}
      </div>

      <h2 className="ann-social-title">Commentaires</h2>
      <div className="ann-comments">
        {roots.length === 0 ? (
          <p className="ann-comments-empty">Personne n'a encore réagi. Lancez la discussion !</p>
        ) : (
          roots.map(c => (
            <AnnCommentRow
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              onReply={() => setReplyTo({ id: c.id, name: c.userName })}
            />
          ))
        )}
      </div>

      {userId && (
        <AnnComposer
          announcementId={announcementId}
          replyingTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPosted={() => { setReplyTo(null); refresh() }}
        />
      )}

      {showLikers && (
        <AnnLikersModal
          load={async () => {
            const { data } = await supabase.rpc('get_announcement_likers', { p_announcement_id: announcementId })
            return (data as Liker[]) ?? []
          }}
          onClose={() => setShowLikers(false)}
        />
      )}
    </section>
  )
}

function AnnCommentRow({ comment, replies, isReply = false, onReply }: {
  comment: AnnouncementComment
  replies: AnnouncementComment[]
  isReply?: boolean
  onReply: () => void
}) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(comment.likedByMe)
  const [count, setCount] = useState(comment.votesUp)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showLikers, setShowLikers] = useState(false)

  async function toggleLike() {
    if (!userId || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('toggle_announcement_comment_like', { p_comment_id: comment.id })
    const res = data as { liked?: boolean; votesUp?: number } | null
    if (!error && res) { setLiked(!!res.liked); setCount(res.votesUp ?? 0) }
    setBusy(false)
  }

  return (
    <div className={`ann-cmt${isReply ? ' ann-cmt-isreply' : ''}`}>
      <Avatar name={comment.userName} url={comment.userAvatar} userId={comment.userId} />
      <div className="ann-cmt-main">
        <div className="ann-cmt-top">
          <span className="ann-cmt-name">{comment.userName}</span>
          <span className="ann-cmt-text"> {comment.content}</span>
        </div>
        <div className="ann-cmt-meta">
          <span className="ann-cmt-time">{formatRelativeTime(comment.createdAt)}</span>
          <button
            className={`ann-cmt-like${liked ? ' on' : ''}`}
            onClick={toggleLike}
            disabled={!userId || busy}
            aria-label={liked ? "Je n'aime plus" : "J'aime"}
          >
            {liked ? '❤️' : '🤍'}
          </button>
          {!isReply && <button className="ann-cmt-reply" onClick={onReply}>Répondre</button>}
          {count > 0 && (
            <button className="ann-cmt-likecount" onClick={() => setShowLikers(true)} aria-label={`Aimé par ${count}`}>
              ❤ {count}
            </button>
          )}
        </div>

        {replies.length > 0 && (
          expanded ? (
            <>
              <div className="ann-cmt-replies">
                {replies.map(r => (
                  <AnnCommentRow key={r.id} comment={r} replies={[]} isReply onReply={onReply} />
                ))}
              </div>
              <button className="ann-cmt-toggle" onClick={() => setExpanded(false)}>Masquer les réponses</button>
            </>
          ) : (
            <button className="ann-cmt-toggle" onClick={() => setExpanded(true)}>
              {replies.length === 1 ? 'Voir la réponse' : `Voir les ${replies.length} réponses`}
            </button>
          )
        )}
      </div>

      {showLikers && (
        <AnnLikersModal
          load={async () => {
            const { data } = await supabase.rpc('get_announcement_comment_likers', { p_comment_id: comment.id })
            return (data as Liker[]) ?? []
          }}
          onClose={() => setShowLikers(false)}
        />
      )}
    </div>
  )
}

function Avatar({ name, url, userId }: { name: string; url: string | null; userId: string }) {
  const open = () => useMapStore.getState().setSelectedPlayerId(userId)
  return (
    <button className="ann-cmt-av-btn" onClick={open} aria-label={name}>
      {url
        ? <img className="ann-cmt-av" src={url} alt="" />
        : <span className="ann-cmt-av ann-cmt-av-fb">{name.charAt(0).toUpperCase()}</span>}
    </button>
  )
}

function AnnLikersModal({ load, onClose }: { load: () => Promise<Liker[]>; onClose: () => void }) {
  const [likers, setLikers] = useState<Liker[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    load().then(l => { if (!cancelled) { setLikers(l); setLoading(false) } })
    return () => { cancelled = true }
  }, [load])

  return createPortal(
    <div className="likers-overlay" onClick={onClose}>
      <div className="likers-modal" onClick={e => e.stopPropagation()}>
        <div className="likers-header">
          <h3>❤ Aimé par</h3>
          <button className="likers-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="likers-list">
          {loading ? (
            <p className="likers-empty">Chargement…</p>
          ) : likers.length === 0 ? (
            <p className="likers-empty">Personne pour l'instant.</p>
          ) : (
            likers.map(l => (
              <button
                key={l.userId}
                className="likers-row"
                onClick={() => { useMapStore.getState().setSelectedPlayerId(l.userId); onClose() }}
              >
                {l.avatar
                  ? <img className="likers-av" src={l.avatar} alt="" />
                  : <span className="likers-av likers-av-fb">{(l.name ?? '?').charAt(0).toUpperCase()}</span>}
                <span className="likers-name">{l.name ?? '—'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AnnComposer({ announcementId, replyingTo, onCancelReply, onPosted }: {
  announcementId: string
  replyingTo: { id: number; name: string } | null
  onCancelReply: () => void
  onPosted: () => void
}) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function post() {
    if (!userId || !text.trim() || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('add_announcement_comment', {
      p_announcement_id: announcementId,
      p_content: text.trim(),
      p_parent_id: replyingTo?.id ?? null,
    })
    if (!error && (data as { success?: boolean } | null)?.success) {
      setText(''); onPosted()
    }
    setBusy(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() }
  }

  return (
    <div className="ann-composer">
      {replyingTo && (
        <div className="ann-composer-chip">
          <span>↩ Réponse à <b>{replyingTo.name}</b></span>
          <button onClick={onCancelReply} aria-label="Annuler la réponse">✕</button>
        </div>
      )}
      <div className="ann-composer-bar">
        <input
          className="ann-composer-field"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={replyingTo ? `Répondre à ${replyingTo.name}…` : 'Votre commentaire…'}
        />
        <button className="ann-composer-send" onClick={post} disabled={busy || !text.trim()} aria-label="Publier">➤</button>
      </div>
    </div>
  )
}
