import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import './AddCarnetModal.css'

interface Revision { id: number; content: string; createdAt: string; editorName: string | null }
interface Props { placeId: string; canRestore: boolean; onClose: () => void; onRestored: () => void }

export function DescriptionHistoryModal({ placeId, canRestore, onClose, onRestored }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [revs, setRevs] = useState<Revision[]>([])

  useEffect(() => {
    supabase.rpc('get_place_description_history', { p_place_id: placeId })
      .then(({ data }) => setRevs((data as Revision[]) ?? []))
  }, [placeId])

  async function restore(id: number) {
    if (!userId) return
    const { data } = await supabase.rpc('restore_place_description_revision', {
      p_user_id: userId, p_place_id: placeId, p_revision_id: id,
    })
    if ((data as { success?: boolean } | null)?.success) { onRestored(); onClose() }
  }

  return createPortal(
    <div className="add-carnet-overlay" onClick={onClose}>
      <div className="add-carnet-modal" onClick={e => e.stopPropagation()}>
        <div className="add-carnet-header"><h3>Historique du lieu</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          {revs.length === 0 && <p>Aucune révision.</p>}
          {revs.map((r, i) => (
            <div key={r.id} style={{ borderTop: i ? '1px solid var(--color-parchment-dark)' : 'none', padding: '10px 0' }}>
              <div style={{ fontFamily: 'var(--font-accent)', fontSize: 12, color: 'var(--color-ink-light)' }}>
                {r.editorName ?? '—'} · {new Date(r.createdAt).toLocaleString('fr-FR')}
              </div>
              <p style={{ fontSize: 14, margin: '4px 0' }}>{r.content}</p>
              {canRestore && i !== 0 && (
                <button className="add-carnet-submit" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => restore(r.id)}>
                  Restaurer cette version
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
