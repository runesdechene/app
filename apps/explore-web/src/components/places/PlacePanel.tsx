import { useEffect, useMemo, useState } from 'react'
import { usePlace } from '../../hooks/usePlace'
import type { PlaceDetail } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useToastStore } from '../../stores/toastStore'
import { discoverPlace } from '../../hooks/usePlayer'
import { useAuth } from '../../hooks/useAuth'
import { FoggedPlaceView } from './FoggedPlaceView'
import { ScoreSlider } from './ScoreSlider'
import { WishlistButton } from './WishlistButton'
import { PlaceEnigma } from '../enigma/PlaceEnigma'
import { CarnetCard } from './CarnetCard'
import type { Carnet } from './CarnetCard'
import { InfluenceFrame } from './InfluenceFrame'
import { PlaceGallery } from './PlaceGallery'
import { PlaceInfos } from './PlaceInfos'
import { AddCarnetModal } from './AddCarnetModal'
import { PlaceExplorers } from './PlaceExplorers'
import { InfluenceButton } from './InfluenceButton'
import './PlacePanel.css'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
  userEmail: string | null
  onAuthPrompt?: () => void
}

export function PlacePanel({ placeId, onClose, userEmail, onAuthPrompt }: PlacePanelProps) {
  const { place, loading, error, refetch } = usePlace(placeId)
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
          <PlaceContent key={place.id} place={place} onClose={onClose} userEmail={userEmail} onAuthPrompt={onAuthPrompt} onRefetch={refetch} />
        )}
      </div>
    </>
  )
}

function PlaceContent({ place, onClose, userEmail, onAuthPrompt, onRefetch }: { place: PlaceDetail; onClose: () => void; userEmail: string | null; onAuthPrompt?: () => void; onRefetch: () => void }) {
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

  return <DiscoveredPlaceContent place={place} onClose={onClose} userEmail={userEmail} onRefetch={onRefetch} />
}

// --- Vue découverte (lieu accessible) ---

/** V0.5 detail data from get_place_detail_v05 */
interface V05Detail {
  influence: Array<{ factionId: string; placed: number; content: number; total: number }>
  dominantFaction: string | null
  contributions: V05Contribution[]
  explorers: Array<{ userId: string; visitedAt: string; userName: string; userAvatar: string | null; factionId: string }>
  avgRating: number | null
  ratingCount: number
  userRating: number | null
  isWishlisted: boolean
  isExplorer: boolean
  guardian: { userId: string; name: string; avatar: string | null; factionId: string } | null
}

/** Raw contribution from the RPC */
interface V05Contribution {
  id: number
  userId: string
  factionId: string
  type: string
  content: string | null
  imageUrl: string | null
  images?: string[]
  rating?: number | null
  votesUp: number
  votesDown: number
  createdAt: string
  userName: string
  userAvatar: string | null
}

type ActiveTab = 'carnets' | 'galerie' | 'infos'

function DiscoveredPlaceContent({ place, onClose, userEmail, onRefetch }: { place: PlaceDetail; onClose: () => void; userEmail: string | null; onRefetch: () => void }) {
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userId = usePlayerStore(s => s.userId)
  const [imageIndex, setImageIndex] = useState(0)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('carnets')
  const [showAddCarnet, setShowAddCarnet] = useState(false)

  // V0.5 detail data
  const [v05, setV05] = useState<V05Detail | null>(null)
  const [v05Key, setV05Key] = useState(0)

  // Faction colors cache
  const [factionColors, setFactionColors] = useState<Map<string, string>>(new Map())

  // Fetch V0.5 detail
  useEffect(() => {
    let cancelled = false
    async function loadV05() {
      const { data, error } = await supabase.rpc('get_place_detail_v05', {
        p_place_id: place.id,
        p_user_id: userId ?? null,
      })
      if (cancelled || error) return
      const d = data as V05Detail | null
      if (d) {
        setV05(d)
        if (d.influence && Array.isArray(d.influence)) {
          const factionIds = d.influence.map(i => i.factionId)
          if (factionIds.length > 0) {
            const { data: factionData } = await supabase
              .from('factions')
              .select('id, color')
              .in('id', factionIds)
            if (!cancelled && factionData) {
              const map = new Map<string, string>()
              for (const f of factionData as Array<{ id: string; color: string }>) {
                map.set(f.id, f.color)
              }
              setFactionColors(map)
              setV05(prev => {
                if (!prev) return prev
                return {
                  ...prev,
                  influence: prev.influence.map(i => ({
                    ...i,
                    factionColor: map.get(i.factionId),
                  })),
                }
              })
            }
          }
        }
      }
    }
    loadV05()
    return () => { cancelled = true }
  }, [place.id, userId, v05Key])

  const refreshV05 = () => setV05Key(k => k + 1)

  // Listen for influence-action custom event from InfluenceFrame
  const [showInfluenceAction, setShowInfluenceAction] = useState(false)
  useEffect(() => {
    function onOpen() { setShowInfluenceAction(true) }
    window.addEventListener('open-influence-action', onOpen)
    return () => window.removeEventListener('open-influence-action', onOpen)
  }, [])

  // --- Data transformations ---

  // Carnets: filter contributions with type 'carnet', sorted by votesUp DESC
  const carnets: Carnet[] = useMemo(() => {
    if (!v05?.contributions) return []
    return v05.contributions
      .filter(c => c.type === 'carnet')
      .sort((a, b) => b.votesUp - a.votesUp)
      .map(c => ({
        id: c.id,
        userId: c.userId,
        factionId: c.factionId,
        content: c.content ?? '',
        images: c.images ?? (c.imageUrl ? [c.imageUrl] : []),
        rating: c.rating ?? null,
        votesUp: c.votesUp,
        votesDown: c.votesDown,
        createdAt: c.createdAt,
        userName: c.userName,
        userAvatar: c.userAvatar,
      }))
  }, [v05?.contributions])

  // Hero photo: random from top-3 voted carnets' images, fallback to place.images
  const heroPhotos = useMemo(() => {
    const top3 = carnets.slice(0, 3)
    const carnetPhotos = top3.flatMap(c => c.images)
    if (carnetPhotos.length > 0) return carnetPhotos
    return (place.images || []).map(img => img.url)
  }, [carnets, place.images])

  const currentHeroPhotos = heroPhotos.length > 0 ? heroPhotos : []
  const heroPhotoUrl = currentHeroPhotos.length > 0
    ? currentHeroPhotos[imageIndex % currentHeroPhotos.length]
    : null

  // Average rating from carnets
  const avgRating = useMemo(() => {
    // Use V05 avgRating if available (from place_ratings table)
    if (v05?.avgRating != null) return v05.avgRating
    // Fallback: compute from carnets
    const rated = carnets.filter(c => c.rating !== null)
    if (rated.length === 0) return null
    return rated.reduce((sum, c) => sum + c.rating!, 0) / rated.length
  }, [v05?.avgRating, carnets])

  // Gallery photos: flatten all carnet images
  const galleryPhotos = useMemo(() => {
    return carnets.flatMap(c =>
      c.images.map(url => ({ url, carnetId: c.id }))
    )
  }, [carnets])

  // Info fields: filter contributions of type accessibility, season, warning
  const infoFields = useMemo(() => {
    if (!v05?.contributions) return []
    const infoTypes = ['accessibility', 'season', 'warning']
    return v05.contributions
      .filter(c => infoTypes.includes(c.type))
      .map(c => ({
        type: c.type as 'accessibility' | 'season' | 'warning',
        content: c.content,
        userName: c.userName,
        updatedAt: c.createdAt,
      }))
  }, [v05?.contributions])

  // Influence config defaults (TODO: fetch from app_settings)
  const influencePerCarnet = 10
  const influencePerPhoto = 5
  const influencePerVote = 1

  const isAuthor = place.author?.id === userId

  const cacheBust = useMemo(() => Date.now(), [place.id])

  // Hero gallery navigation
  const prevHero = () => setImageIndex(i => (i - 1 + currentHeroPhotos.length) % currentHeroPhotos.length)
  const nextHero = () => setImageIndex(i => (i + 1) % currentHeroPhotos.length)

  function scrollToCarnet(carnetId: number) {
    setActiveTab('carnets')
    setTimeout(() => {
      document.getElementById(`carnet-${carnetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDeletePlace() {
    if (!userId || deleting) return
    setDeleting(true)
    const { data, error: rpcError } = await supabase.rpc('delete_place', { p_user_id: userId, p_place_id: place.id })
    if (rpcError) {
      setDeleting(false)
      return
    }
    if (data?.error) {
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

      {/* Zone 1 — Hero Photo */}
      <div className="place-hero">
        {heroPhotoUrl ? (
          <img
            src={heroPhotoUrl}
            alt={place.title}
            className="place-hero-img"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="place-hero-placeholder" />
        )}

        {/* Top-left: close + admin gear */}
        <div className="place-hero-top-left">
          <button onClick={onClose} className="place-hero-pill place-hero-close" aria-label="Fermer">
            &#10005;
          </button>
          {isAdmin && (
            <div className="place-options-wrap">
              <button
                className="place-hero-pill place-options-btn"
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
        </div>

        {/* Top-right: rating pill + wishlist */}
        <div className="place-hero-top-right">
          {avgRating !== null && (
            <span className="place-hero-pill place-hero-rating">
              ★ {avgRating.toFixed(1)}
            </span>
          )}
          {v05 && (
            <span className="place-hero-pill">
              <WishlistButton placeId={place.id} isWishlisted={v05.isWishlisted} />
            </span>
          )}
        </div>

        {/* Gallery dots */}
        {currentHeroPhotos.length > 1 && (
          <div className="place-hero-dots">
            {currentHeroPhotos.map((_, i) => (
              <button
                key={i}
                className={`place-hero-dot${i === (imageIndex % currentHeroPhotos.length) ? ' active' : ''}`}
                onClick={() => setImageIndex(i)}
              />
            ))}
          </div>
        )}

        {/* Gallery nav arrows */}
        {currentHeroPhotos.length > 1 && (
          <>
            <button className="place-hero-nav place-hero-prev" onClick={prevHero}>&#8249;</button>
            <button className="place-hero-nav place-hero-next" onClick={nextHero}>&#8250;</button>
          </>
        )}
      </div>

      {/* Zone 2 — Body */}
      <div className="place-body">
        {/* Identity */}
        <div className="place-identity">
          <h2 className="place-title">{place.title}</h2>

          {/* Tags */}
          {place.tags.length > 0 && (
            <div className="place-tags">
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

          {/* Address */}
          {place.address && (
            <p className="place-address">
              <span className="place-address-icon">{'\uD83D\uDCCD'}</span>
              {place.address}
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
            </p>
          )}

          {/* Roles */}
          <div className="place-roles">
            {place.author && (
              <button
                className="place-role-link"
                onClick={() => useMapStore.getState().setSelectedPlayerId(place.author.id)}
              >
                {place.author.profileImageUrl ? (
                  <img src={place.author.profileImageUrl} alt="" className="place-role-avatar" />
                ) : (
                  <span className="place-role-avatar place-role-avatar-fallback">
                    {(place.author.lastName || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="place-role-label">Découvreur</span>
                <span className="place-role-name">{place.author.lastName || 'Inconnu'}</span>
              </button>
            )}
            {v05?.guardian && (
              <button
                className="place-role-link"
                onClick={() => useMapStore.getState().setSelectedPlayerId(v05.guardian!.userId)}
              >
                {v05.guardian.avatar ? (
                  <img src={v05.guardian.avatar} alt="" className="place-role-avatar" />
                ) : (
                  <span className="place-role-avatar place-role-avatar-fallback">
                    {(v05.guardian.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="place-role-label">Gardien</span>
                <span className="place-role-name">{v05.guardian.name}</span>
              </button>
            )}
          </div>
        </div>

        {/* Zone 3A — Influence Frame */}
        {v05 && (
          <InfluenceFrame
            placeId={place.id}
            influence={v05.influence ?? []}
            factionColors={factionColors}
            placeLocation={place.location}
            onInfluencePlaced={() => { refreshV05(); onRefetch() }}
          />
        )}

        {/* Hidden InfluenceButton for the action modal */}
        {showInfluenceAction && userEmail && usePlayerStore.getState().gameMode === 'conquest' && (
          <div style={{ display: 'none' }}>
            <InfluenceButton
              placeId={place.id}
              placeLocation={place.location}
              onInfluencePlaced={() => { refreshV05(); onRefetch(); setShowInfluenceAction(false) }}
            />
          </div>
        )}

        {/* Zone 3B — Explorers */}
        {v05 && (
          <PlaceExplorers
            placeId={place.id}
            explorers={v05.explorers ?? []}
            placeLocation={place.location}
            isExplorer={v05.isExplorer}
            factionColors={factionColors}
            onVisited={() => { refreshV05(); onRefetch() }}
          />
        )}

        {/* Place Enigma (GPS only) */}
        <PlaceEnigma
          placeId={place.id}
          placeLocation={place.location}
          placeTags={place.tags.map(t => t.title)}
        />

        {/* Zone 4 — Tabs */}
        <div className="place-tabs">
          <button
            className={`place-tab${activeTab === 'carnets' ? ' active' : ''}`}
            onClick={() => setActiveTab('carnets')}
          >
            Carnets ({carnets.length})
          </button>
          <button
            className={`place-tab${activeTab === 'galerie' ? ' active' : ''}`}
            onClick={() => setActiveTab('galerie')}
          >
            Galerie ({galleryPhotos.length})
          </button>
          <button
            className={`place-tab${activeTab === 'infos' ? ' active' : ''}`}
            onClick={() => setActiveTab('infos')}
          >
            Infos ({infoFields.length})
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'carnets' && (
          <div className="place-tab-content">
            {carnets.length === 0 ? (
              <p className="place-tab-empty">Aucun carnet pour l'instant. Soyez le premier à écrire !</p>
            ) : (
              carnets.map((c, i) => (
                <CarnetCard
                  key={c.id}
                  carnet={c}
                  isTop={i === 0}
                  factionColor={factionColors.get(c.factionId) ?? null}
                  influencePerCarnet={influencePerCarnet}
                  influencePerPhoto={influencePerPhoto}
                  influencePerVote={influencePerVote}
                  onVoted={refreshV05}
                />
              ))
            )}
            {userId && (
              <button
                className="place-add-carnet-btn"
                onClick={() => setShowAddCarnet(true)}
              >
                Ajouter ma page de carnet
              </button>
            )}
          </div>
        )}

        {activeTab === 'galerie' && (
          <div className="place-tab-content">
            <PlaceGallery photos={galleryPhotos} onPhotoClick={scrollToCarnet} />
          </div>
        )}

        {activeTab === 'infos' && (
          <div className="place-tab-content">
            <PlaceInfos placeId={place.id} infos={infoFields} onRefresh={refreshV05} />
          </div>
        )}

        {/* Admin: ScoreSlider */}
        {isAdmin && (
          <ScoreSlider placeId={place.id} baseScore={place.metrics.likes + place.metrics.explored * 2} />
        )}
      </div>

      {/* Add carnet modal */}
      {showAddCarnet && (
        <AddCarnetModal
          placeId={place.id}
          canRate={v05?.isExplorer === true || isAuthor}
          onClose={() => setShowAddCarnet(false)}
          onSaved={refreshV05}
        />
      )}
    </>
  )
}
