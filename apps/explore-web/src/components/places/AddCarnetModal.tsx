import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './AddCarnetModal.css'

interface AddCarnetModalProps {
  placeId: string
  canRate: boolean    // true si explorateur GPS ou découvreur
  onClose: () => void
  onSaved: () => void
}

export function AddCarnetModal({ placeId, canRate, onClose, onSaved }: AddCarnetModalProps) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function addPhotos(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - photos.length) // max 5 photos
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPhotos(prev => [...prev, ...newFiles])
    setPreviews(prev => [...prev, ...newPreviews])
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previews[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!userId || !text.trim() || saving) return
    setSaving(true)
    setError(null)

    // 1. Upload photos
    const imageUrls: string[] = []
    for (const photo of photos) {
      const ext = 'webp'
      const path = `places/${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('place-images')
        .upload(path, photo, { contentType: 'image/webp', upsert: false })

      if (uploadErr) {
        setError('Erreur upload photo')
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('place-images').getPublicUrl(path)
      imageUrls.push(urlData.publicUrl)
    }

    // 2. Create contribution with type 'carnet'
    // We need to use a direct insert since contribute_to_place doesn't handle images array
    const { error: insertErr } = await supabase
      .from('place_contributions')
      .upsert({
        place_id: placeId,
        user_id: userId,
        faction_id: usePlayerStore.getState().userFactionId,
        type: 'carnet',
        content: text.trim(),
        images: imageUrls,
        rating: rating,
      }, { onConflict: 'place_id,user_id,type' })

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    // 3. Call contribute_to_place RPC for the rewards (influence, exploration, erudition)
    await supabase.rpc('contribute_to_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_type: 'carnet',
      p_content: text.trim(),
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="add-carnet-overlay" onClick={onClose}>
      <div className="add-carnet-modal" onClick={e => e.stopPropagation()}>
        <div className="add-carnet-header">
          <h3>Ma page de carnet</h3>
          <button className="add-carnet-close" onClick={onClose}>✕</button>
        </div>

        <div className="add-carnet-body">
          {/* Text */}
          <textarea
            className="add-carnet-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Votre récit, vos impressions, vos conseils..."
            rows={5}
          />

          {/* Photos */}
          <div className="add-carnet-photos-section">
            <div className="add-carnet-photos-label">
              📷 Photos ({photos.length}/5)
            </div>
            <div className="add-carnet-photos-grid">
              {previews.map((src, i) => (
                <div key={i} className="add-carnet-photo-thumb">
                  <img src={src} alt="" />
                  <button className="add-carnet-photo-remove" onClick={() => removePhoto(i)}>✕</button>
                </div>
              ))}
              {photos.length < 5 && (
                <button className="add-carnet-photo-add" onClick={() => fileRef.current?.click()}>
                  +
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={e => addPhotos(e.target.files)}
            />
          </div>

          {/* Rating */}
          {canRate && (
            <div className="add-carnet-rating">
              <span className="add-carnet-rating-label">Note :</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`add-carnet-star ${rating !== null && n <= rating ? 'active' : ''}`}
                  onClick={() => setRating(prev => prev === n ? null : n)}
                >
                  ★
                </button>
              ))}
            </div>
          )}

          {error && <p className="add-carnet-error">{error}</p>}
        </div>

        <div className="add-carnet-footer">
          <button
            className="add-carnet-submit"
            onClick={submit}
            disabled={saving || !text.trim()}
          >
            {saving ? 'Publication...' : 'Publier ma page'}
          </button>
        </div>
      </div>
    </div>
  )
}
