import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlace } from '../../../hooks/usePlace'
import type { PlaceDetail } from '../../../hooks/usePlace'
import { supabase } from '../../../lib/supabase'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { useGloryRulesStore } from '../../../stores/gloryRulesStore'
import { discoverPlace } from '../../../lib/discoverPlace'
import { useAuth } from '../../../hooks/useAuth'
import { FoggedPlaceView } from './FoggedPlaceView'
import { WishlistButton } from '../actions/WishlistButton'
import { VeilleFrame } from './VeilleFrame'
import { useVeille } from '../../../hooks/useVeille'
import { PlaceGallery } from './PlaceGallery'
import { PlaceInfos } from './PlaceInfos'
import { PhotoSlideshow } from './PhotoSlideshow'
import { CourtFold } from '../details/CourtFold'
import { PlaceDescription } from '../details/PlaceDescription'
import { DiscussionThread } from '../discussion/DiscussionThread'
import { ShareButton } from '../actions/ShareButton'
import { useCalendarRef } from '../../../hooks/useCalendarRef'
import { formatYear } from '../../../lib/calendarUtils'
import { formatRelativeTime } from '../../../lib/dateFormat'
import { DescriptionEditModal } from '../modals/DescriptionEditModal'
import { DescriptionHistoryModal } from '../modals/DescriptionHistoryModal'
import { AddPhotoModal } from '../modals/AddPhotoModal'
import { EditPlaceTagsModal } from '../modals/EditPlaceTagsModal'
import { PhotoLightbox } from '../modals/PhotoLightbox'
import { PlaceExplorersModal } from '../modals/PlaceExplorersModal'
import type { V05Detail, V05Contribution, PlacePanelActiveTab } from '../../../types/placeDetail'
import './PlacePanel.css'

interface PlacePanelProps {
  placeId: string | null
  onClose: () => void
  userEmail: string | null
  onAuthPrompt?: () => void
  /** Sur mobile, force le panel à occuper tout l'écran (sans la marge top
   * de 120px utilisée pour laisser visible le header partagé sur la carte).
   * Utilisé sur la home où on veut couvrir intégralement l'interface. */
  mobileFullscreen?: boolean
}

export function PlacePanel({ placeId, onClose, userEmail, onAuthPrompt, mobileFullscreen }: PlacePanelProps) {
  const { place, loading, error, refetch } = usePlace(placeId)
  const isOpen = placeId !== null

  return (
    <>
      {isOpen && <div className={`place-panel-backdrop${mobileFullscreen ? ' modal-mobile-fullscreen-backdrop' : ''}`} onClick={onClose} />}

      <div className={`place-panel${isOpen ? ' place-panel-open' : ''}${mobileFullscreen ? ' modal-mobile-fullscreen' : ''}`}>
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

  const isDiscovered = isAuthenticated && discoveredIds.has(place.id)
  // V0.7 — la notion "lieu de ma faction" disparaît avec les colonnes claimed_*.
  // À réintroduire post-festival via la Veille (faction du veilleur) si nécessaire.
  const isOwnFaction = false

  if (!isDiscovered) {
    return (
      <FoggedPlaceView
        place={place}
        onClose={onClose}
        isAuthenticated={isAuthenticated}
        isOwnFaction={isOwnFaction}
        onDiscover={async () => {
          const result = await discoverPlace(place.id, place.location.latitude, place.location.longitude)
          if (!result.success && result.error) {
            // Defense-in-depth : si le serveur refuse (typiquement not_enough_energy
            // sur une desync avec le check front), on toast pour eviter le clic mort.
            const msg = result.error === 'not_enough_energy'
              ? "Pas assez d'energie pour decouvrir ce lieu."
              : `Decouverte impossible : ${result.error}`
            useToastStore.getState().addToast({
              type: 'error',
              message: msg,
              timestamp: Date.now(),
            })
          }
        }}
        onAuthPrompt={onAuthPrompt}
      />
    )
  }

  return <DiscoveredPlaceContent place={place} onClose={onClose} userEmail={userEmail} onRefetch={onRefetch} />
}

// --- Vue découverte (lieu accessible) ---

function QuickInfoChip({ icon, value, placeholder, onClick }: {
  icon: React.ReactNode
  value: string | null
  placeholder: string
  onClick: () => void
}) {
  return (
    <button className={`place-quick-info place-quick-info-btn${value ? ' has-value' : ''}`} onClick={onClick} title={value ?? `Ajouter : ${placeholder}`}>
      {icon}
      <span className="place-quick-info-text">{value ?? placeholder}</span>
    </button>
  )
}

/** Unified explorer row — discoverer (⭐) and guardian (🛡) get badges on their avatars */
function ExplorerRow({ explorers, authorId, guardianIds, factionColors, placeId, placeTitle, placeLocation, isExplorer, onVisited }: {
  explorers: Array<{ userId: string; visitedAt: string; userName: string; userAvatar: string | null; factionId: string }>
  authorId: string | null
  guardianIds: string[]
  factionColors: Map<string, string>
  placeId: string
  placeTitle: string
  placeLocation: { latitude: number; longitude: number }
  isExplorer: boolean
  onVisited: () => void
}) {
  const userId = usePlayerStore(s => s.userId)
  const userPosition = usePlayerStore(s => s.userPosition)
  // Si user a une faction, le bouton "J'y suis allé" est masqué : la visite et
  // le plantage de l'étendard se font en 1 tap via VeilleFrame plus bas
  // (décision Uriel 2026-05-02 — fini les 2 boutons quasi-identiques).
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const [loading, setLoading] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [visitRewards, setVisitRewards] = useState<{ stock: number; exploration: number; visitNumber: number; nextVisitGain?: number } | null>(null)
  // V0.7.7 (10/05) — modale "Tous les explorateurs" déclenchée par le bouton +X
  const [showExplorersModal, setShowExplorersModal] = useState(false)

  // Bouton "Revisiter (sur place)" retiré 2026-05-02 (Uriel) — la mécanique
  // de revisite GPS V0.5 (gain influence par revisite) est obsolète depuis
  // la refonte Gloire/Coupe ; le geste utile sur place est désormais "Planter
  // mon étendard" (= visit + plant_flag en 1 tap).

  const isOnSite = useMemo(() => {
    if (!userPosition) return false
    const R = 6371
    const dLat = (placeLocation.latitude - userPosition.lat) * Math.PI / 180
    const dLng = (placeLocation.longitude - userPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userPosition.lat * Math.PI / 180) * Math.cos(placeLocation.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < 0.2
  }, [userPosition, placeLocation])

  const needsRefreshRef = useRef(false)

  async function handleVisit() {
    if (!userId || !userPosition || loading) return
    setLoading(true)
    const { data, error } = await supabase.rpc('visit_place_gps', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: userPosition.lat,
      p_user_lng: userPosition.lng,
    })
    if (!error && data && !data.error) {
      const result = data as { stockGain?: number; explorationGain?: number; visitNumber?: number }
      setVisitRewards({ stock: result.stockGain ?? 0, exploration: result.explorationGain ?? 0, visitNumber: result.visitNumber ?? 1 })
      useToastStore.getState().addToast({
        type: 'explore',
        message: `Visite de ${placeTitle} validée !`,
        highlights: [placeTitle],
        placeId,
        placeLocation,
        timestamp: Date.now(),
      })
      needsRefreshRef.current = true
      setShowRating(true)
    }
    setLoading(false)
  }

  function finishRatingFlow() {
    setShowRating(false)
    if (needsRefreshRef.current) {
      needsRefreshRef.current = false
      onVisited()
    }
  }

  async function submitRating() {
    if (!userId || ratingValue === 0) return
    await supabase.rpc('rate_place', { p_user_id: userId, p_place_id: placeId, p_rating: ratingValue })
    setRatingSaved(true)
    setTimeout(finishRatingFlow, 1500)
  }

  // Sort: author first, then guardian, then rest by visit date
  const sorted = useMemo(() => {
    const copy = [...explorers]
    copy.sort((a, b) => {
      const aScore = (a.userId === authorId ? 0 : guardianIds.includes(a.userId) ? 1 : 2)
      const bScore = (b.userId === authorId ? 0 : guardianIds.includes(b.userId) ? 1 : 2)
      if (aScore !== bScore) return aScore - bScore
      return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime()
    })
    return copy
  }, [explorers, authorId, guardianIds])

  // V0.7.7 (10/05) — limit visible avatars + bouton +X qui ouvre la modale "tous les explorers"
  const MAX_VISIBLE_AVATARS = 5
  const visibleExplorers = sorted.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = Math.max(0, sorted.length - MAX_VISIBLE_AVATARS)

  return (
    <div className="place-explorers-unified">
      <p className="place-exp-title">Ils ont foulé ces terres <span className="place-exp-title-lenght">{sorted.length}</span></p>
      <div className="place-explorers-avatars">
        <div className="place-explorers-avatars-list">
          {visibleExplorers.map(exp => {
            const isAuthor = exp.userId === authorId
            const isGuardian = guardianIds.includes(exp.userId)
            const color = factionColors.get(exp.factionId) ?? '#8A7B6A'
            return (
              <button
                key={exp.userId}
                className="place-exp-avatar-wrap"
                onClick={() => useMapStore.getState().setSelectedPlayerId(exp.userId)}
                title={`${exp.userName}${isAuthor ? ' — Découvreur' : ''}${isGuardian ? ' — Gardien' : ''}`}
              >
                {exp.userAvatar ? (
                  <img src={exp.userAvatar} alt={exp.userName} className="place-exp-avatar" style={{ borderColor: color }} />
                ) : (
                  <div className="place-exp-avatar place-exp-avatar-fallback" style={{ backgroundColor: color }}>
                    {(exp.userName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {isAuthor && <span className="place-exp-badge place-exp-badge-author">⭐</span>}
                {isGuardian && <span className="place-exp-badge place-exp-badge-guardian">🛡️</span>}
              </button>
            )
          })}
          {overflowCount > 0 && (
            <button
              className="place-exp-overflow"
              onClick={() => setShowExplorersModal(true)}
              title={`Voir les ${sorted.length} explorateurs`}
              aria-label={`Voir les ${sorted.length} explorateurs`}
            >
              +{overflowCount}
            </button>
          )}
          {userId && !isExplorer && !userFactionId && (
            <button
              className={`place-exp-visit-btn${!isOnSite ? ' place-exp-visit-btn-disabled' : ''}`}
              onClick={isOnSite ? handleVisit : undefined}
              disabled={!isOnSite || loading}
              title={isOnSite ? 'Valider votre visite GPS' : 'Rendez-vous sur place pour valider'}
            >
              {loading && !isExplorer ? '...' : isOnSite ? '📍 Marquer ma visite' : '📍 Sur place uniquement'}
            </button>
          )}
        </div>
        {userFactionId && (
          <VeilleFrame
            placeId={placeId}
            placeTitle={placeTitle}
            placeLocation={placeLocation}
            onVisit={handleVisit}
            alreadyVisited={isExplorer}
          />
        )}
      </div>

      {/* Prompt notation après visite GPS */}
      {showRating && !ratingSaved && (
        <div className="place-rating-prompt">
          {visitRewards && (
            <div className="place-visit-rewards">
              <p className="place-visit-rewards-title">🎉 Récompenses</p>
              {/* V067 — barème centralisé app_settings via gloryRulesStore. */}
              {visitRewards.visitNumber === 1 ? (() => {
                const r = useGloryRulesStore.getState().rules
                const g = r['glory.visit_gps']
                const c = r['coupe.visit_gps']
                return (
                  <>
                    {g > 0 && <span className="place-visit-reward">🎖️ +{g} Gloire</span>}
                    {c > 0 && <span className="place-visit-reward">🏆 +{c} Coupe</span>}
                  </>
                )
              })() : (
                <span className="place-visit-reward place-visit-reward-hint">
                  Visite n°{visitRewards.visitNumber} — vous connaissez déjà ce lieu, pas de gain supplémentaire
                </span>
              )}
            </div>
          )}
          <p className="place-rating-prompt-text">Qu'avez-vous pensé de ce lieu ?</p>
          <div className="place-rating-stars">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`place-rating-star${star <= ratingValue ? ' filled' : ''}`}
                onClick={() => setRatingValue(star)}
              >
                ★
              </button>
            ))}
          </div>
          {ratingValue > 0 && (
            <button className="place-rating-submit" onClick={submitRating}>
              Valider
            </button>
          )}
          <button className="place-rating-skip" onClick={finishRatingFlow}>
            Passer
          </button>
        </div>
      )}
      {showRating && ratingSaved && (
        <div className="place-rating-prompt">
          <p className="place-rating-prompt-text">Merci pour votre avis ! ⭐</p>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="place-exp-empty">Personne n'a encore exploré ce lieu en personne.</p>
      )}

      {showExplorersModal && (
        <PlaceExplorersModal
          explorers={sorted}
          authorId={authorId}
          guardianId={guardianIds[0] ?? null}
          factionColors={factionColors}
          onClose={() => setShowExplorersModal(false)}
        />
      )}
    </div>
  )
}

function DiscoveredPlaceContent({ place, onClose, userEmail: _userEmail, onRefetch }: { place: PlaceDetail; onClose: () => void; userEmail: string | null; onRefetch: () => void }) {
  const isAdmin = usePlayerStore(s => s.isAdmin)
  const userId = usePlayerStore(s => s.userId)
  const { calendarRef } = useCalendarRef()
  const [imageIndex, setImageIndex] = useState(0)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showAddressMenu, setShowAddressMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Onglet d'ouverture : posé par les notifications (ex. Cour → 'infos'). Lu une
  // seule fois au mount — PlaceContent remonte par key={place.id}, donc chaque
  // ouverture de lieu relit la cible courante. Défaut 'discussion'.
  const [activeTab, setActiveTab] = useState<PlacePanelActiveTab>(
    () => useMapStore.getState().selectedPlaceTab ?? 'discussion',
  )
  const tabsRef = useRef<HTMLDivElement>(null)
  const scrollToTab = useCallback((tab: PlacePanelActiveTab) => {
    setActiveTab(tab)
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(place.title)
  const [titleSaving, setTitleSaving] = useState(false)
  const [showEditDescr, setShowEditDescr] = useState(false)
  const [showEditTags, setShowEditTags] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddPhoto, setShowAddPhoto] = useState(false)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  // V0.7 — overrides (veilleur principal posé par loadInitialVeilles / pushVeilleOverride)
  const placeOverride = useMapStore(s => s.placeOverrides.get(place.id))

  // V0.9.56 — ids veilleurs dérivés de la veille RÉELLE du lieu (robuste, indépendant
  // de l'état de l'override carte) → badge 🛡️ sur TOUS les co-veilleurs.
  const { veille: panelVeille, refresh: refreshPanelVeille } = useVeille(place.id)
  useEffect(() => { void refreshPanelVeille() }, [refreshPanelVeille])
  const veilleurUserIds = panelVeille && !panelVeille.vacant
    ? panelVeille.members.map(m => m.userId)
    : (placeOverride?.veilleurUserIds ?? (placeOverride?.veilleurUserId ? [placeOverride.veilleurUserId] : []))

  // V0.5 detail data
  const [v05, setV05] = useState<V05Detail | null>(null)
  const [v05Key, setV05Key] = useState(0)

  // Faction visual data cache (colors only — svgs no longer needed since carnet cards were replaced)
  const [factionColors, setFactionColors] = useState<Map<string, string>>(new Map())

  // Fetch V0.5 detail + all faction visuals
  useEffect(() => {
    let cancelled = false
    async function loadV05() {
      const [{ data, error }, { data: allFactions }] = await Promise.all([
        supabase.rpc('get_place_detail_v05', { p_place_id: place.id, p_user_id: userId ?? null }),
        supabase.from('factions').select('id, color, pattern').order('order'),
      ])
      if (cancelled || error) return
      if (allFactions) {
        const colors = new Map<string, string>()
        for (const f of allFactions as Array<{ id: string; color: string; pattern: string }>) {
          colors.set(f.id, f.color)
        }
        setFactionColors(colors)
      }
      const d = data as V05Detail | null
      if (d) setV05(d)
    }
    loadV05()
    return () => { cancelled = true }
  }, [place.id, userId, v05Key])

  const refreshV05 = () => setV05Key(k => k + 1)

  // --- Data transformations ---

  const comments = useMemo<V05Contribution[]>(
    () => (v05?.contributions ?? []).filter(c => c.type === 'comment'),
    [v05?.contributions],
  )

  const galleryPhotos = useMemo(() => {
    const fromContrib = (v05?.contributions ?? [])
      .filter(c => c.type === 'comment' || c.type === 'photo' || c.type === 'description')
      .flatMap(c => c.images.map(url => ({ url, carnetId: c.id })))
    const fromPlace = (place.images ?? []).map(img => ({ url: img.url, carnetId: -1 }))
    const seen = new Set<string>()
    return [...fromContrib, ...fromPlace].filter(p => (seen.has(p.url) ? false : (seen.add(p.url), true)))
  }, [v05?.contributions, place.images])

  const heroPhotos = useMemo(() => galleryPhotos.map(p => p.url), [galleryPhotos])

  const isAuthor = place.author?.id === userId

  // Corriger la position : auteur ou visiteur. L'autorité reste la RPC serveur ;
  // ce booléen ne fait qu'afficher/masquer le point d'entrée.
  const canEditPosition = isAuthor || v05?.isExplorer === true

  // « Présence ou veille » — édite l'IDENTITÉ du lieu (titre, tags, description) :
  // ajouteur, venu sur place (GPS), ou veilleur. PAS la simple révélation au
  // brouillard. L'autorité reste la RPC (gate _can_edit_place_meta) ; ce booléen
  // ne fait qu'afficher/masquer les crayons.
  const isVeilleurMe = placeOverride?.veilleurUserId != null && placeOverride.veilleurUserId === userId
  const canEditMeta = isAuthor || v05?.isExplorer === true || isVeilleurMe

  const currentHeroPhotos = heroPhotos.length > 0 ? heroPhotos : []
  const heroPhotoUrl = currentHeroPhotos.length > 0
    ? currentHeroPhotos[imageIndex % currentHeroPhotos.length]
    : null

  // Average rating from v05
  const avgRating = v05?.avgRating ?? null
  const ratingCount = v05?.ratingCount ?? 0

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

  const cacheBust = useMemo(() => Date.now(), [place.id])

  // Hero gallery navigation
  const prevHero = () => setImageIndex(i => (i - 1 + currentHeroPhotos.length) % currentHeroPhotos.length)
  const nextHero = () => setImageIndex(i => (i + 1) % currentHeroPhotos.length)

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

  async function handleRenamePlace() {
    if (!userId || !titleDraft.trim() || titleDraft.trim() === place.title) {
      setEditingTitle(false)
      setTitleDraft(place.title)
      return
    }
    setTitleSaving(true)
    const { data, error } = await supabase.rpc('rename_place', {
      p_user_id: userId,
      p_place_id: place.id,
      p_title: titleDraft.trim(),
    })
    const result = data as { success?: boolean; title?: string; error?: string } | null
    if (!error && result?.success) {
      refreshV05()
      onRefetch()
    } else {
      setTitleDraft(place.title)
    }
    setTitleSaving(false)
    setEditingTitle(false)
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
            style={{ cursor: 'zoom-in' }}
            onClick={() => currentHeroPhotos.length > 0 && setLightbox({ photos: currentHeroPhotos, index: imageIndex % currentHeroPhotos.length })}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="place-hero-placeholder" />
        )}

        {/* Top-left: rating pill */}
        <div className="place-hero-top-left">
          {avgRating !== null && (
            <span className="place-hero-pill place-hero-rating">
              ★ {avgRating.toFixed(1)} {ratingCount > 0 && <span style={{ opacity: 0.7, fontSize: '0.85em' }}>({ratingCount})</span>}
            </span>
          )}
        </div>

        {/* Top-right: share + close buttons */}
        <div className="place-hero-top-right">
          <ShareButton placeName={place.title} placeSlug={place.slug} />
          <button onClick={onClose} className="place-hero-pill place-hero-pill-icon place-hero-close" aria-label="Fermer">
            &#10005;
          </button>
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

      {/* Photo slideshow strip — clic = change l'image du hero au-dessus */}
      <PhotoSlideshow
        photos={heroPhotos}
        activeIndex={currentHeroPhotos.length ? imageIndex % currentHeroPhotos.length : 0}
        onSelect={setImageIndex}
        onAddPhoto={() => setShowAddPhoto(true)}
        canAddPhoto={canEditMeta}
      />

      {/* Zone 2 — Body */}
      <div className="place-body">
        {/* Identity */}
        <div className="place-identity">
          <div className="place-title-row">
            {editingTitle ? (
              <div className="place-title-edit">
                <input
                  className="place-title-input"
                  type="text"
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenamePlace()
                    if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(place.title) }
                  }}
                  maxLength={255}
                  autoFocus
                  disabled={titleSaving}
                />
                <button className="place-title-edit-btn place-title-edit-ok" onClick={handleRenamePlace} disabled={titleSaving}>✓</button>
                <button className="place-title-edit-btn place-title-edit-cancel" onClick={() => { setEditingTitle(false); setTitleDraft(place.title) }}>✕</button>
              </div>
            ) : (
              <h2 className="place-title">
                {place.title}
                {canEditMeta && (
                  <button className="place-title-edit-pencil" onClick={() => setEditingTitle(true)} title="Renommer ce lieu">
                    ✏️
                  </button>
                )}
              </h2>
            )}
            <div className="place-title-actions">
              {v05 && (
                <WishlistButton placeId={place.id} isWishlisted={v05.isWishlisted} />
              )}
              {(isAdmin || canEditPosition) && (
                <div className="place-options-wrap">
                  <button
                    className="place-toolbar-btn"
                    onClick={() => setShowOptionsMenu(v => !v)}
                    aria-label="Options"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                  {showOptionsMenu && (
                    <>
                      <div className="place-options-backdrop" onClick={() => setShowOptionsMenu(false)} />
                      <div className="place-options-menu">
                        {canEditPosition && (
                          <button
                            className="place-options-item"
                            onClick={() => {
                              setShowOptionsMenu(false)
                              const m = useMapStore.getState()
                              m.setEditPositionTarget({
                                placeId: place.id,
                                lat: place.location.latitude,
                                lng: place.location.longitude,
                                address: place.address ?? '',
                              })
                              m.setMapPickerPurpose('editPosition')
                              m.setAddPlaceMode(true)
                            }}
                          >
                            ✏️ Corriger la position
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="place-options-item danger"
                            onClick={() => { setShowOptionsMenu(false); setShowDeleteConfirm(true) }}
                          >
                            Supprimer ce lieu
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tags + faction influence pill */}
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
            {canEditMeta && (
              <button
                className="place-tags-edit-pencil"
                onClick={() => setShowEditTags(true)}
                title="Modifier les types de ce lieu"
              >
                ✏️
              </button>
            )}
            {/* V0.7 phase 5 (6 mai) — pilule "Revendiqué par {nom}" retirée :
                redondante avec la section "Lieu protégé par Diane" affichée
                par CourtFold juste en-dessous du panel. */}
          </div>

          {/* Address */}
          {place.address && (
            <p className="place-address">
              <svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="place-address-text">{place.address}</span>
              <div className="place-goto-wrap">
                <button
                  className="place-goto-btn"
                  onClick={() => setShowAddressMenu(v => !v)}
                  title="Voir le lieu"
                  aria-haspopup="menu"
                  aria-expanded={showAddressMenu}
                >
                  <svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                </button>
                {showAddressMenu && (
                  <>
                    <div className="place-options-backdrop" onClick={() => setShowAddressMenu(false)} />
                    <div className="place-options-menu">
                      <button
                        className="place-options-item"
                        onClick={() => {
                          setShowAddressMenu(false)
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
                      >
                        🗺️ Voir sur la carte
                      </button>
                      <button
                        className="place-options-item"
                        onClick={() => {
                          setShowAddressMenu(false)
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${place.location.latitude},${place.location.longitude}`,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }}
                      >
                        📍 Google Maps
                      </button>
                      <button
                        className="place-options-item"
                        onClick={() => {
                          setShowAddressMenu(false)
                          window.open(
                            `https://www.waze.com/ul?ll=${place.location.latitude},${place.location.longitude}&navigate=yes`,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }}
                      >
                        🚗 Waze
                      </button>
                    </div>
                  </>
                )}
              </div>
            </p>
          )}

          {v05?.lastPositionEdit && (
            <p className="place-position-edited info-meta">
              📍 Position modifiée par {v05.lastPositionEdit.editorName ?? 'un joueur'}
              {' · '}{formatRelativeTime(v05.lastPositionEdit.createdAt)}
            </p>
          )}

          {/* Quick info row: views + accessibility + season + warning */}
          <div className="place-quick-infos">
            <span className="place-quick-info">
              <svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {place.metrics.views}
            </span>
            <QuickInfoChip
              icon={<svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>}
              value={infoFields.find(i => i.type === 'accessibility')?.content ?? null}
              placeholder="Accessibilité"
              onClick={() => scrollToTab('infos')}
            />
            <QuickInfoChip
              icon={<svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66L12 14"/><path d="M2 12h4"/><path d="M20 12h2"/><path d="M7.8 5.2l2.8 2.8"/><path d="M16.2 5.2l-2.8 2.8"/><path d="M12 2v4"/></svg>}
              value={infoFields.find(i => i.type === 'season')?.content ?? null}
              placeholder="Saison"
              onClick={() => scrollToTab('infos')}
            />
            <QuickInfoChip
              icon={<svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              value={infoFields.find(i => i.type === 'warning')?.content ?? null}
              placeholder="Info"
              onClick={() => scrollToTab('infos')}
            />
            <QuickInfoChip
              icon={<svg className="place-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>}
              value={place.eraName ? (place.yearExact !== null ? `${place.eraName} — ${formatYear(place.yearExact, calendarRef)}` : place.eraName) : null}
              placeholder="Époque"
              onClick={() => scrollToTab('infos')}
            />
          </div>

          {/* Explorers row with role badges */}
          {v05 && (
            <ExplorerRow
              explorers={v05.explorers ?? []}
              authorId={place.author?.id ?? null}
              guardianIds={veilleurUserIds}
              factionColors={factionColors}
              placeId={place.id}
              placeTitle={place.title}
              placeLocation={place.location}
              isExplorer={v05.isExplorer}
              onVisited={() => { refreshV05(); onRefetch() }}
            />
          )}
        </div>

        {/* V0.7 phase 5 — La Cour : repliée, toujours visible au-dessus des onglets. */}
        <CourtFold
          placeId={place.id}
          placeTitle={place.title}
          veilleurName={placeOverride?.veilleurName ?? null}
          defaultOpen={false}
        />

        {/* Description collaborative */}
        <PlaceDescription description={v05?.description ?? null} canEdit={canEditMeta}
          onEdit={() => setShowEditDescr(true)} onOpenHistory={() => setShowHistory(true)} onChanged={refreshV05} />

        {/* Zone 4 — Tabs */}
        <div className="place-tabs" ref={tabsRef}>
          <button
            className={`place-tab${activeTab === 'discussion' ? ' active' : ''}`}
            onClick={() => setActiveTab('discussion')}
          >
            Discussion <span className="place-tab-lenght">{comments.length}</span>
          </button>
          <button
            className={`place-tab${activeTab === 'galerie' ? ' active' : ''}`}
            onClick={() => setActiveTab('galerie')}
          >
            Galerie
            <span className="place-tab-lenght">{galleryPhotos.length}</span>
          </button>
          <button
            className={`place-tab${activeTab === 'infos' ? ' active' : ''}`}
            onClick={() => scrollToTab('infos')}
          >
            Infos
            <span className="place-tab-lenght">{infoFields.length}</span>
          </button>
          {isAdmin && (
            <button
              className={`place-tab place-tab-admin${activeTab === 'admin' ? ' active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              Admin
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 'discussion' && (
          <div className="place-tab-content">
            <DiscussionThread placeId={place.id} comments={comments}
              onPhotoOpen={(p, i) => setLightbox({ photos: p, index: i })} onChanged={refreshV05} />
          </div>
        )}

        {activeTab === 'galerie' && (
          <div className="place-tab-content">
            <PlaceGallery photos={galleryPhotos} onPhotoOpen={(p, i) => setLightbox({ photos: p, index: i })} />
          </div>
        )}

        {activeTab === 'infos' && (
          <div className="place-tab-content">
            <PlaceInfos
              placeId={place.id}
              infos={infoFields}
              eraId={place.eraId ?? null}
              eraName={place.eraName ?? null}
              yearExact={place.yearExact ?? null}
              onRefresh={() => { refreshV05(); onRefetch() }}
            />
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="place-tab-content">
            <div className="place-admin-debug">
              <div className="place-admin-debug-title">Données du lieu</div>
              <div>ID: <span className="mono">{place.id}</span></div>
              <div>Auteur: {place.author?.lastName ?? '—'} ({place.author?.id})</div>
              <div>Vues: {place.metrics.views} · Likes: {place.metrics.likes} · Explo: {place.metrics.explored}</div>
              <div>Note ancienne: {place.metrics.note?.toFixed(1) ?? '—'}</div>
              {v05 && (
                <>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>V0.5 Influence</div>
                  {v05.influence.map(i => (
                    <div key={i.factionId}>
                      {i.factionId}: placé={i.placed} contenu={i.content} total={i.total}
                    </div>
                  ))}
                  <div>Dominant: {v05.dominantFaction ?? '—'}</div>
                  <div>Gardien: {v05.guardian?.name ?? '—'}</div>
                  <div>Explorateurs: {v05.explorers?.length ?? 0}</div>
                  <div>Contributions: {v05.contributions?.length ?? 0}</div>
                  <div>Note moy: {avgRating?.toFixed(1) ?? '—'} ({ratingCount} avis GPS)</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modales flottantes (portal vers body) */}
      {showEditDescr && (
        <DescriptionEditModal
          placeId={place.id}
          initial={v05?.description?.content ?? ''}
          onClose={() => setShowEditDescr(false)}
          onSaved={() => { setShowEditDescr(false); refreshV05() }}
        />
      )}
      {showHistory && (
        <DescriptionHistoryModal
          placeId={place.id}
          canRestore={canEditMeta}
          onClose={() => setShowHistory(false)}
          onRestored={() => { setShowHistory(false); refreshV05() }}
        />
      )}
      {showEditTags && (
        <EditPlaceTagsModal
          placeId={place.id}
          currentTagIds={place.tags.map(t => t.id)}
          onClose={() => setShowEditTags(false)}
          onSaved={() => { setShowEditTags(false); refreshV05(); onRefetch() }}
        />
      )}
      {showAddPhoto && (
        <AddPhotoModal
          placeId={place.id}
          onClose={() => setShowAddPhoto(false)}
          onSaved={() => { setShowAddPhoto(false); refreshV05() }}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(idx) => setLightbox(prev => prev ? { ...prev, index: idx } : null)}
        />
      )}
    </>
  )
}
