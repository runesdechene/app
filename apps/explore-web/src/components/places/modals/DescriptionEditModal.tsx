import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import './AddCarnetModal.css'

interface Props { placeId: string; initial: string; onClose: () => void; onSaved: () => void }

export function DescriptionEditModal({ placeId, initial, onClose, onSaved }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!userId || !text.trim() || saving) return
    setSaving(true); setError(null)
    const { data, error } = await supabase.rpc('edit_place_description', {
      p_user_id: userId, p_place_id: placeId, p_content: text.trim(),
    })
    const res = data as { success?: boolean; error?: string } | null
    if (error || res?.error) { setError(res?.error === 'not_discovered' ? "Découvrez ce lieu pour le décrire." : 'Erreur'); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  return createPortal(
    <div className="add-carnet-overlay" onClick={onClose}>
      <div className="add-carnet-modal" onClick={e => e.stopPropagation()}>
        <div className="add-carnet-header"><h3>Décrire ce lieu</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          <p style={{ fontSize: 13, color: 'var(--color-ink-light)', marginBottom: 8 }}>
            Tu enrichis la description commune. Chaque version est conservée dans l'historique.
          </p>
          <textarea className="add-carnet-textarea" value={text} onChange={e => setText(e.target.value)}
            placeholder="Décris ce lieu pour les autres aventuriers…" rows={8} />
          {error && <p className="add-carnet-error">{error}</p>}
        </div>
        <div className="add-carnet-footer">
          <button className="add-carnet-submit" onClick={save} disabled={saving || !text.trim()}>
            {saving ? 'Enregistrement…' : 'Publier'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
