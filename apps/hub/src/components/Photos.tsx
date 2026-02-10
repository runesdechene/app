import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PhotoStatus = 'pending' | 'approved_great' | 'approved_average' | 'rejected'
type SubmitterRole = 'client' | 'ambassadeur' | 'partenaire'

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']
const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))

interface SubmissionImage {
  id: string
  image_url: string
  sort_order: number
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
  consent_brand_usage: boolean
  status: PhotoStatus
  rejection_reason: string | null
  created_at: string
  hub_submission_images: SubmissionImage[]
}

const STATUS_LABELS: Record<PhotoStatus, string> = {
  pending: 'En attente',
  approved_great: 'Geniales',
  approved_average: 'Moyennes',
  rejected: 'Refusees'
}

const STATUS_COLORS: Record<PhotoStatus, string> = {
  pending: '#f59e0b',
  approved_great: '#22c55e',
  approved_average: '#3b82f6',
  rejected: '#ef4444'
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
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ images: SubmissionImage[], index: number } | null>(null)

  useEffect(() => {
    async function fetchSubmissions() {
      setLoading(true)
      const { data: subs } = await supabase.rpc('get_photo_submissions', {
        p_status: filter === 'all' ? null : filter
      })

      if (subs && subs.length > 0) {
        const subIds = subs.map((s: PhotoSubmission) => s.id)
        const { data: images } = await supabase.rpc('get_submission_images_batch', {
          p_submission_ids: subIds
        })

        const enriched = subs.map((s: PhotoSubmission) => ({
          ...s,
          hub_submission_images: (images || []).filter((img: SubmissionImage & { submission_id: string }) => img.submission_id === s.id)
        }))
        setSubmissions(enriched)
      } else {
        setSubmissions([])
      }
      setLoading(false)
    }

    fetchSubmissions()
  }, [filter])

  const filteredSubmissions = roleFilter === 'all'
    ? submissions
    : submissions.filter(s => s.submitter_role === roleFilter)

  const moderate = async (subId: string, status: PhotoStatus, reason?: string) => {
    const { error } = await supabase.rpc('moderate_submission', {
      p_submission_id: subId,
      p_status: status,
      p_rejection_reason: reason || null
    })

    if (!error) {
      if (filter !== 'all') {
        setSubmissions(prev => prev.filter(s => s.id !== subId))
      } else {
        setSubmissions(prev => prev.map(s =>
          s.id === subId ? { ...s, status, rejection_reason: reason || null } : s
        ))
      }
    }
    setRejectingId(null)
    setRejectReason('')
  }

  const deleteSubmission = async (subId: string) => {
    if (!window.confirm('Etes-vous sur de vouloir supprimer definitivement cette soumission ? Cette action est irreversible.')) return

    const { error } = await supabase.rpc('delete_photo_submission', {
      p_submission_id: subId
    })

    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== subId))
    }
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
          {(['pending', 'approved_great', 'approved_average', 'rejected', 'all'] as const).map(f => (
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
      </div>

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
                {sub.message && <p className="photo-caption">{sub.message}</p>}
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

              {sub.status === 'pending' && (
                <div className="photo-actions">
                  <button
                    className="btn-approve"
                    onClick={() => moderate(sub.id, 'approved_great')}
                  >
                    Geniale
                  </button>
                  <button
                    className="btn-approve-avg"
                    onClick={() => moderate(sub.id, 'approved_average')}
                  >
                    Moyenne
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => setRejectingId(sub.id)}
                  >
                    Refuser
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteSubmission(sub.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}

              {(sub.status === 'approved_great' || sub.status === 'approved_average') && (
                <div className="photo-actions">
                  <button
                    className="btn-reject"
                    onClick={() => moderate(sub.id, 'rejected', 'Retrait apres approbation')}
                  >
                    Retirer
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteSubmission(sub.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}

              {sub.status === 'rejected' && (
                <div className="photo-actions">
                  <button
                    className="btn-reject"
                    onClick={() => deleteSubmission(sub.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}

              {rejectingId === sub.id && (
                <div className="reject-form">
                  <input
                    type="text"
                    placeholder="Raison du rejet..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <div className="reject-actions">
                    <button onClick={() => moderate(sub.id, 'rejected', rejectReason)}>
                      Confirmer
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectReason('') }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {sub.rejection_reason && sub.status === 'rejected' && (
                <p className="rejection-reason">Raison : {sub.rejection_reason}</p>
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
