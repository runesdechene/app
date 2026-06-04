import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import type { V05Description } from '../../../types/placeDetail'
import { renderRichText } from '../../../lib/renderRichText'
import { LikeButton } from '../discussion/LikeButton'
import { LikersModal } from '../modals/LikersModal'
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
  const [showLikers, setShowLikers] = useState(false)

  // Re-synchronise l'état du like quand la description arrive/se rafraîchit :
  // au 1er montage `description` peut être null (panel en chargement), donc
  // l'init de useState valait 0/false → sans ça, les likes existants restaient
  // invisibles jusqu'à ce qu'on like soi-même.
  useEffect(() => {
    setLiked(description?.likedByMe ?? false)
    setCount(description?.votesUp ?? 0)
  }, [description?.id, description?.likedByMe, description?.votesUp])

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
            {count > 0 && (
              <> · <button className="place-descr-history" onClick={() => setShowLikers(true)}>aimé par {count}</button></>
            )}
          </span>
        </div>
        <div className="place-descr-actions">
          <LikeButton liked={liked} count={count} disabled={!userId || busy} variant="seal" onToggle={toggleLike} />
          {canEdit && <button className="place-descr-contribute" onClick={onEdit}>✎ Contribuer</button>}
        </div>
      </div>

      {showLikers && (
        <LikersModal contributionId={description.id} title="Aimé par" onClose={() => setShowLikers(false)} />
      )}
    </div>
  )
}
