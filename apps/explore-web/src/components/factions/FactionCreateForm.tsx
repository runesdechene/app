import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { uploadFactionImage } from '../../lib/factionImageUpload'
import type { MyFaction } from '../../stores/factionGroupStore'
import './FactionCreateForm.css'

// Palette élargie — tons naturels + accents. + un color picker libre à côté.
const COLOR_PALETTE = [
  '#4A7C59', '#6B4E3D', '#2E5D7E', '#8B6914', '#7C4A6B',
  '#4A6B7C', '#7C6B4A', '#4A4A7C', '#7C4A4A', '#3D6B5D',
  '#A93D76', '#57B33D', '#3C56BE', '#C94436', '#2E8B57',
  '#7E3FA0', '#C97A1E', '#1E6F6F', '#9B2D2D', '#5D4037',
]

const ERROR_MESSAGES: Record<string, string> = {
  name_taken: 'Ce nom est déjà utilisé.',
  name_too_long: 'Le nom est trop long (40 caractères max).',
  name_required: 'Le nom est requis.',
  too_many: 'Tu fais déjà partie de 2 Compagnies.',
  insufficient_crowns: 'Couronnes insuffisantes.',
  not_chef: 'Seul le Chef peut modifier la Compagnie.',
  unknown: 'Une erreur est survenue.',
}

interface Props {
  userId: string
  /** Si fourni : mode édition (updateIdentity) */
  editFaction?: MyFaction
  /** Tags existants (mode édition) pour préremplir. */
  editTags?: string[]
  onSuccess: () => void
  onCancel: () => void
}

/** Fonder / éditer une Compagnie (mécanique = faction). */
export function FactionCreateForm({ userId, editFaction, editTags, onSuccess, onCancel }: Props) {
  const create = useFactionGroupStore((s) => s.create)
  const updateIdentity = useFactionGroupStore((s) => s.updateIdentity)

  const [name, setName] = useState(editFaction?.name ?? '')
  const [color, setColor] = useState(editFaction?.color ?? COLOR_PALETTE[0])
  const [description, setDescription] = useState(editFaction?.description ?? '')
  const [tags, setTags] = useState((editTags ?? []).join(', '))
  const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 6)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(editFaction?.imageUrl ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [costInfo, setCostInfo] = useState<{ cost?: number; balance?: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEdit = !!editFaction

  function pickFile(f: File | null) {
    setFile(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis.'); return }
    setSubmitting(true)
    setError(null)
    setCostInfo(null)

    let imageUrl: string | null = editFaction?.imageUrl ?? null

    if (isEdit) {
      if (file) {
        try {
          imageUrl = await uploadFactionImage(editFaction.id, file)
        } catch {
          setError("Erreur lors du téléversement de l'image.")
          setSubmitting(false)
          return
        }
      }
      const result = await updateIdentity(userId, editFaction.id, {
        name: name.trim(), color, description: description.trim(), imageUrl, tags: tagsArray,
      })
      if ('error' in result) {
        const errKey = String(result.error)
        setError(ERROR_MESSAGES[errKey] ?? ERROR_MESSAGES.unknown)
        if (result.cost !== undefined || result.balance !== undefined) {
          setCostInfo({ cost: result.cost as number | undefined, balance: result.balance as number | undefined })
        }
      } else {
        onSuccess()
      }
    } else {
      const result = await create(userId, {
        name: name.trim(), color, description: description.trim(), imageUrl: null, tags: tagsArray,
      })
      if ('error' in result) {
        const errKey = String(result.error)
        setError(ERROR_MESSAGES[errKey] ?? ERROR_MESSAGES.unknown)
        if (result.cost !== undefined || result.balance !== undefined) {
          setCostInfo({ cost: result.cost as number | undefined, balance: result.balance as number | undefined })
        }
        setSubmitting(false)
        return
      }
      if (file && result.factionId) {
        try {
          const url = await uploadFactionImage(result.factionId, file)
          await updateIdentity(userId, result.factionId, {
            name: name.trim(), color, description: description.trim(), imageUrl: url, tags: tagsArray,
          })
        } catch {
          // image optionnelle — échec silencieux, la Compagnie existe quand même
        }
      }
      onSuccess()
    }
    setSubmitting(false)
  }

  const form = (
    <div className="faction-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <form className="faction-form" onSubmit={handleSubmit}>
        <h2 className="faction-form-title">{isEdit ? "Modifier la Compagnie" : 'Fonder une Compagnie'}</h2>
        <p className="faction-form-sub">{isEdit ? 'Son identité reflète qui vous êtes.' : 'Rassemblez les vôtres sous une même bannière.'}</p>

        <div className="faction-form-body">
          <label className="faction-form-label">
            Nom
            <input
              className="faction-form-input" type="text" value={name}
              onChange={(e) => setName(e.target.value)} maxLength={40}
              placeholder="Nom de la Compagnie" disabled={submitting} required autoFocus
            />
          </label>

          <label className="faction-form-label">
            Mission
            <textarea
              className="faction-form-textarea" value={description}
              onChange={(e) => setDescription(e.target.value)} maxLength={500}
              placeholder="En quelques mots, la raison d'être de cette Compagnie…"
              disabled={submitting} rows={3}
            />
          </label>

          <label className="faction-form-label">
            Tags (mots-clés, séparés par des virgules)
            <input
              className="faction-form-input" type="text" value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Local, Convivial, Lyon, Compétitif…"
              disabled={submitting}
            />
          </label>
          {tagsArray.length > 0 && (
            <div className="faction-form-tags-preview">
              {tagsArray.map(t => <span key={t} className="faction-form-tag">{t}</span>)}
            </div>
          )}

          <div className="faction-form-label">
            Couleur
            <div className="faction-form-palette">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className="faction-form-color"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                  aria-label={`Couleur ${c}`} title={c}
                />
              ))}
              {/* Color picker libre (RGB) */}
              <label
                className="faction-form-color faction-form-color-picker"
                style={{
                  background: COLOR_PALETTE.includes(color) ? undefined : color,
                  outline: COLOR_PALETTE.includes(color) ? '3px solid transparent' : `3px solid ${color}`,
                  outlineOffset: '2px',
                }}
                title="Couleur personnalisée"
              >
                {COLOR_PALETTE.includes(color) && <span aria-hidden>🎨</span>}
                <input
                  type="color" value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>
          </div>

          <div className="faction-form-label">
            Emblème (optionnel)
            <div className="faction-form-emblem-row">
              {preview ? (
                <img className="faction-form-emblem-preview" src={preview} alt="" />
              ) : (
                <span className="faction-form-emblem-preview" style={{ background: color }}>
                  {name.trim().charAt(0).toUpperCase() || '?'}
                </span>
              )}
              <button
                type="button" className="faction-form-file-btn"
                onClick={() => fileRef.current?.click()} disabled={submitting}
              >
                📷 {file ? 'Changer l’image' : 'Choisir une image'}
                <span className="faction-form-file-name">{file ? file.name : 'PNG / JPG'}</span>
              </button>
              <input
                ref={fileRef} type="file" accept="image/*"
                className="faction-form-file-hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
              />
            </div>
          </div>

          {!isEdit && !costInfo && (
            <p className="faction-form-cost">Fonder une Compagnie coûte <b>200 🪙</b></p>
          )}
          {costInfo && (
            <p className="faction-form-cost">
              Coût : {costInfo.cost ?? '?'} 🪙 — Solde : {costInfo.balance ?? '?'} 🪙
            </p>
          )}
          {error && <p className="faction-form-error">{error}</p>}

          <div className="faction-form-actions">
            <button type="button" className="faction-form-cancel" onClick={onCancel} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="faction-form-submit" style={{ background: color }} disabled={submitting}>
              {submitting ? 'En cours…' : isEdit ? 'Enregistrer' : 'Fonder'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )

  return createPortal(form, document.body)
}
