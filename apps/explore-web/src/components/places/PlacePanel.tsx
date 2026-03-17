import { useMemo, useState } from 'react'
import { usePlace } from '../../hooks/usePlace'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import { discoverPlace } from '../../hooks/usePlayer'
import { useAuth } from '../../hooks/useAuth'
import { useConstructionTypes } from '../../hooks/useConstructionTypes'
import { FoggedPlaceView } from './FoggedPlaceView'
import { ClaimButton } from './ClaimButton'
import { FortifyButton } from './FortifyButton'
import { ScoreSlider } from './ScoreSlider'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
  userEmail: string | null
  onAuthPrompt?: () => void
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
  const discoveredIds = usePlayerStore(s => s.discoveredIds)
  const userFactionId = usePlayerStore(s => s.userFactionId)

  const isDiscovered = isAuthenticated && discoveredIds.has(place.id)
  const isOwnFaction = isAuthenticated
    && userFactionId !== null
    && place.claim?.factionId === userFactionId
    && !isDiscovered

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

// --- Vue découverte (lieu accessible) ---

function DiscoveredPlaceContent({ place, onClose, userEmail }: { place: PlaceDetail; onClose: () => void; userEmail: string | null }) {
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userId = usePlayerStore(s => s.userId)
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
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const constructionTypes = useConstructionTypes()
  const canManage = (userId === place.author.id) || isAdmin
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
      else { setLiked(false); setLikesCount(c => c - 1); useMapStore.getState().incrementPlacesRefreshKey() }
    } else {
      const { error } = await supabase.rpc('like_place', { p_user_id: userId, p_place_id: place.id })
      if (error) console.error('like_place error:', error)
      else { setLiked(true); setLikesCount(c => c + 1); useMapStore.getState().incrementPlacesRefreshKey() }
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
      useMapStore.getState().incrementPlacesRefreshKey()
      useToastStore.getState().addToast({
        type: 'discover',
        message: 'Lieu exploré !',
        timestamp: Date.now(),
      })
    }
    setExploreLoading(false)
    setShowExploreConfirm(false)
  }

  async function handleDeletePlace() {
    if (!userId || deleting) return
    setDeleting(true)
    const { data, error: rpcError } = await supabase.rpc('delete_place', { p_user_id: userId, p_place_id: place.id })
    if (rpcError) {
      console.error('delete_place rpc error:', rpcError)
      setDeleting(false)
      return
    }
    if (data?.error) {
      console.error('delete_place error:', data.error)
      setDeleting(false)
      return
    }
    useMapStore.getState().markPlaceDeleted(place.id)
    useToastStore.getState().addToast({ type: 'discover', message: 'Lieu supprimé', timestamp: Date.now() })
    setDeleting(false)
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <>
      {/* Header */}
      <div className="place-panel-header">
        {usePlayerStore.getState().gameMode === 'conquest' && place.claim && (
          <div
            className="place-claim-badge"
            style={{ backgroundColor: place.claim.factionColor }}
          >
            {place.claim.factionPattern ? (
              <img src={place.claim.factionPattern} alt="" className="place-claim-faction-logo" />
            ) : (
              <span
                className="place-claim-dot"
                style={{ backgroundColor: place.claim.factionColor }}
              />
            )}
            <div className="place-claim-text">
              <div className="place-claim-author">
                Revendiqué par <a className="place-claim-link" onClick={() => useMapStore.getState().setSelectedPlayerId(place.claim!.claimedBy)}>{place.claim.claimedByName || 'Inconnu'}</a>
              </div>
              <div className="place-claim-faction-name">
                {place.claim.factionTitle}
              </div>
            </div>
          </div>
        )}
        <div className="place-panel-header-actions">
          {canManage && (
            <div className="place-options-wrap">
              <button
                className="place-options-btn"
                onClick={() => setShowOptionsMenu(v => !v)}
                aria-label="Options"
              >
                {'\u2699\uFE0F'}
              </button>
              {showOptionsMenu && (
                <>
                  <div className="place-options-backdrop" onClick={() => setShowOptionsMenu(false)} />
                  <div className="place-options-menu">
                    <button
                      className="place-options-item danger"
                      onClick={() => { setShowOptionsMenu(false); setShowDeleteConfirm(true) }}
                    >
                      Supprimer ce lieu
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={onClose} className="place-panel-close" aria-label="Fermer">
            &#10005;
          </button>
        </div>
      </div>

      {/* Dialog confirmation suppression */}
      {showDeleteConfirm && (
        <div className="place-delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="place-delete-confirm" onClick={e => e.stopPropagation()}>
            <p>Supprimer &laquo;&nbsp;{place.title}&nbsp;&raquo; ?</p>
            <p className="place-delete-confirm-warning">Cette action est irréversible.</p>
            <div className="place-delete-confirm-actions">
              <button
                className="place-delete-cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                className="place-delete-btn"
                onClick={handleDeletePlace}
                disabled={deleting}
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery */}
      {images.length > 0 && (
        <div className="place-panel-gallery">
          <img
            src={images[imageIndex].url}
            alt={place.title}
            className="place-panel-image"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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

        {place.author && (() => {
          const name = place.author.lastName || 'Inconnu'
          const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1)
          return (
            <p className="place-panel-author">
              <button
                className="place-panel-author-link"
                onClick={() => useMapStore.getState().setSelectedPlayerId(place.author.id)}
              >
                {place.author.profileImageUrl ? (
                  <img src={place.author.profileImageUrl} alt="" className="place-panel-author-avatar" />
                ) : (
                  <span className="place-panel-author-avatar place-panel-author-avatar-fallback">
                    {capitalizedName.charAt(0)}
                  </span>
                )}
                <strong>{capitalizedName}</strong>
              </button>
              {' '}a ajout&eacute; ce lieu{place.createdAt && (
                <> le {new Date(place.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
              )}
            </p>
          )
        })()}

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
                  <h3>Voyageurs qui ont aimés</h3>
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
          <div className="place-panel-address-row">
            <p className="place-panel-address">{place.address}</p>
            <button
              className="place-goto-btn"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  useMapStore.getState().setSelectedPlaceId(null)
                  useMapStore.getState().requestFlyTo({
                    lng: place.location.longitude,
                    lat: place.location.latitude,
                  })
                } else {
                  useMapStore.getState().requestFlyTo({
                    lng: place.location.longitude,
                    lat: place.location.latitude,
                    placeId: place.id,
                  })
                }
              }}
              title="Aller sur ce lieu"
            >
              {'\uD83D\uDDFA\uFE0F'}
            </button>
          </div>
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

        {/* Claim button (masque en mode exploration) */}
        {userEmail && usePlayerStore.getState().gameMode === 'conquest' && (
          <ClaimButton placeId={place.id} currentClaim={place.claim} />
        )}

        {/* Fortify button (masque en mode exploration) */}
        {userEmail && usePlayerStore.getState().gameMode === 'conquest' && place.claim && (
          <FortifyButton placeId={place.id} currentClaim={place.claim} constructionTypes={constructionTypes} />
        )}
      </div>
    </>
  )
}
