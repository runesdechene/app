import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import type { V05Description } from '../../../types/placeDetail'
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

  async function toggleLike() {
    if (!userId || !description || busy) return
    setBusy(true)
    const rpc = liked ? 'unlike_contribution' : 'vote_contribution'
    const args = liked ? { p_user_id: userId, p_contribution_id: description.id }
      : { p_user_id: userId, p_contribution_id: description.id, p_vote: 1 }
    const { data, error } = await supabase.rpc(rpc, args)
    if (!error && (data as { success?: boolean } | null)?.success) {
      setLiked(!liked); setCount(c => liked ? Math.max(0, c - 1) : c + 1); onChanged()
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
      <p className="place-descr-text">{description.content}</p>
      <div className="place-descr-foot">
        <span className="place-descr-credit">
          {description.editorName && (
            <>
              {description.revisionCount > 1
                ? <>Enrichi par <b>{description.editorName}</b> et d'autres</>
                : <>Par <b>{description.editorName}</b></>}
              {' · '}
            </>
          )}
          <button className="place-descr-history" onClick={onOpenHistory}>voir l'historique</button>
        </span>
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
