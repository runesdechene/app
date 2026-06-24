import { useState, useRef } from 'react'
import { useCompanyStore } from '../../stores/companyStore'
import { uploadCompanyImage } from '../../lib/companyImageUpload'
import type { MyCompany } from '../../stores/companyStore'

// Palette sobre — tons naturels, ni criards ni pastel fade
const COLOR_PALETTE = [
  '#4A7C59', // vert forêt
  '#6B4E3D', // brun chêne
  '#2E5D7E', // bleu ardoise
  '#8B6914', // ocre doré
  '#7C4A6B', // prune
  '#4A6B7C', // bleu-gris
  '#7C6B4A', // sable
  '#4A4A7C', // indigo doux
  '#7C4A4A', // bordeaux
  '#3D6B5D', // sarcelle
]

const ERROR_MESSAGES: Record<string, string> = {
  name_taken: 'Ce nom est déjà utilisé.',
  name_too_long: 'Le nom est trop long (40 caractères max).',
  too_many_companies: 'Vous faites déjà partie de 2 Compagnies.',
  insufficient_crowns: 'Couronnes insuffisantes.',
  unknown: 'Une erreur est survenue.',
}

interface Props {
  userId: string
  /** Si fourni : mode édition (updateIdentity) */
  editCompany?: MyCompany
  onSuccess: () => void
  onCancel: () => void
}

export function CompanyCreateForm({ userId, editCompany, onSuccess, onCancel }: Props) {
  const create = useCompanyStore((s) => s.create)
  const updateIdentity = useCompanyStore((s) => s.updateIdentity)

  const [name, setName] = useState(editCompany?.name ?? '')
  const [color, setColor] = useState(editCompany?.color ?? COLOR_PALETTE[0])
  const [description, setDescription] = useState(editCompany?.description ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [costInfo, setCostInfo] = useState<{ cost?: number; balance?: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEdit = !!editCompany

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis.'); return }
    setSubmitting(true)
    setError(null)
    setCostInfo(null)

    let imageUrl: string | null = editCompany?.imageUrl ?? null

    if (isEdit) {
      // Upload image d'abord si sélectionnée
      if (file) {
        try {
          imageUrl = await uploadCompanyImage(editCompany.id, file)
        } catch {
          setError("Erreur lors du téléversement de l'image.")
          setSubmitting(false)
          return
        }
      }
      const result = await updateIdentity(userId, editCompany.id, {
        name: name.trim(),
        color,
        description: description.trim(),
        imageUrl,
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
      // Création : d'abord créer sans image, puis upload + updateIdentity
      const result = await create(userId, {
        name: name.trim(),
        color,
        description: description.trim(),
        imageUrl: null,
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
      // Upload image après création si fichier sélectionné
      if (file && result.companyId) {
        try {
          const url = await uploadCompanyImage(result.companyId, file)
          await updateIdentity(userId, result.companyId, {
            name: name.trim(),
            color,
            description: description.trim(),
            imageUrl: url,
          })
        } catch {
          // Image optionnelle — échec silencieux, la compagnie existe quand même
        }
      }
      onSuccess()
    }
    setSubmitting(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isEdit ? 'Modifier la Compagnie' : 'Fonder une Compagnie'}</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Nom */}
          <label style={styles.label}>
            Nom
            <input
              style={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Nom de la Compagnie"
              disabled={submitting}
              required
            />
          </label>

          {/* Mission / description */}
          <label style={styles.label}>
            Mission
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="En quelques mots, la raison d'être de cette Compagnie…"
              disabled={submitting}
              rows={3}
            />
          </label>

          {/* Palette couleur */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Couleur</legend>
            <div style={styles.palette}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    ...styles.colorBtn,
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: '3px',
                  }}
                  aria-label={`Couleur ${c}`}
                  title={c}
                />
              ))}
            </div>
            {/* Aperçu */}
            <div style={{ ...styles.colorPreview, backgroundColor: color }} aria-hidden />
          </fieldset>

          {/* Emblème */}
          <label style={styles.label}>
            Emblème (optionnel)
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
              style={styles.fileInput}
            />
          </label>

          {/* Coût (info générique ou après erreur) */}
          {!isEdit && !costInfo && (
            <p style={styles.costHint}>Fonder une Compagnie coûte des Couronnes 🪙</p>
          )}
          {costInfo && (
            <p style={styles.costDetail}>
              Coût : {costInfo.cost ?? '?'} 🪙 — Solde actuel : {costInfo.balance ?? '?'} 🪙
            </p>
          )}

          {/* Erreur */}
          {error && <p style={styles.errorMsg}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.btnCancel} disabled={submitting}>
              Annuler
            </button>
            <button
              type="submit"
              style={{ ...styles.btnPrimary, backgroundColor: color }}
              disabled={submitting}
            >
              {submitting ? 'En cours…' : isEdit ? 'Enregistrer' : 'Fonder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: '16px',
  },
  card: {
    background: 'var(--color-parchment, #F5E6D3)',
    borderRadius: '12px',
    padding: '24px',
    width: '100%', maxWidth: '420px',
    maxHeight: '90vh', overflowY: 'auto',
  },
  title: {
    margin: '0 0 20px',
    fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '20px',
    color: 'var(--color-ink, #4A3728)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  label: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    fontFamily: 'var(--font-body, sans-serif)',
    fontSize: '15px', color: 'var(--color-ink, #4A3728)',
  },
  input: {
    padding: '10px 12px', fontSize: '16px',
    border: '1px solid rgba(193,154,107,0.5)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--color-ink, #4A3728)',
    fontFamily: 'var(--font-body, sans-serif)',
    outline: 'none',
  },
  textarea: { resize: 'vertical', minHeight: '72px' },
  fieldset: { border: 'none', padding: 0, margin: 0 },
  legend: {
    fontSize: '15px', fontFamily: 'var(--font-body, sans-serif)',
    color: 'var(--color-ink, #4A3728)', marginBottom: '10px',
  },
  palette: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  colorBtn: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  colorPreview: {
    marginTop: '8px', height: '4px', borderRadius: '2px', opacity: 0.7,
  },
  fileInput: { fontSize: '15px', cursor: 'pointer' },
  costHint: {
    fontSize: '15px', color: 'var(--color-ink-light, #8d745e)',
    fontStyle: 'italic', margin: 0,
  },
  costDetail: {
    fontSize: '15px', color: 'var(--color-ink, #4A3728)',
    background: 'rgba(193,154,107,0.15)', borderRadius: '6px',
    padding: '8px 12px', margin: 0,
  },
  errorMsg: {
    fontSize: '15px', color: '#c0392b',
    background: 'rgba(192,57,43,0.08)',
    borderRadius: '6px', padding: '8px 12px', margin: 0,
  },
  actions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' },
  btnCancel: {
    padding: '10px 20px', borderRadius: '8px',
    border: '1px solid rgba(193,154,107,0.5)',
    background: 'transparent', cursor: 'pointer',
    fontSize: '16px', color: 'var(--color-ink, #4A3728)',
  },
  btnPrimary: {
    padding: '10px 20px', borderRadius: '8px',
    border: 'none', cursor: 'pointer',
    fontSize: '16px', color: '#fff', fontWeight: 600,
  },
}
