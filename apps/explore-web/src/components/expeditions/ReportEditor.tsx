import { useState } from 'react'
import {
  upsertExpeditionReport,
  uploadExpeditionMedia,
  deleteExpeditionMedia,
  getExpeditionMediaUrl,
} from '../../lib/expeditionsApi'
import type { ExpeditionReport } from '../../types/expedition'

interface Props {
  expeditionId: string
  /** Compte rendu existant (édition) ou null (création). */
  existingReport: ExpeditionReport | null
  onSaved: () => void
  onCancel: () => void
}

interface UploadedMedia {
  id: string
  storage_path: string
  kind: 'photo' | 'video'
}

/**
 * Editeur de compte rendu. Texte (1000 max) + médias (photos ≤10MB,
 * vidéos ≤50MB et ≤30s) + opt-in publication (cover photo).
 * +10 XP au premier enregistrement (via trigger SQL).
 */
export function ReportEditor({ expeditionId, existingReport, onSaved, onCancel }: Props) {
  const [text, setText] = useState(existingReport?.text_content ?? '')
  const [isPublic, setIsPublic] = useState(existingReport?.is_public ?? false)
  const [coverMediaId, setCoverMediaId] = useState<string | null>(existingReport?.cover_media_id ?? null)
  const [medias, setMedias] = useState<UploadedMedia[]>(
    () => (existingReport?.medias ?? []).map((m) => ({
      id: m.id, storage_path: m.storage_path, kind: m.kind,
    })),
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset

    const isVideo = file.type.startsWith('video/')
    const kind: 'photo' | 'video' = isVideo ? 'video' : 'photo'

    let durationSeconds: number | null = null
    if (isVideo) {
      durationSeconds = await readVideoDuration(file)
      if (durationSeconds > 30) {
        setError('Vidéo trop longue (30s max)')
        return
      }
    }

    setUploading(true)
    setError(null)
    const result = await uploadExpeditionMedia(expeditionId, file, kind, durationSeconds)
    setUploading(false)

    if (!result.success || !result.media_id || !result.storage_path) {
      setError(result.error || 'Échec de l\'upload')
      return
    }
    setMedias((prev) => [...prev, { id: result.media_id!, storage_path: result.storage_path!, kind }])
  }

  async function handleRemoveMedia(mediaId: string) {
    const result = await deleteExpeditionMedia(mediaId)
    if (!result.success) {
      setError(result.error || 'Suppression impossible')
      return
    }
    setMedias((prev) => prev.filter((m) => m.id !== mediaId))
    if (coverMediaId === mediaId) setCoverMediaId(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await upsertExpeditionReport({
      expedition_id: expeditionId,
      text_content: text.trim() || null,
      is_public: isPublic,
      cover_media_id: isPublic ? coverMediaId : null,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error || 'Enregistrement impossible')
      return
    }
    onSaved()
  }

  const photoMedias = medias.filter((m) => m.kind === 'photo')

  return (
    <div className="report-editor">
      <div className="report-editor-section">
        <label className="report-editor-label">Ton récit</label>
        <textarea
          className="report-editor-textarea"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Raconte la journée à ta façon. Privé par défaut."
        />
        <div className="report-editor-counter">{text.length} / 1000</div>
      </div>

      <div className="report-editor-section">
        <label className="report-editor-label">Photos &amp; vidéos</label>
        <div className="report-editor-uploads">
          {medias.map((m) => {
            const isCover = isPublic && coverMediaId === m.id
            return (
              <div
                key={m.id}
                className={`report-editor-tile is-${m.kind}${isCover ? ' is-cover' : ''}`}
                onClick={() => isPublic && m.kind === 'photo' && setCoverMediaId(m.id)}
                style={{ backgroundImage: `url(${getExpeditionMediaUrl(m.storage_path)})` }}
              >
                {m.kind === 'video' && <span className="report-editor-tile-play">▶</span>}
                <button
                  className="report-editor-tile-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemoveMedia(m.id) }}
                  aria-label="Supprimer"
                >×</button>
              </div>
            )
          })}
          <label className="report-editor-tile is-add">
            +
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              hidden
              disabled={uploading}
            />
          </label>
        </div>
        {uploading && <div className="report-editor-uploading">Upload en cours…</div>}
        {isPublic && photoMedias.length > 0 && !coverMediaId && (
          <div className="report-editor-hint">Choisis une photo de couverture (tap sur une photo) — c'est elle qui sera visible publiquement.</div>
        )}
      </div>

      <div className="report-editor-toggle" onClick={() => setIsPublic(!isPublic)}>
        <div>
          <div className="report-editor-toggle-title">Rendre public mon compte rendu</div>
          <div className="report-editor-toggle-help">Texte + photo de couverture visibles dans les Archives</div>
        </div>
        <div className={`report-editor-toggle-switch${isPublic ? '' : ' is-off'}`} />
      </div>

      {error && <div className="report-editor-error">{error}</div>}

      <div className="report-editor-actions">
        <button className="report-editor-secondary" onClick={onCancel}>Annuler</button>
        <button className="report-editor-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer mon compte rendu'}
        </button>
      </div>
      {!existingReport && (
        <div className="report-editor-xp-hint">+10 XP au premier enregistrement</div>
      )}
    </div>
  )
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve(video.duration)
      URL.revokeObjectURL(video.src)
    }
    video.onerror = () => resolve(0)
    video.src = URL.createObjectURL(file)
  })
}
