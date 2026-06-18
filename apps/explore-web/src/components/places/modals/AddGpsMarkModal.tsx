import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { compressImage } from '../../../lib/imageUtils'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { createGpsMark } from '../../../lib/gpsMarksApi'
import type { GpsMarkImage } from '../../../types/gpsMark'
import './AddGpsMarkModal.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function getFreshPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

export function AddGpsMarkModal({ onClose }: { onClose: () => void }) {
  const userId = usePlayerStore(s => s.userId)
  const [title, setTitle] = useState('')
  const [previews, setPreviews] = useState<{ full: File; thumb: File; preview: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE)
    if (!valid.length) return
    setBusy(true); setError(null)
    const prepared: { full: File; thumb: File; preview: string }[] = []
    for (const file of valid) {
      try {
        const [full, thumb] = await Promise.all([compressImage(file), compressImage(file, 400)])
        prepared.push({ full, thumb, preview: URL.createObjectURL(full) })
      } catch { /* photo illisible ignorée */ }
    }
    setPreviews(prev => [...prev, ...prepared])
    setBusy(false)
  }

  async function handleSubmit() {
    if (!userId) return
    setBusy(true); setError(null)
    // Position : GPS frais en priorité ; à défaut, fallback sur la position connue
    // du joueur sur la carte (store userPosition, alimentée par le watchPosition /
    // la GeolocateControl). Évite de bloquer la pose quand getCurrentPosition timeout
    // ou est momentanément refusé alors qu'on a déjà un fix récent.
    const fresh = await getFreshPosition()
    const fallback = usePlayerStore.getState().userPosition
    const geo: { lat: number; lng: number; accuracy: number | null } | null =
      fresh ?? (fallback ? { lat: fallback.lat, lng: fallback.lng, accuracy: null } : null)
    if (!geo) {
      setError('Position indisponible. Active ta localisation pour poser une marque.')
      setBusy(false); return
    }
    try {
      const images: GpsMarkImage[] = []
      for (const p of previews) {
        const imageId = crypto.randomUUID()
        const fullPath = `places/${userId}/drafts/${imageId}.webp`
        const thumbPath = `places/${userId}/drafts/${imageId}_thumb.webp`
        const [fullUp, thumbUp] = await Promise.all([
          supabase.storage.from('place-images').upload(fullPath, p.full, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from('place-images').upload(thumbPath, p.thumb, { contentType: 'image/webp', upsert: false }),
        ])
        if (fullUp.error) { setError(`Upload: ${fullUp.error.message}`); setBusy(false); return }
        const full = supabase.storage.from('place-images').getPublicUrl(fullPath).data.publicUrl
        const thumb = thumbUp.error ? full : supabase.storage.from('place-images').getPublicUrl(thumbPath).data.publicUrl
        images.push({ id: imageId, url: full, thumb })
      }
      const res = await createGpsMark({
        userId, lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy,
        title: title.trim() || null, images,
      })
      if ('error' in res) { setError(res.error); setBusy(false); return }
      useGpsMarksStore.getState().addLocal({
        id: res.id, latitude: geo.lat, longitude: geo.lng, accuracyM: geo.accuracy,
        title: title.trim() || null, images, createdAt: res.createdAt, status: 'open',
      })
      useToastStore.getState().addToast({
        type: 'new_place',
        message: '📍 Marque posée. Reviens finir la fiche quand tu veux pour gagner ta visite GPS.',
        timestamp: Date.now(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setBusy(false)
    }
  }

  return createPortal(
    <div className="gps-mark-overlay" onClick={onClose}>
      <div className="gps-mark-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="gps-mark-title">📍 Marque GPS</h2>
        <p className="gps-mark-help">
          On enregistre ta position actuelle comme preuve de passage. Tu pourras transformer
          cette marque en lieu plus tard — et toucher ton bonus de visite GPS à ce moment-là.
        </p>
        {error && <div className="gps-mark-error">{error}</div>}

        <label className="gps-mark-label">Titre rapide <span className="gps-mark-optional">(optionnel)</span></label>
        <input className="gps-mark-input" type="text" value={title}
          onChange={e => setTitle(e.target.value)} placeholder="Ex : lavoir médiéval sur la colline" maxLength={120} />

        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoChange} />
        {previews.length > 0 && (
          <div className="gps-mark-photos">
            {previews.map((p, i) => <img key={p.preview} src={p.preview} alt={`Photo ${i + 1}`} />)}
          </div>
        )}
        <button className="gps-mark-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          📷 Ajouter une photo (optionnel)
        </button>

        <div className="gps-mark-actions">
          <button className="gps-mark-cancel" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="gps-mark-submit" onClick={handleSubmit} disabled={busy}>
            {busy ? '…' : '📍 Poser la marque'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
