import { useRef, useState } from 'react'
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
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Entoure la sélection d'un marqueur Markdown (**gras**, *italique*).
  function wrap(marker: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const sel = text.slice(start, end) || 'texte'
    const next = text.slice(0, start) + marker + sel + marker + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + marker.length, start + marker.length + sel.length)
    })
  }

  // Préfixe chaque ligne sélectionnée par "- " (liste à puces).
  function toList() {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const block = text.slice(lineStart, end)
    const prefixed = block.split('\n').map(l => (l.startsWith('- ') ? l : '- ' + l)).join('\n')
    const next = text.slice(0, lineStart) + prefixed + text.slice(end)
    setText(next)
    requestAnimationFrame(() => ta.focus())
  }

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
          <div className="rich-toolbar">
            <button type="button" className="rich-tb-btn" title="Gras" onMouseDown={e => { e.preventDefault(); wrap('**') }}><b>B</b></button>
            <button type="button" className="rich-tb-btn" title="Italique" onMouseDown={e => { e.preventDefault(); wrap('*') }}><i>I</i></button>
            <button type="button" className="rich-tb-btn" title="Liste à puces" onMouseDown={e => { e.preventDefault(); toList() }}>• Liste</button>
          </div>
          <textarea ref={taRef} className="add-carnet-textarea" value={text} onChange={e => setText(e.target.value)}
            placeholder="Décris ce lieu pour les autres aventuriers…" rows={8} />
          <p className="rich-hint">Mise en forme : <b>**gras**</b>, <i>*italique*</i>, et « - » en début de ligne pour une liste.</p>
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
