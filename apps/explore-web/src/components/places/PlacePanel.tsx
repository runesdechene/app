import { useEffect, useMemo, useState } from 'react'
import { usePlace } from '../../hooks/usePlace'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { useFogStore } from '../../stores/fogStore'
import { useToastStore } from '../../stores/toastStore'
import { discoverPlace } from '../../hooks/useFog'
import { useAuth } from '../../hooks/useAuth'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
  userEmail: string | null
  onAuthPrompt?: () => void
}

interface UserFaction {
  userId: string
  factionId: string
  factionTitle: string
  factionColor: string
  factionPattern: string
}

export function PlacePanel({ placeId, onClose, userEmail, onAuthPrompt }: PlacePanelProps) {
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
          <PlaceContent key={place.id} place={place} onClose={onClose} userEmail={userEmail} onAuthPrompt={onAuthPrompt} />
        )}
      </div>
    </>
  )
}

function PlaceContent({ place, onClose, userEmail, onAuthPrompt }: { place: PlaceDetail; onClose: () => void; userEmail: string | null; onAuthPrompt?: () => void }) {
  const { isAuthenticated } = useAuth()
  const discoveredIds = useFogStore(s => s.discoveredIds)
  const userFactionId = useFogStore(s => s.userFactionId)

  // Déterminer si le lieu est découvert personnellement
  const isDiscovered = isAuthenticated && discoveredIds.has(place.id)

  // Lieu de sa propre faction (visible mais pas encore découvert)
  const isOwnFaction = isAuthenticated
    && userFactionId !== null
    && place.claim?.factionId === userFactionId
    && !isDiscovered

  // Lieu non découvert → vue brouillard
  if (!isDiscovered) {
    return (
      <FoggedPlaceView
        place={place}
        onClose={onClose}
        isAuthenticated={isAuthenticated}
        isOwnFaction={isOwnFaction}
        onDiscover={async () => {
          await discoverPlace(place.id, place.location.latitude, place.location.longitude)
        }}
        onAuthPrompt={onAuthPrompt}
      />
    )
  }

  return <DiscoveredPlaceContent place={place} onClose={onClose} userEmail={userEmail} />
}

// --- Vue brouillard (lieu non découvert) ---

function FoggedPlaceView({
  place,
  onClose,
  isAuthenticated,
  isOwnFaction,
  onDiscover,
  onAuthPrompt,
}: {
  place: PlaceDetail
  onClose: () => void
  isAuthenticated: boolean
  isOwnFaction: boolean
  onDiscover: () => Promise<void>
  onAuthPrompt?: () => void
}) {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)
  const regenRate = useFogStore(s => s.regenRate)
  const nextPointIn = useFogStore(s => s.nextPointIn)
  const userPosition = useFogStore(s => s.userPosition)
  const [discovering, setDiscovering] = useState(false)

  // Énergie fractionnaire (même calcul que EnergyIndicator)
  const CYCLE_SECONDS = 14400
  const isFull = energy >= maxEnergy
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick * regenRate, maxEnergy)

  // Calcul distance GPS
  let isNearby = false
  if (userPosition) {
    const dist = haversineM(
      userPosition.lat, userPosition.lng,
      place.location.latitude, place.location.longitude,
    )
    isNearby = dist <= 500
  }

  const cost = isNearby ? 0 : (isOwnFaction ? 0.5 : 1)
  const canAfford = cost === 0 || fractionalEnergy >= cost

  const images = place.images || []

  return (
    <>
      {/* Header */}
      <div className="place-panel-header">
        <button onClick={onClose} className="place-panel-close" aria-label="Fermer">
          &#10005;
        </button>
      </div>

      {/* Gallery floue */}
      {images.length > 0 && (
        <div className="place-panel-gallery fogged-gallery">
          <img
            src={images[0].url}
            alt="Lieu mystérieux"
            className="place-panel-image"
          />
        </div>
      )}

      {/* Body */}
      <div className="place-panel-body">
        <h1 className="place-panel-title place-panel-title-blur">{place.title}</h1>

        {/* Badge faction alliée */}
        {isOwnFaction && place.claim && (
          <div
            className="place-claim-badge"
            style={{ borderColor: place.claim.factionColor }}
          >
            <span
              className="place-claim-dot"
              style={{ backgroundColor: place.claim.factionColor }}
            />
            Territoire allié — {place.claim.factionTitle}
          </div>
        )}

        <p className="fog-mystery-text">
          {isOwnFaction
            ? 'Ce lieu appartient à votre faction. Découvrez-le à moindre coût.'
            : 'Ce lieu est encore dans le brouillard. Explorez-le pour en découvrir les secrets.'
          }
        </p>

        {isAuthenticated ? (
          <div className="fog-discover-section">
            <button
              className="discover-btn"
              onClick={async () => {
                setDiscovering(true)
                await onDiscover()
                setDiscovering(false)
              }}
              disabled={discovering || !canAfford}
            >
              {discovering
                ? 'Exploration...'
                : isNearby
                  ? 'Explorer (gratuit — vous êtes à proximité)'
                  : isOwnFaction
                    ? 'Explorer (0.5 point d\'énergie — territoire allié)'
                    : `Explorer (1 point d'énergie)`
              }
            </button>

            <div className="fog-energy-info">
              <span className="fog-energy-count">{Number.isInteger(fractionalEnergy) ? fractionalEnergy : fractionalEnergy.toFixed(1)}/{maxEnergy}</span> points d'énergie
              {!canAfford && (
                <p className="fog-energy-empty">
                  Plus assez d'énergie. Revenez demain ou déplacez-vous à proximité du lieu.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="fog-cta-section">
            <p className="fog-cta-text">
              Rejoignez l'Aventure pour explorer ce lieu et découvrir la carte.
            </p>
            <button
              className="fog-cta-btn"
              onClick={onAuthPrompt}
            >
              Créer un compte
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// --- Vue découverte (lieu accessible) ---

function DiscoveredPlaceContent({ place, onClose, userEmail }: { place: PlaceDetail; onClose: () => void; userEmail: string | null }) {
  const isAdmin = useFogStore(s => s.isAdmin)
  const userId = useFogStore(s => s.userId)
  const [imageIndex, setImageIndex] = useState(0)
  const [textExpanded, setTextExpanded] = useState(false)
  const [liked, setLiked] = useState(place.requester?.liked ?? false)
  const [likesCount, setLikesCount] = useState(place.metrics.likes)
  const [likeLoading, setLikeLoading] = useState(false)
  const images = place.images || []
  const cacheBust = useMemo(() => Date.now(), [place.id])
  const TEXT_LIMIT = 300

  const prevImage = () => setImageIndex(i => (i - 1 + images.length) % images.length)
  const nextImage = () => setImageIndex(i => (i + 1) % images.length)

  async function toggleLike() {
    if (!userId || likeLoading) return
    setLikeLoading(true)
    if (liked) {
      const { error } = await supabase.rpc('unlike_place', { p_user_id: userId, p_place_id: place.id })
      if (error) console.error('unlike_place error:', error)
      else { setLiked(false); setLikesCount(c => c - 1) }
    } else {
      const { error } = await supabase.rpc('like_place', { p_user_id: userId, p_place_id: place.id })
      if (error) console.error('like_place error:', error)
      else { setLiked(true); setLikesCount(c => c + 1) }
    }
    setLikeLoading(false)
  }

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

        {/* Stats + Like */}
        <div className="place-panel-stats">
          <span>{place.metrics.views} vues</span>
          <button
            className={`place-like-btn${liked ? ' place-like-btn-active' : ''}`}
            onClick={toggleLike}
            disabled={!userId || likeLoading}
          >
            {liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'} {likesCount}
          </button>
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
                      WebkitMaskImage: `url(${tag.icon}?v=${cacheBust})`,
                      maskImage: `url(${tag.icon}?v=${cacheBust})`,
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

        {/* Admin : slider score / influence */}
        {isAdmin && (
          <ScoreSlider placeId={place.id} baseScore={place.metrics.likes + place.metrics.explored * 2} />
        )}

        {/* Claim button */}
        {userEmail && (
          <ClaimButton placeId={place.id} userEmail={userEmail} currentClaim={place.claim} />
        )}
      </div>
    </>
  )
}

// --- Haversine ---

function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
      <div
        className="claim-section claim-success claim-animate"
        style={{ '--claim-color-rgb': hexToRgb(userFaction.factionColor) } as React.CSSProperties}
      >
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
      useToastStore.getState().addToast({
        type: 'claim',
        message: `Lieu revendiqué pour ${userFaction.factionTitle} !`,
        color: userFaction.factionColor,
        timestamp: Date.now(),
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

// --- Utilitaire : hex → r, g, b ---

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
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
