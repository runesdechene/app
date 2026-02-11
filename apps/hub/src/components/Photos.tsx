import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PhotoStatus = 'pending' | 'approved' | 'archived'
type SubmitterRole = 'client' | 'ambassadeur' | 'partenaire'

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']
const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))

interface SubmissionImage {
  id: string
  image_url: string
  sort_order: number
}

interface PhotoTag {
  id: string
  name: string
}

interface PhotoSubmission {
  id: string
  user_id: string
  submitter_name: string
  submitter_email: string
  submitter_instagram: string | null
  submitter_role: SubmitterRole | null
  location_name: string | null
  location_zip: string | null
  message: string | null
  product_size: string | null
  model_height_cm: number | null
  model_shoulder_width_cm: number | null
  product_worn: string | null
  consent_brand_usage: boolean
  status: PhotoStatus
  created_at: string
  hub_submission_images: SubmissionImage[]
  tags: PhotoTag[]
}

const STATUS_LABELS: Record<PhotoStatus, string> = {
  pending: 'En attente',
  approved: 'Validees',
  archived: 'Archivees'
}

const STATUS_COLORS: Record<PhotoStatus, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  archived: '#6b7280'
}

const ROLE_LABELS: Record<SubmitterRole, string> = {
  client: 'Client',
  ambassadeur: 'Ambassadeur',
  partenaire: 'Partenaire'
}

const ROLE_COLORS: Record<SubmitterRole, string> = {
  client: '#6366f1',
  ambassadeur: '#f59e0b',
  partenaire: '#06b6d4'
}

export function Photos() {
  const [submissions, setSubmissions] = useState<PhotoSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PhotoStatus | 'all'>('pending')
  const [roleFilter, setRoleFilter] = useState<SubmitterRole | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ images: SubmissionImage[], index: number } | null>(null)

  // Tags state
  const [allTags, setAllTags] = useState<PhotoTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [showTagManager, setShowTagManager] = useState(false)
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null)

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')

  // Product worn editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingProductText, setEditingProductText] = useState('')

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase.rpc('get_photo_tags')
      if (data) setAllTags(data)
    }
    fetchTags()
  }, [])

  // Fetch submissions
  useEffect(() => {
    async function fetchSubmissions() {
      setLoading(true)
      const { data: subs } = await supabase.rpc('get_photo_submissions', {
        p_status: filter === 'all' ? null : filter
      })

      if (subs && subs.length > 0) {
        const subIds = subs.map((s: PhotoSubmission) => s.id)

        const [{ data: images }, { data: tagLinks }] = await Promise.all([
          supabase.rpc('get_submission_images_batch', { p_submission_ids: subIds }),
          supabase.rpc('get_submission_tags_batch', { p_submission_ids: subIds })
        ])

        const enriched = subs.map((s: PhotoSubmission) => ({
          ...s,
          hub_submission_images: (images || []).filter((img: SubmissionImage & { submission_id: string }) => img.submission_id === s.id),
          tags: (tagLinks || [])
            .filter((t: { submission_id: string }) => t.submission_id === s.id)
            .map((t: { tag_id: string; tag_name: string }) => ({ id: t.tag_id, name: t.tag_name }))
        }))
        setSubmissions(enriched)
      } else {
        setSubmissions([])
      }
      setLoading(false)
    }

    fetchSubmissions()
  }, [filter])

  const filteredSubmissions = submissions
    .filter(s => roleFilter === 'all' || s.submitter_role === roleFilter)
    .filter(s => tagFilter === 'all' || s.tags.some(t => t.id === tagFilter))

  const moderate = async (subId: string, status: PhotoStatus) => {
    const { error } = await supabase.rpc('moderate_submission', {
      p_submission_id: subId,
      p_status: status
    })

    if (!error) {
      if (filter !== 'all') {
        setSubmissions(prev => prev.filter(s => s.id !== subId))
      } else {
        setSubmissions(prev => prev.map(s =>
          s.id === subId ? { ...s, status } : s
        ))
      }
    }
  }

  const deleteSubmission = async (subId: string) => {
    if (!window.confirm('Supprimer definitivement cette soumission ?')) return

    const { error } = await supabase.rpc('delete_photo_submission', {
      p_submission_id: subId
    })

    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== subId))
    }
  }

  // Tag management
  const createTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const { data } = await supabase.rpc('create_photo_tag', { p_name: name })
    if (data) {
      setAllTags(prev => [...prev, { id: data, name: name.toLowerCase() }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
    }
  }

  const deleteTag = async (tagId: string) => {
    if (!window.confirm('Supprimer ce tag ? Il sera retire de toutes les photos.')) return
    const { error } = await supabase.rpc('delete_photo_tag', { p_tag_id: tagId })
    if (!error) {
      setAllTags(prev => prev.filter(t => t.id !== tagId))
      setSubmissions(prev => prev.map(s => ({
        ...s,
        tags: s.tags.filter(t => t.id !== tagId)
      })))
    }
  }

  const addTagToSubmission = async (subId: string, tagId: string) => {
    const { error } = await supabase.rpc('add_tag_to_submission', {
      p_submission_id: subId,
      p_tag_id: tagId
    })
    if (!error) {
      const tag = allTags.find(t => t.id === tagId)
      if (tag) {
        setSubmissions(prev => prev.map(s =>
          s.id === subId ? { ...s, tags: [...s.tags, tag] } : s
        ))
      }
    }
  }

  const removeTagFromSubmission = async (subId: string, tagId: string) => {
    const { error } = await supabase.rpc('remove_tag_from_submission', {
      p_submission_id: subId,
      p_tag_id: tagId
    })
    if (!error) {
      setSubmissions(prev => prev.map(s =>
        s.id === subId ? { ...s, tags: s.tags.filter(t => t.id !== tagId) } : s
      ))
    }
  }

  const startEditingMessage = (subId: string, currentMessage: string | null) => {
    setEditingMessageId(subId)
    setEditingMessageText(currentMessage || '')
  }

  const saveMessage = async (subId: string) => {
    const newMessage = editingMessageText.trim() || null
    const { error } = await supabase.rpc('update_submission_message', {
      p_submission_id: subId,
      p_message: newMessage
    })
    if (!error) {
      setSubmissions(prev => prev.map(s =>
        s.id === subId ? { ...s, message: newMessage } : s
      ))
    }
    setEditingMessageId(null)
    setEditingMessageText('')
  }

  const startEditingProduct = (subId: string, currentProduct: string | null) => {
    setEditingProductId(subId)
    setEditingProductText(currentProduct || '')
  }

  const saveProductWorn = async (subId: string) => {
    const newProduct = editingProductText.trim() || null
    const { error } = await supabase.rpc('update_submission_product_worn', {
      p_submission_id: subId,
      p_product_worn: newProduct
    })
    if (!error) {
      setSubmissions(prev => prev.map(s =>
        s.id === subId ? { ...s, product_worn: newProduct } : s
      ))
    }
    setEditingProductId(null)
    setEditingProductText('')
  }

  const openLightbox = (images: SubmissionImage[], index: number) => {
    setLightbox({ images: [...images].sort((a, b) => a.sort_order - b.sort_order), index })
  }

  const closeLightbox = () => setLightbox(null)

  const lightboxPrev = () => {
    if (!lightbox) return
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length })
  }

  const lightboxNext = () => {
    if (!lightbox) return
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length })
  }

  return (
    <div className="photos">
      <div className="page-header">
        <h1>Soumissions photos</h1>
        <a href="/soumettre-contenu" target="_blank" rel="noopener noreferrer" className="form-link">
          Ouvrir le formulaire photos ↗
        </a>
        <div className="filter-tabs">
          {(['pending', 'approved', 'archived', 'all'] as const).map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="filter-tabs role-filters">
          {(['all', 'client', 'ambassadeur', 'partenaire'] as const).map(r => (
            <button
              key={r}
              className={`filter-tab ${roleFilter === r ? 'active' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all' ? 'Tous' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="filter-tabs tag-filters">
            <button
              className={`filter-tab ${tagFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTagFilter('all')}
            >
              Tous tags
            </button>
            {allTags.map(tag => (
              <button
                key={tag.id}
                className={`filter-tab tag-filter-tab ${tagFilter === tag.id ? 'active' : ''}`}
                onClick={() => setTagFilter(tag.id)}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}
        <button
          className="btn-tag-manager"
          onClick={() => setShowTagManager(!showTagManager)}
        >
          {showTagManager ? 'Fermer' : 'Gerer les tags'}
        </button>
      </div>

      {/* Tag Manager */}
      {showTagManager && (
        <div className="tag-manager">
          <h3>Tags disponibles</h3>
          <div className="tag-manager-list">
            {allTags.map(tag => (
              <div key={tag.id} className="tag-manager-item">
                <span className="tag-pill">#{tag.name}</span>
                <button className="tag-delete-btn" onClick={() => deleteTag(tag.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="tag-create-form">
            <input
              type="text"
              placeholder="Nouveau tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTag()}
            />
            <button onClick={createTag} disabled={!newTagName.trim()}>Creer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="empty">Aucune soumission {filter !== 'all' ? STATUS_LABELS[filter].toLowerCase() : ''}{roleFilter !== 'all' ? ` (${ROLE_LABELS[roleFilter]})` : ''}</div>
      ) : (
        <div className="photos-grid">
          {filteredSubmissions.map(sub => (
            <div key={sub.id} className={`photo-card ${sub.status}`}>
              {/* First image as cover */}
              {sub.hub_submission_images?.length > 0 && (
                <div className="photo-image" onClick={() => openLightbox(sub.hub_submission_images, 0)} style={{ cursor: 'pointer' }}>
                  {(() => {
                    const first = sub.hub_submission_images.sort((a, b) => a.sort_order - b.sort_order)[0]
                    return isVideoUrl(first.image_url)
                      ? <video src={first.image_url} muted playsInline />
                      : <img src={first.image_url} alt={sub.message || 'Photo communautaire'} />
                  })()}
                  {sub.hub_submission_images.length > 1 && (
                    <span className="photo-count">{sub.hub_submission_images.length} fichiers</span>
                  )}
                </div>
              )}

              <div className="photo-info">
                <div className="photo-name-row">
                  <span className="photo-name">{sub.submitter_name}</span>
                  {sub.submitter_role && (
                    <span
                      className="role-badge"
                      style={{ backgroundColor: ROLE_COLORS[sub.submitter_role] }}
                    >
                      {ROLE_LABELS[sub.submitter_role]}
                    </span>
                  )}
                </div>
                <span className="photo-email">{sub.submitter_email}</span>
                {sub.submitter_instagram && (
                  <span className="photo-instagram">{sub.submitter_instagram}</span>
                )}
                {(sub.location_name || sub.location_zip) && (
                  <span className="photo-location">
                    {[sub.location_name, sub.location_zip].filter(Boolean).join(' — ')}
                  </span>
                )}
                {(sub.product_size || sub.model_height_cm || sub.model_shoulder_width_cm) && (
                  <div className="photo-sizing">
                    {sub.product_size && <span className="sizing-badge">Taille : {sub.product_size}</span>}
                    {sub.model_height_cm && <span className="sizing-badge">Hauteur : {sub.model_height_cm} cm</span>}
                    {sub.model_shoulder_width_cm && <span className="sizing-badge">Epaules : {sub.model_shoulder_width_cm} cm</span>}
                  </div>
                )}
                {editingMessageId === sub.id ? (
                  <div className="message-edit">
                    <textarea
                      value={editingMessageText}
                      onChange={(e) => setEditingMessageText(e.target.value)}
                      rows={3}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="message-edit-actions">
                      <button className="btn-approve" onClick={() => saveMessage(sub.id)}>Enregistrer</button>
                      <button className="btn-archive" onClick={() => { setEditingMessageId(null); setEditingMessageText('') }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <p className="photo-caption" onClick={() => startEditingMessage(sub.id, sub.message)} title="Cliquer pour modifier">
                    {sub.message || <span className="photo-caption-empty">Ajouter un message...</span>}
                  </p>
                )}

                {/* Product worn */}
                {editingProductId === sub.id ? (
                  <div className="message-edit">
                    <input
                      type="text"
                      value={editingProductText}
                      onChange={(e) => setEditingProductText(e.target.value)}
                      placeholder="Ref. produit (ex: VESTE-LAINE-001)"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') saveProductWorn(sub.id); if (e.key === 'Escape') { setEditingProductId(null); setEditingProductText('') } }}
                    />
                    <div className="message-edit-actions">
                      <button className="btn-approve" onClick={() => saveProductWorn(sub.id)}>OK</button>
                      <button className="btn-archive" onClick={() => { setEditingProductId(null); setEditingProductText('') }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <span className="product-worn-badge" onClick={() => startEditingProduct(sub.id, sub.product_worn)} title="Cliquer pour modifier le produit porté">
                    {sub.product_worn ? `🏷 ${sub.product_worn}` : <span className="photo-caption-empty">+ Produit porté</span>}
                  </span>
                )}

                {/* Tags on card */}
                <div className="photo-tags">
                  {sub.tags.map(tag => (
                    <span key={tag.id} className="tag-pill" onClick={() => removeTagFromSubmission(sub.id, tag.id)} title="Cliquer pour retirer">
                      #{tag.name} ✕
                    </span>
                  ))}
                  <button
                    className="tag-add-btn"
                    onClick={() => setTagDropdownId(tagDropdownId === sub.id ? null : sub.id)}
                  >
                    + tag
                  </button>
                  {tagDropdownId === sub.id && (
                    <div className="tag-dropdown">
                      {allTags
                        .filter(t => !sub.tags.some(st => st.id === t.id))
                        .map(tag => (
                          <button
                            key={tag.id}
                            className="tag-dropdown-item"
                            onClick={() => {
                              addTagToSubmission(sub.id, tag.id)
                              setTagDropdownId(null)
                            }}
                          >
                            #{tag.name}
                          </button>
                        ))}
                      {allTags.filter(t => !sub.tags.some(st => st.id === t.id)).length === 0 && (
                        <span className="tag-dropdown-empty">Aucun tag disponible</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="photo-meta">
                  <span className="photo-date">
                    {new Date(sub.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: STATUS_COLORS[sub.status] }}
                  >
                    {STATUS_LABELS[sub.status]}
                  </span>
                  {sub.consent_brand_usage && (
                    <span className="consent-badge">Diffusion OK</span>
                  )}
                </div>
              </div>

              {/* Expanded images */}
              {expandedId === sub.id && sub.hub_submission_images?.length > 1 && (
                <div className="expanded-images">
                  {sub.hub_submission_images
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((img, idx) => (
                      isVideoUrl(img.image_url)
                        ? <video key={img.id} src={img.image_url} muted playsInline onClick={() => openLightbox(sub.hub_submission_images, idx)} style={{ cursor: 'pointer' }} />
                        : <img key={img.id} src={img.image_url} alt="" onClick={() => openLightbox(sub.hub_submission_images, idx)} style={{ cursor: 'pointer' }} />
                    ))}
                </div>
              )}

              {sub.hub_submission_images?.length > 1 && (
                <button
                  className="expand-btn"
                  onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                >
                  {expandedId === sub.id ? 'Masquer' : `Voir les ${sub.hub_submission_images.length} photos`}
                </button>
              )}

              {/* Actions by status */}
              {sub.status === 'pending' && (
                <div className="photo-actions">
                  <button className="btn-approve" onClick={() => moderate(sub.id, 'approved')}>
                    Valider
                  </button>
                  <button className="btn-archive" onClick={() => moderate(sub.id, 'archived')}>
                    Archiver
                  </button>
                  <button className="btn-reject" onClick={() => deleteSubmission(sub.id)}>
                    Supprimer
                  </button>
                </div>
              )}

              {sub.status === 'approved' && (
                <div className="photo-actions">
                  <button className="btn-archive" onClick={() => moderate(sub.id, 'archived')}>
                    Archiver
                  </button>
                  <button className="btn-reject" onClick={() => deleteSubmission(sub.id)}>
                    Supprimer
                  </button>
                </div>
              )}

              {sub.status === 'archived' && (
                <div className="photo-actions">
                  <button className="btn-approve" onClick={() => moderate(sub.id, 'approved')}>
                    Restaurer
                  </button>
                  <button className="btn-reject" onClick={() => deleteSubmission(sub.id)}>
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>✕</button>
            {lightbox.images.length > 1 && (
              <button className="lightbox-nav lightbox-prev" onClick={lightboxPrev}>‹</button>
            )}
            {isVideoUrl(lightbox.images[lightbox.index].image_url)
              ? <video src={lightbox.images[lightbox.index].image_url} controls autoPlay playsInline />
              : <img src={lightbox.images[lightbox.index].image_url} alt="" />
            }
            {lightbox.images.length > 1 && (
              <button className="lightbox-nav lightbox-next" onClick={lightboxNext}>›</button>
            )}
            {lightbox.images.length > 1 && (
              <span className="lightbox-counter">{lightbox.index + 1} / {lightbox.images.length}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
