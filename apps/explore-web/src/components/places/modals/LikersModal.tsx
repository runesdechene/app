import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { useMapStore } from '../../../stores/mapStore'
import './LikersModal.css'

interface Liker { userId: string; name: string | null; avatar: string | null }
interface Props { contributionId: number; title?: string; onClose: () => void }

export function LikersModal({ contributionId, title = 'Aimé par', onClose }: Props) {
  const [likers, setLikers] = useState<Liker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_contribution_likers', { p_contribution_id: contributionId })
      .then(({ data }) => { if (!cancelled) { setLikers((data as Liker[]) ?? []); setLoading(false) } })
    return () => { cancelled = true }
  }, [contributionId])

  return createPortal(
    <div className="likers-overlay" onClick={onClose}>
      <div className="likers-modal" onClick={e => e.stopPropagation()}>
        <div className="likers-header">
          <h3>❤ {title}</h3>
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
