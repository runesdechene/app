import { useEffect, useState } from 'react'
import { usePlace } from '../../hooks/usePlace'
import type { PlaceDetail } from '../../hooks/usePlace'
import { useMapStore } from '../../stores/mapStore'
import { supabase } from '../../lib/supabase'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
}

interface TagOption {
  id: string
  title: string
  color: string
  background: string
}

export function PlacePanel({ placeId, onClose }: PlacePanelProps) {
  const { place, loading, error } = usePlace(placeId)
  const isOpen = placeId !== null

  return (
    <>
      {isOpen && <div className="place-panel-backdrop" />}

      <div className={`place-panel ${isOpen ? 'place-panel-open' : ''}`}>
        {loading && (
          <div className="place-panel-loading">
            <p>Chargement...</p>
          </div>
        )}

        {error && (
          <div className="place-panel-error">
            <p>{error}</p>
          </div>
        )}

        {place && !loading && (
          <PlaceContent key={place.id} place={place} onClose={onClose} />
        )}
      </div>
    </>
  )
}

function PlaceContent({ place, onClose }: { place: PlaceDetail; onClose: () => void }) {
  const [imageIndex, setImageIndex] = useState(0)
  const [textExpanded, setTextExpanded] = useState(false)
  const images = place.images || []
  const TEXT_LIMIT = 300

  const prevImage = () => setImageIndex(i => (i - 1 + images.length) % images.length)
  const nextImage = () => setImageIndex(i => (i + 1) % images.length)

  return (
    <>
      {/* Header */}
      <div className="place-panel-header">
        <button onClick={onClose} className="place-panel-close" aria-label="Fermer">
          &#10005;
        </button>
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="place-panel-gallery">
          <img
            src={images[imageIndex].url}
            alt={place.title}
            className="place-panel-image"
          />
          {images.length > 1 && (
            <>
              <button className="gallery-nav gallery-prev" onClick={prevImage}>
                &#8249;
              </button>
              <button className="gallery-nav gallery-next" onClick={nextImage}>
                &#8250;
              </button>
              <span className="gallery-counter">
                {imageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* Body */}
      <div className="place-panel-body">
        <h1 className="place-panel-title">{place.title}</h1>

        {place.author && (
          <p className="place-panel-author">
            Par {place.author.lastName}
          </p>
        )}

        {/* Stats */}
        <div className="place-panel-stats">
          <span>{place.metrics.views} vues</span>
          <span>{place.metrics.likes} likes</span>
          <span>{place.metrics.explored} explorations</span>
          {place.metrics.note !== null && (
            <span>{place.metrics.note.toFixed(1)}/5</span>
          )}
        </div>

        {/* Tags */}
        {place.tags.length > 0 && (
          <div className="place-panel-tags">
            {place.tags.map(tag => (
              <span
                key={tag.id}
                className="place-tag"
                style={{
                  backgroundColor: tag.background,
                  color: tag.color,
                }}
              >
                {tag.icon && (
                  <span
                    className="place-tag-icon"
                    style={{
                      WebkitMaskImage: `url(${tag.icon})`,
                      maskImage: `url(${tag.icon})`,
                    }}
                  />
                )}
                {tag.title}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {place.text && (
          <div className="place-panel-description">
            <p>
              {!textExpanded && place.text.length > TEXT_LIMIT
                ? place.text.slice(0, TEXT_LIMIT) + '...'
                : place.text}
            </p>
            {place.text.length > TEXT_LIMIT && (
              <button
                className="place-panel-readmore"
                onClick={() => setTextExpanded(e => !e)}
              >
                {textExpanded ? 'Réduire' : 'Lire la suite'}
              </button>
            )}
          </div>
        )}

        {/* Address */}
        {place.address && (
          <p className="place-panel-address">{place.address}</p>
        )}

        {/* Test controls */}
        <TestControls
          placeId={place.id}
          currentScore={
            place.metrics.likes
            + Math.round(place.metrics.views * 0.1)
            + place.metrics.explored * 2
          }
        />
      </div>
    </>
  )
}

// --- Contrôles de test pour les territoires ---

function TestControls({ placeId, currentScore }: { placeId: string; currentScore: number }) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const override = useMapStore(s => s.placeOverrides.get(placeId))
  const [tags, setTags] = useState<TagOption[]>([])

  const score = override?.score ?? currentScore

  useEffect(() => {
    supabase
      .from('tags')
      .select('id, title, color, background')
      .order('title')
      .then(({ data }) => {
        if (data) setTags(data as TagOption[])
      })
  }, [])

  return (
    <div style={{
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
      border: '1px dashed var(--color-ink, #4A3728)',
      opacity: 0.8,
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        Test territoires
      </p>

      {/* Tag selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, minWidth: 50 }}>Faction</span>
        <select
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid var(--color-ink, #4A3728)',
            background: 'var(--color-parchment, #F5E6D3)',
            color: 'var(--color-ink, #4A3728)',
          }}
          value={override?.tagTitle ?? ''}
          onChange={(e) => {
            if (!e.target.value) return
            const tag = tags.find(t => t.title === e.target.value)
            if (tag) {
              setPlaceOverride(placeId, { tagTitle: tag.title, tagColor: tag.color })
            }
          }}
        >
          <option value="">Original</option>
          {tags.map(t => (
            <option key={t.id} value={t.title}>{t.title}</option>
          ))}
        </select>
      </div>

      {/* Score control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, minWidth: 50 }}>Score</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            style={btnStyle}
            onClick={() => setPlaceOverride(placeId, { score: Math.max(0, score - 1) })}
          >
            -
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 30, textAlign: 'center' }}>
            {score}
          </span>
          <button
            style={btnStyle}
            onClick={() => setPlaceOverride(placeId, { score: score + 1 })}
          >
            +
          </button>
          <button
            style={{ ...btnStyle, width: 'auto', padding: '2px 8px' }}
            onClick={() => setPlaceOverride(placeId, { score: score + 10 })}
          >
            +10
          </button>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 4,
  border: '1px solid var(--color-ink, #4A3728)',
  background: 'var(--color-parchment, #F5E6D3)',
  color: 'var(--color-ink, #4A3728)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
