import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type ReviewStatus = 'pending' | 'approved' | 'archived'

type PurchaseStatus = 'owner' | 'planning' | 'no'

const PURCHASE_LABELS: Record<PurchaseStatus, string> = {
  owner: 'Possede du RdC',
  planning: 'Compte en acquerir',
  no: 'Pas interesse'
}

interface ReviewSubmission {
  id: string
  user_id: string
  submitter_name: string
  submitter_email: string
  location_name: string
  location_zip: string
  review_text: string
  rating: number
  purchase_status: PurchaseStatus | null
  consent_republish: boolean
  image_url: string | null
  status: ReviewStatus
  rejection_reason: string | null
  created_at: string
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'En attente',
  approved: 'Valides',
  archived: 'Archives'
}

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  archived: '#6366f1'
}

export function Reviews() {
  const [reviews, setReviews] = useState<ReviewSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending')

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true)
      try {
        const { data } = await supabase.rpc('get_review_submissions', {
          p_status: filter === 'all' ? null : filter
        })
        setReviews(data || [])
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [filter])

  const moderate = async (reviewId: string, status: ReviewStatus) => {
    const { error } = await supabase.rpc('moderate_review', {
      p_review_id: reviewId,
      p_status: status,
      p_rejection_reason: null
    })

    if (!error) {
      if (filter !== 'all') {
        setReviews(prev => prev.filter(r => r.id !== reviewId))
      } else {
        setReviews(prev => prev.map(r =>
          r.id === reviewId ? { ...r, status } : r
        ))
      }
    }
  }

  const deleteReview = async (reviewId: string) => {
    if (!window.confirm('Etes-vous sur de vouloir supprimer definitivement cet avis ? Cette action est irreversible.')) return

    const { error } = await supabase.rpc('delete_review_submission', {
      p_review_id: reviewId
    })

    if (!error) {
      setReviews(prev => prev.filter(r => r.id !== reviewId))
    }
  }

  const renderStars = (rating: number) => {
    return (
      <span className="review-stars">
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} className={s <= rating ? 'star active' : 'star'}>★</span>
        ))}
      </span>
    )
  }

  return (
    <div className="reviews">
      <div className="page-header">
        <h1>Soumissions avis</h1>
        <a href="/soumettre-avis" target="_blank" rel="noopener noreferrer" className="form-link">
          Ouvrir le formulaire avis ↗
        </a>
        <div className="filter-tabs">
          {(['pending', 'approved', 'archived', 'all'] as const).map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tous' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : reviews.length === 0 ? (
        <div className="empty">Aucun avis {filter !== 'all' ? STATUS_LABELS[filter].toLowerCase() : ''}</div>
      ) : (
        <div className="reviews-list">
          {reviews.map(review => (
            <div key={review.id} className={`review-card ${review.status}`}>
              <div className="review-header">
                <div className="review-author">
                  <span className="review-name">{review.submitter_name}</span>
                  <span className="review-email">{review.submitter_email}</span>
                </div>
                <div className="review-rating-badge">
                  {renderStars(review.rating)}
                </div>
              </div>

              <div className="review-location">
                {review.location_name} ({review.location_zip})
              </div>

              {review.image_url && (
                <div className="review-image">
                  <img src={review.image_url} alt="" />
                </div>
              )}

              <p className="review-text">{review.review_text}</p>

              <div className="review-meta">
                <span className="review-date">
                  {new Date(review.created_at).toLocaleDateString('fr-FR')}
                </span>
                <span
                  className="status-badge"
                  style={{ backgroundColor: STATUS_COLORS[review.status] }}
                >
                  {STATUS_LABELS[review.status]}
                </span>
                {review.purchase_status && (
                  <span className="purchase-badge">{PURCHASE_LABELS[review.purchase_status]}</span>
                )}
                {review.consent_republish && (
                  <span className="consent-badge">Republication OK</span>
                )}
              </div>

              {review.status === 'pending' && (
                <div className="photo-actions">
                  <button
                    className="btn-approve"
                    onClick={() => moderate(review.id, 'approved')}
                  >
                    Valider
                  </button>
                  <button
                    className="btn-approve-avg"
                    onClick={() => moderate(review.id, 'archived')}
                  >
                    Archiver
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteReview(review.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}

              {review.status === 'approved' && (
                <div className="photo-actions">
                  <button
                    className="btn-approve-avg"
                    onClick={() => moderate(review.id, 'archived')}
                  >
                    Archiver
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteReview(review.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}

              {review.status === 'archived' && (
                <div className="photo-actions">
                  <button
                    className="btn-approve"
                    onClick={() => moderate(review.id, 'approved')}
                  >
                    Valider
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => deleteReview(review.id)}
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
