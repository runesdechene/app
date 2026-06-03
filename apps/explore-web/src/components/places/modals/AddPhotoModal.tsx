import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import './AddCarnetModal.css'

interface Props { placeId: string; onClose: () => void; onSaved: () => void }

export function AddPhotoModal({ placeId, onClose, onSaved }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function add(fl: FileList | null) {
    if (!fl) return
    const next = Array.from(fl).slice(0, 5 - files.length)
    setFiles(p => [...p, ...next]); setPreviews(p => [...p, ...next.map(f => URL.createObjectURL(f))])
  }

  async function submit() {
    if (!userId || files.length === 0 || saving) return
    setSaving(true); setError(null)
    const urls: string[] = []
    for (const f of files) {
      const path = `places/${userId}/${crypto.randomUUID()}.webp`
      const { error: upErr } = await supabase.storage.from('place-images').upload(path, f, { contentType: 'image/webp', upsert: false })
      if (upErr) { setError('Erreur upload'); setSaving(false); return }
      urls.push(supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl)
    }
    const { data, error } = await supabase.rpc('add_place_photos', { p_user_id: userId, p_place_id: placeId, p_images: urls })
    if (error || (data as { error?: string } | null)?.error) { setError('Erreur'); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  return createPortal(
    <div className="add-carnet-overlay" onClick={onClose}>
      <div className="add-carnet-modal" onClick={e => e.stopPropagation()}>
        <div className="add-carnet-header"><h3>Ajouter une photo</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          <div className="add-carnet-photos-grid">
            {previews.map((s, i) => (<div key={i} className="add-carnet-photo-thumb"><img src={s} alt="" /></div>))}
            {files.length < 5 && (<button className="add-carnet-photo-add" onClick={() => fileRef.current?.click()}>+</button>)}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />
          {error && <p className="add-carnet-error">{error}</p>}
        </div>
        <div className="add-carnet-footer">
          <button className="add-carnet-submit" onClick={submit} disabled={saving || files.length === 0}>
            {saving ? 'Envoi…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
