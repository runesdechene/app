import { useMemo, useState } from 'react'
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

const FORTIFICATION_NAMES: Record<number, string> = {
  1: 'Tour de guet',
  2: 'Tour de défense',
  3: 'Bastion',
  4: 'Béfroi',
}

const FORTIFICATION_COSTS: Record<number, number> = {
  0: 1, // level 0 → 1 to reach level 1
  1: 2, // level 1 → 2 to reach level 2
  2: 3, // level 2 → 3 to reach level 3
  3: 5, // level 3 → 5 to reach level 4
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
  const nextPointIn = useFogStore(s => s.nextPointIn)
  const userPosition = useFogStore(s => s.userPosition)
  const [discovering, setDiscovering] = useState(false)

  // Énergie fractionnaire (taux fixe 1, cycle 7200s = +0.5/h)
  const CYCLE_SECONDS = 7200
  const isFull = energy >= maxEnergy
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

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
  const [showLikers, setShowLikers] = useState(false)
  const [likers, setLikers] = useState<Array<{ userId: string; name: string; factionColor: string | null; profileImage: string | null }>>([])
  const [likersLoading, setLikersLoading] = useState(false)
  const [explored, setExplored] = useState(place.requester?.explored ?? false)
  const [exploredCount, setExploredCount] = useState(place.metrics.explored)
  const [exploreLoading, setExploreLoading] = useState(false)
  const [showExploreConfirm, setShowExploreConfirm] = useState(false)
  const [showExplorers, setShowExplorers] = useState(false)
  const [explorers, setExplorers] = useState<Array<{ userId: string; name: string; factionColor: string | null; profileImage: string | null }>>([])
  const [explorersLoading, setExplorersLoading] = useState(false)
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

  async function fetchLikers() {
    if (showLikers) { setShowLikers(false); return }
    setLikersLoading(true)
    setShowLikers(true)
    const { data } = await supabase.rpc('get_place_likers', { p_place_id: place.id })
    if (data && Array.isArray(data)) {
      setLikers(data as typeof likers)
    }
    setLikersLoading(false)
  }

  async function fetchExplorers() {
    if (showExplorers) { setShowExplorers(false); return }
    setExplorersLoading(true)
    setShowExplorers(true)
    const { data } = await supabase.rpc('get_place_explorers', { p_place_id: place.id })
    if (data && Array.isArray(data)) {
      setExplorers(data as typeof explorers)
    }
    setExplorersLoading(false)
  }

  async function confirmExplore() {
    if (!userId || exploreLoading) return
    setExploreLoading(true)
    const { data, error } = await supabase.rpc('explore_place', { p_user_id: userId, p_place_id: place.id })
    if (error) {
      console.error('explore_place error:', error)
    } else if (data?.success) {
      setExplored(true)
      setExploredCount(c => c + 1)
      useToastStore.getState().addToast({
        type: 'discover',
        message: 'Lieu exploré !',
        timestamp: Date.now(),
      })
    }
    setExploreLoading(false)
    setShowExploreConfirm(false)
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
            Lieu ajout&eacute; par {place.author.lastName}
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
            {place.claim.fortificationLevel > 0 && (
              <span className="place-fortification-badge">
                {FORTIFICATION_NAMES[place.claim.fortificationLevel] ?? `Niveau ${place.claim.fortificationLevel}`}
              </span>
            )}
          </div>
        )}

        {/* Stats + Like */}
        <div className="place-panel-stats">
          <span>{place.metrics.views} vues</span>
          <div className="place-like-wrapper">
            <button
              className={`place-like-btn${liked ? ' place-like-btn-active' : ''}`}
              onClick={toggleLike}
              disabled={!userId || likeLoading}
            >
              {liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
            </button>
            <button className="place-like-count" onClick={fetchLikers}>
              {likesCount}
            </button>
          </div>
          {showLikers && (
            <div className="likers-modal-overlay" onClick={() => setShowLikers(false)}>
              <div className="likers-modal" onClick={e => e.stopPropagation()}>
                <div className="likers-modal-header">
                  <h3>Likes</h3>
                  <button className="likers-modal-close" onClick={() => setShowLikers(false)}>&#10005;</button>
                </div>
                <div className="likers-modal-list">
                  {likersLoading ? (
                    <span className="likers-modal-empty">Chargement...</span>
                  ) : likers.length === 0 ? (
                    <span className="likers-modal-empty">Aucun like</span>
                  ) : (
                    likers.map(liker => (
                      <button
                        key={liker.userId}
                        className="place-liker-row"
                        onClick={() => {
                          setShowLikers(false)
                          useMapStore.getState().setSelectedPlayerId(liker.userId)
                        }}
                      >
                        {liker.profileImage ? (
                          <img src={liker.profileImage} alt="" className="place-liker-avatar" />
                        ) : (
                          <span className="place-liker-avatar place-liker-avatar-default"
                            style={{ borderColor: liker.factionColor ?? undefined }}
                          />
                        )}
                        <span className="place-liker-name">{liker.name}</span>
                        {liker.factionColor && (
                          <span className="place-liker-faction-dot" style={{ backgroundColor: liker.factionColor }} />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <button className="place-explore-count" onClick={fetchExplorers}>
            {exploredCount} explorations
          </button>
          {place.metrics.note !== null && (
            <span>{place.metrics.note.toFixed(1)}/5</span>
          )}
        </div>

        {/* Explorers modal */}
        {showExplorers && (
          <div className="likers-modal-overlay" onClick={() => setShowExplorers(false)}>
            <div className="likers-modal" onClick={e => e.stopPropagation()}>
              <div className="likers-modal-header">
                <h3>Explorations</h3>
                <button className="likers-modal-close" onClick={() => setShowExplorers(false)}>&#10005;</button>
              </div>
              <div className="likers-modal-list">
                {explorersLoading ? (
                  <span className="likers-modal-empty">Chargement...</span>
                ) : explorers.length === 0 ? (
                  <span className="likers-modal-empty">Aucune exploration</span>
                ) : (
                  explorers.map(exp => (
                    <button
                      key={exp.userId}
                      className="place-liker-row"
                      onClick={() => {
                        setShowExplorers(false)
                        useMapStore.getState().setSelectedPlayerId(exp.userId)
                      }}
                    >
                      {exp.profileImage ? (
                        <img src={exp.profileImage} alt="" className="place-liker-avatar" />
                      ) : (
                        <span className="place-liker-avatar place-liker-avatar-default"
                          style={{ borderColor: exp.factionColor ?? undefined }}
                        />
                      )}
                      <span className="place-liker-name">{exp.name}</span>
                      {exp.factionColor && (
                        <span className="place-liker-faction-dot" style={{ backgroundColor: exp.factionColor }} />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Explore confirm modal */}
        {showExploreConfirm && (
          <div className="likers-modal-overlay" onClick={() => setShowExploreConfirm(false)}>
            <div className="explore-confirm-modal" onClick={e => e.stopPropagation()}>
              <p className="explore-confirm-text">Avez-vous r&eacute;ellement visit&eacute; ce lieu ?</p>
              <div className="explore-confirm-buttons">
                <button className="explore-confirm-yes" onClick={confirmExplore} disabled={exploreLoading}>
                  Oui, j&apos;y suis all&eacute;
                </button>
                <button className="explore-confirm-no" onClick={() => setShowExploreConfirm(false)}>
                  Non
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Explore button */}
        {userId && !explored && (
          <button
            className="place-explore-btn"
            onClick={() => setShowExploreConfirm(true)}
            disabled={exploreLoading}
          >
            {'\uD83E\uDDED'} J&apos;ai explor&eacute; ce lieu
          </button>
        )}
        {userId && explored && (
          <div className="place-explored-badge">
            {'\u2705'} Lieu explor&eacute;
          </div>
        )}

        {/* Admin : slider score / influence */}
        {isAdmin && (
          <ScoreSlider placeId={place.id} baseScore={place.metrics.likes + place.metrics.explored * 2} />
        )}

        {/* Claim button */}
        {userEmail && (
          <ClaimButton placeId={place.id} currentClaim={place.claim} />
        )}

        {/* Fortify button */}
        {userEmail && place.claim && (
          <FortifyButton placeId={place.id} currentClaim={place.claim} />
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
  currentClaim,
}: {
  placeId: string
  currentClaim: PlaceDetail['claim']
}) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const conquestPoints = useFogStore(s => s.conquestPoints)
  const userId = useFogStore(s => s.userId)
  const factionId = useFogStore(s => s.userFactionId)
  const factionTitle = useFogStore(s => s.userFactionTitle)
  const factionColor = useFogStore(s => s.userFactionColor)
  const factionPattern = useFogStore(s => s.userFactionPattern)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const fortLevel = currentClaim?.fortificationLevel ?? 0
  const claimCost = 1 + fortLevel

  if (!userId || !factionId || !factionTitle || !factionColor) return null

  // Déjà revendiqué par la même faction
  if (currentClaim?.factionId === factionId && !claimed) {
    return (
      <div className="claim-section claim-owned">
        <span
          className="place-claim-dot"
          style={{ backgroundColor: factionColor }}
        />
        Votre territoire
      </div>
    )
  }

  if (claimed) {
    return (
      <div
        className="claim-section claim-success claim-animate"
        style={{ '--claim-color-rgb': hexToRgb(factionColor) } as React.CSSProperties}
      >
        Revendiqué pour {factionTitle} !
      </div>
    )
  }

  const canAffordClaim = conquestPoints >= claimCost

  async function handleClaim() {
    if (!canAffordClaim) return
    setClaiming(true)
    setClaimError(null)

    const { data } = await supabase.rpc('claim_place', {
      p_user_id: userId,
      p_place_id: placeId,
    })

    if (data?.error) {
      setClaimError(data.error)
      if (data.conquestPoints !== undefined) {
        useFogStore.getState().setConquestPoints(data.conquestPoints)
      }
      setClaiming(false)
      return
    }

    if (data?.success) {
      setClaimed(true)
      setPlaceOverride(placeId, {
        claimed: true,
        factionId: factionId ?? undefined,
        tagColor: factionColor ?? undefined,
        factionPattern: factionPattern ?? undefined,
      })
      if (data.energy !== undefined) useFogStore.getState().setEnergy(data.energy)
      if (data.conquestPoints !== undefined) useFogStore.getState().setConquestPoints(data.conquestPoints)
      if (data.constructionPoints !== undefined) useFogStore.getState().setConstructionPoints(data.constructionPoints)

      if (data.notorietyPoints !== undefined) {
        useFogStore.getState().setNotorietyPoints(data.notorietyPoints)
      }

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Lieu revendiqué pour ${factionTitle} ! +10 Notoriété`,
        timestamp: Date.now(),
      })
    }

    setClaiming(false)
  }

  return (
    <div className="claim-section">
      <button
        className="claim-btn"
        style={{
          borderColor: factionColor,
          color: factionColor,
        }}
        onClick={handleClaim}
        disabled={claiming || !canAffordClaim}
      >
        {claiming
          ? 'Revendication...'
          : canAffordClaim
            ? `Revendiquer pour ${factionTitle} (${claimCost} \u2694)`
            : `Pas assez de points de conquête (${Math.floor(conquestPoints)}/${claimCost})`}
      </button>
      {claimError && (
        <p className="claim-error">{claimError}</p>
      )}
    </div>
  )
}

// --- Bouton Fortifier ---

function FortifyButton({
  placeId,
  currentClaim,
}: {
  placeId: string
  currentClaim: NonNullable<PlaceDetail['claim']>
}) {
  const constructionPoints = useFogStore(s => s.constructionPoints)
  const userFactionId = useFogStore(s => s.userFactionId)
  const userId = useFogStore(s => s.userId)
  const [fortifying, setFortifying] = useState(false)
  const [fortified, setFortified] = useState(false)
  const [localLevel, setLocalLevel] = useState(currentClaim.fortificationLevel)
  const [error, setError] = useState<string | null>(null)

  // Pas la meme faction → pas de bouton
  if (currentClaim.factionId !== userFactionId) return null

  // Niveau max atteint
  if (localLevel >= 4) {
    return (
      <div className="fortify-section fortify-max">
        <span className="fortify-icon">{'\uD83C\uDFF0'}</span>
        {FORTIFICATION_NAMES[4]} — Fortification maximale
      </div>
    )
  }

  const cost = FORTIFICATION_COSTS[localLevel] ?? 0
  const nextName = FORTIFICATION_NAMES[localLevel + 1] ?? ''
  const canAfford = constructionPoints >= cost

  async function handleFortify() {
    if (!userId || !canAfford) return
    setFortifying(true)
    setError(null)

    const { data } = await supabase.rpc('fortify_place', {
      p_user_id: userId,
      p_place_id: placeId,
    })

    if (data?.error) {
      setError(data.error)
      if (data.constructionPoints !== undefined) {
        useFogStore.getState().setConstructionPoints(data.constructionPoints)
      }
      setFortifying(false)
      return
    }

    if (data?.success) {
      setLocalLevel(data.fortificationLevel)
      if (data.constructionPoints !== undefined) {
        useFogStore.getState().setConstructionPoints(data.constructionPoints)
      }
      if (data.constructionNextPointIn !== undefined) {
        useFogStore.getState().setConstructionNextPointIn(data.constructionNextPointIn)
      }
      if (data.notorietyPoints !== undefined) {
        useFogStore.getState().setNotorietyPoints(data.notorietyPoints)
      }

      useToastStore.getState().addToast({
        type: 'claim',
        message: `Lieu fortifié : ${data.fortificationName} ! +5 Notoriété`,
        timestamp: Date.now(),
      })

      setFortified(true)
      setTimeout(() => setFortified(false), 2000)
    }

    setFortifying(false)
  }

  if (fortified && localLevel >= 4) {
    return (
      <div className="fortify-section fortify-max">
        <span className="fortify-icon">{'\uD83C\uDFF0'}</span>
        {FORTIFICATION_NAMES[4]} — Fortification maximale
      </div>
    )
  }

  return (
    <div className="fortify-section">
      <button
        className="fortify-btn"
        onClick={handleFortify}
        disabled={fortifying || !canAfford}
      >
        {fortifying
          ? 'Fortification...'
          : canAfford
            ? `\uD83D\uDD28 Fortifier \u2192 ${nextName} (${cost} \uD83D\uDD28)`
            : `Pas assez de construction (${Math.floor(constructionPoints)}/${cost})`}
      </button>
      {error && <p className="fortify-error">{error}</p>}
    </div>
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
