import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import type { V05Description } from '../../../types/placeDetail'
import { renderRichText } from '../../../lib/renderRichText'
import './PlaceDescription.css'

interface Props {
  description: V05Description | null
  canEdit: boolean              // a découvert le lieu
  onEdit: () => void
  onOpenHistory: () => void
  onChanged: () => void
}

export function PlaceDescription({ description, canEdit, onEdit, onOpenHistory, onChanged }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(description?.likedByMe ?? false)
  const [count, setCount] = useState(description?.votesUp ?? 0)
  const [busy, setBusy] = useState(false)

  // La description est collaborative : like ouvert à tous (y compris le contributeur),
  // via une RPC dédiée sans le garde "cannot_vote_own" de vote_contribution.
  async function toggleLike() {
    if (!userId || !description || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('toggle_contribution_like', {
      p_user_id: userId, p_contribution_id: description.id,
    })
    const res = data as { success?: boolean; liked?: boolean; votesUp?: number } | null
    if (!error && res?.success) {
      setLiked(res.liked ?? false)
      setCount(res.votesUp ?? 0)
      onChanged()
    }
    setBusy(false)
  }

  if (!description) {
    return (
      <div className="place-descr place-descr-empty">
        <div className="place-descr-rule"><span>LE LIEU</span></div>
        <p className="place-descr-invite">Aucune description pour l'instant.{canEdit ? ' Sois le premier à décrire ce lieu.' : ''}</p>
        {canEdit && <button className="place-descr-contribute" onClick={onEdit}>✎ Décrire ce lieu</button>}
      </div>
    )
  }

  return (
    <div className="place-descr">
      <div className="place-descr-rule"><span>LE LIEU</span></div>
      <div className="place-descr-text">{renderRichText(description.content)}</div>
      <div className="place-descr-foot">
        <div className="place-descr-byline">
          {description.contributors.length > 0 && (
            <div className="place-descr-avatars">
              {description.contributors.slice(0, 6).map((c, i) => (
                c.avatar ? (
                  <img key={c.userId} className="place-descr-av" src={c.avatar} alt={c.name ?? ''} title={c.name ?? undefined} style={{ zIndex: 10 - i }} />
                ) : (
                  <span key={c.userId} className="place-descr-av place-descr-av-fb" title={c.name ?? undefined} style={{ zIndex: 10 - i }}>
                    {(c.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                )
              ))}
              {description.contributors.length > 6 && (
                <span className="place-descr-av place-descr-av-more">+{description.contributors.length - 6}</span>
              )}
            </div>
          )}
          <span className="place-descr-credit">
            {description.editorName && (
              <>
                {description.contributors.length > 1
                  ? <>Enrichi par <b>{description.editorName}</b> &amp; {description.contributors.length - 1} autre{description.contributors.length - 1 > 1 ? 's' : ''}</>
                  : <>Par <b>{description.editorName}</b></>}
                {' · '}
              </>
            )}
            <button className="place-descr-history" onClick={onOpenHistory}>voir l'historique</button>
          </span>
        </div>
        <div className="place-descr-actions">
          <button className={`place-descr-seal${liked ? ' liked' : ''}`} onClick={toggleLike} disabled={!userId || busy}>
            {liked ? '❤' : '🤍'} {count > 0 ? count : ''}
          </button>
          {canEdit && <button className="place-descr-contribute" onClick={onEdit}>✎ Contribuer</button>}
        </div>
      </div>
    </div>
  )
}
