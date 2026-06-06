import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useAnnouncementSocial } from '../../hooks/useAnnouncements'
import { formatRelativeTime } from '../../lib/dateFormat'
import type { AnnouncementComment } from '../../types/announcement'
import './AnnouncementSocial.css'

/** Réactions (❤️) + fil de commentaires (réponses 1 niveau) sous une annonce. */
export function AnnouncementSocial({ announcementId }: { announcementId: string }) {
  const userId = usePlayerStore(s => s.userId)
  const { social, refresh } = useAnnouncementSocial(announcementId, userId)

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likeBusy, setLikeBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (social) { setLiked(social.likedByMe); setLikeCount(social.likeCount) }
  }, [social])

  async function toggleLike() {
    if (!userId || likeBusy) return
    setLikeBusy(true)
    // optimiste
    const next = !liked
    setLiked(next); setLikeCount(c => c + (next ? 1 : -1))
    const { data, error } = await supabase.rpc('toggle_announcement_like', { p_announcement_id: announcementId })
    const res = data as { liked?: boolean; count?: number } | null
    if (error || !res) { setLiked(liked); setLikeCount(likeCount) } // rollback
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
          {likeCount > 0 && <span className="ann-like-count">{likeCount}</span>}
        </button>
        <span className="ann-react-label">Cette nouvelle vous parle ?</span>
      </div>

      <h2 className="ann-social-title">Commentaires</h2>
      <div className="ann-comments">
        {roots.length === 0 ? (
          <p className="ann-comments-empty">Personne n'a encore réagi. Lancez la discussion !</p>
        ) : (
          roots.map(c => (
            <AnnCommentCard
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
    </section>
  )
}

function AnnCommentCard({ comment, replies, onReply }: {
  comment: AnnouncementComment
  replies: AnnouncementComment[]
  onReply: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="ann-cmt">
      <Avatar name={comment.userName} url={comment.userAvatar} />
      <div className="ann-cmt-main">
        <div className="ann-cmt-top">
          <span className="ann-cmt-name">{comment.userName}</span>
          <span className="ann-cmt-text"> {comment.content}</span>
        </div>
        <div className="ann-cmt-meta">
          <span className="ann-cmt-time">{formatRelativeTime(comment.createdAt)}</span>
          <button className="ann-cmt-reply" onClick={onReply}>Répondre</button>
        </div>

        {replies.length > 0 && (
          expanded ? (
            <>
              <div className="ann-cmt-replies">
                {replies.map(r => (
                  <div className="ann-cmt ann-cmt-isreply" key={r.id}>
                    <Avatar name={r.userName} url={r.userAvatar} />
                    <div className="ann-cmt-main">
                      <div className="ann-cmt-top">
                        <span className="ann-cmt-name">{r.userName}</span>
                        <span className="ann-cmt-text"> {r.content}</span>
                      </div>
                      <div className="ann-cmt-meta">
                        <span className="ann-cmt-time">{formatRelativeTime(r.createdAt)}</span>
                        <button className="ann-cmt-reply" onClick={onReply}>Répondre</button>
                      </div>
                    </div>
                  </div>
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
    </div>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url
    ? <img className="ann-cmt-av" src={url} alt="" />
    : <span className="ann-cmt-av ann-cmt-av-fb">{name.charAt(0).toUpperCase()}</span>
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
