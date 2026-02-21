import { useEffect, useState } from 'react'
import { usePlace } from '../../hooks/usePlace'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
  userEmail: string | null
}

interface UserFaction {
  userId: string
  factionId: string
  factionTitle: string
  factionColor: string
  factionPattern: string
}

export function PlacePanel({ placeId, onClose, userEmail }: PlacePanelProps) {
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
          <PlaceContent key={place.id} place={place} onClose={onClose} userEmail={userEmail} />
        )}
      </div>
    </>
  )
}

function PlaceContent({ place, onClose, userEmail }: { place: PlaceDetail; onClose: () => void; userEmail: string | null }) {
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

        {/* Claim badge */}
        {place.claim && (
          <div
            className="place-claim-badge"
            style={{ borderColor: place.claim.factionColor }}
          >
            <span
              className="place-claim-dot"
              style={{ backgroundColor: place.claim.factionColor }}
            />
            Revendiqué par {place.claim.factionTitle}
          </div>
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

        {/* Test : slider score / influence */}
        <ScoreSlider placeId={place.id} baseScore={place.metrics.likes + place.metrics.explored * 2} />

        {/* Claim button */}
        {userEmail && (
          <ClaimButton placeId={place.id} userEmail={userEmail} currentClaim={place.claim} />
        )}
      </div>
    </>
  )
}

// --- Bouton Revendiquer ---

function ClaimButton({
  placeId,
  userEmail,
  currentClaim,
}: {
  placeId: string
  userEmail: string
  currentClaim: PlaceDetail['claim']
}) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const [userFaction, setUserFaction] = useState<UserFaction | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [loadingFaction, setLoadingFaction] = useState(true)

  useEffect(() => {
    async function fetchUserFaction() {
      setLoadingFaction(true)

      const { data: user } = await supabase
        .from('users')
        .select('id, faction_id')
        .eq('email_address', userEmail)
        .single()

      if (!user?.faction_id) {
        setLoadingFaction(false)
        return
      }

      const { data: faction } = await supabase
        .from('factions')
        .select('id, title, color, pattern')
        .eq('id', user.faction_id)
        .single()

      if (faction) {
        setUserFaction({
          userId: user.id,
          factionId: faction.id,
          factionTitle: faction.title,
          factionColor: faction.color,
          factionPattern: faction.pattern ?? '',
        })
      }

      setLoadingFaction(false)
    }

    fetchUserFaction()
  }, [userEmail])

  if (loadingFaction || !userFaction) return null

  // Déjà revendiqué par la même faction
  if (currentClaim?.factionId === userFaction.factionId && !claimed) {
    return (
      <div className="claim-section claim-owned">
        <span
          className="place-claim-dot"
          style={{ backgroundColor: userFaction.factionColor }}
        />
        Votre territoire
      </div>
    )
  }

  if (claimed) {
    return (
      <div className="claim-section claim-success">
        Revendiqué pour {userFaction.factionTitle} !
      </div>
    )
  }

  async function handleClaim() {
    if (!userFaction) return
    setClaiming(true)

    const { data } = await supabase.rpc('claim_place', {
      p_user_id: userFaction.userId,
      p_place_id: placeId,
    })

    if (data?.success) {
      setClaimed(true)
      setPlaceOverride(placeId, {
        claimed: true,
        factionId: userFaction.factionId,
        tagColor: userFaction.factionColor,
        factionPattern: userFaction.factionPattern,
      })
    }

    setClaiming(false)
  }

  return (
    <button
      className="claim-btn"
      style={{
        borderColor: userFaction.factionColor,
        color: userFaction.factionColor,
      }}
      onClick={handleClaim}
      disabled={claiming}
    >
      {claiming
        ? 'Revendication...'
        : `Revendiquer pour ${userFaction.factionTitle}`}
    </button>
  )
}

// --- Test : slider score ---

function ScoreSlider({ placeId, baseScore }: { placeId: string; baseScore: number }) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const override = useMapStore(s => s.placeOverrides.get(placeId))
  const score = override?.score ?? baseScore

  return (
    <div style={{ margin: '12px 0', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.7 }}>
        Score (influence) : <strong>{score}</strong>
        <input
          type="range"
          min={0}
          max={200}
          value={score}
          onChange={e => setPlaceOverride(placeId, { score: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </label>
    </div>
  )
}
