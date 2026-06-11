import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import './EditPlaceTagsModal.css'

interface Tag {
  id: string
  title: string
  color: string
  background: string
  icon: string | null
}

interface Props {
  placeId: string
  /** Tags actuels du lieu, dans l'ordre (le 1er = principal). */
  currentTagIds: string[]
  onClose: () => void
  onSaved: () => void
}

const MAX_TAGS = 3

/**
 * Modale d'édition des tags d'un lieu (1 à 3, ordonnés ; le 1er = principal).
 * Réservée — côté serveur — à l'ajouteur / aux personnes venues sur place / aux
 * veilleurs (RPC set_place_tags, gate _can_edit_place_meta).
 */
export function EditPlaceTagsModal({ placeId, currentTagIds, onClose, onSaved }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<string[]>(currentTagIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('tags').select('id, title, color, background, icon').order('order')
      .then(({ data }) => { if (data) setTags(data as Tag[]) })
  }, [])

  function toggle(tagId: string) {
    setError(null)
    setSelected(prev => {
      if (prev.includes(tagId)) return prev.filter(id => id !== tagId)
      if (prev.length >= MAX_TAGS) return prev
      return [...prev, tagId]
    })
  }

  async function save() {
    if (selected.length === 0) { setError('Choisis au moins un type de lieu.'); return }
    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('set_place_tags', {
      p_place_id: placeId,
      p_tag_ids: selected,
    })
    const result = data as { success?: boolean; error?: string } | null
    if (!rpcError && result?.success) {
      onSaved()
      onClose()
    } else {
      setError(result?.error === 'not_allowed'
        ? "Tu n'as pas le droit de modifier ce lieu."
        : 'Échec de l\'enregistrement. Réessaie.')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="edit-tags-overlay" onClick={onClose}>
      <div className="edit-tags-modal" onClick={e => e.stopPropagation()}>
        <button className="edit-tags-close" onClick={onClose} aria-label="Fermer">✕</button>
        <h3 className="edit-tags-title">Type de lieu</h3>
        <p className="edit-tags-sub">Jusqu'à {MAX_TAGS} — le 1<sup>er</sup> est le principal.</p>

        <div className="edit-tags-grid">
          {tags.map(tag => {
            const orderIndex = selected.indexOf(tag.id)
            const isSelected = orderIndex !== -1
            return (
              <button
                key={tag.id}
                className={`edit-tags-pill${isSelected ? ' selected' : ''}`}
                style={{ color: tag.color, background: tag.background }}
                onClick={() => toggle(tag.id)}
              >
                {isSelected && <span className="edit-tags-order">{orderIndex + 1}</span>}
                {tag.icon && (
                  <span
                    className="edit-tags-icon"
                    style={{ WebkitMaskImage: `url(${tag.icon})`, maskImage: `url(${tag.icon})` }}
                  />
                )}
                {tag.title}
              </button>
            )
          })}
        </div>

        {error && <p className="edit-tags-error">{error}</p>}

        <div className="edit-tags-actions">
          <button className="edit-tags-cancel" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="edit-tags-save" onClick={save} disabled={saving || selected.length === 0}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
