import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/imageUtils'
import { usePlayerStore } from '../../stores/playerStore'
import shopIcon from '../../assets/shop_icon.webp'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { FactionMembersModal } from './FactionMembersModal'

interface PlaceCard {
  id: string
  title: string
  type: string
  imageUrl: string | null
}

interface AuthoredPlace extends PlaceCard {
  createdAt: string
}

type PlacesTab = 'authored' | 'discovered' | 'claimed'

interface TitleInfo {
  id: number
  name: string
  icon: string
  icon_url?: string
}

interface PlayerProfile {
  userId: string
  name: string
  factionId: string | null
  factionTitle: string | null
  factionColor: string | null
  factionPattern: string | null
  profileImage: string | null
  notorietyPoints: number
  joinedAt: string
  displayedGeneralTitles: TitleInfo[] | null
  factionTitle2: TitleInfo | null
  biography: string
  instagram: string | null
  authoredPlaces: AuthoredPlace[]
  discoveredPlaces: PlaceCard[]
  claimedPlaces: PlaceCard[]
  claimedCount: number
  unlockedGeneralTitles: Array<{ id: number; name: string; icon: string; unlocks: string[]; order: number }> | null
}

interface Props {
  playerId: string
  onClose: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PlayerProfileModal({ playerId, onClose }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const currentUserId = usePlayerStore(s => s.userId)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [placesTab, setPlacesTab] = useState<PlacesTab>('authored')
  const [visibleCount, setVisibleCount] = useState(12)
  const [showFactionMembers, setShowFactionMembers] = useState(false)
  const [showFragmentStore, setShowFragmentStore] = useState(false)
  const [allFragments, setAllFragments] = useState<Array<{ id: number; name: string; description: string | null; icon: string | null; image_url: string | null; link_url: string | null; bonus_type: string | null; bonus_value: number; ability_type: string | null; owned: boolean }>>([])
  const [loadingFragments, setLoadingFragments] = useState(false)
  const [showTitlePicker, setShowTitlePicker] = useState(false)
  const [titleCategories, setTitleCategories] = useState<{
    gameTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; condition?: { stat: string; min?: number; rank?: number } }>
    factionTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; condition?: { stat: string; min?: number; rank?: number } }>
    fragmentTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; source_label: string }>
  }>({ gameTitles: [], factionTitles: [], fragmentTitles: [] })
  const [playerStats, setPlayerStats] = useState<Record<string, number>>({})
  const [selectedTitleIds, setSelectedTitleIds] = useState<number[]>([])
  const [savingTitles, setSavingTitles] = useState(false)
  const [playerFragments, setPlayerFragments] = useState<Array<{ id: number; name: string; icon: string | null; icon_url: string | null; image_url: string | null; link_url: string | null; collection: string | null; bonus_type: string | null; bonus_value: number; ability_type: string | null }>>([])

  const isSelf = profile?.userId === currentUserId

  useEffect(() => {
    async function load() {
      const [profileRes, fragmentsRes] = await Promise.all([
        supabase.rpc('get_player_profile', { p_user_id: playerId }),
        supabase.rpc('get_user_fragments', { p_user_id: playerId }),
      ])
      if (profileRes.data) {
        const p = profileRes.data as unknown as PlayerProfile
        setProfile(p)
        setEditBio(p.biography ?? '')
        setEditInstagram(p.instagram ?? '')
      }
      if (fragmentsRes.data && Array.isArray(fragmentsRes.data)) {
        setPlayerFragments(fragmentsRes.data as Array<{ id: number; name: string; icon: string | null; icon_url: string | null; image_url: string | null; link_url: string | null; collection: string | null; bonus_type: string | null; bonus_value: number; ability_type: string | null }>)
      }
      setLoading(false)
    }
    load()
  }, [playerId])

  function handleStartEdit() {
    if (!profile) return
    setEditName(profile.name ?? '')
    setEditBio(profile.biography ?? '')
    setEditInstagram(profile.instagram ?? '')
    setAvatarFile(null)
    setAvatarPreview(null)
    setIsEditing(true)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }


  async function openFragmentCollection() {
    setShowFragmentStore(true)
    setLoadingFragments(true)
    const uid = currentUserId || playerId
    const { data } = await supabase.rpc('get_all_fragments', { p_user_id: uid })
    if (data && Array.isArray(data)) {
      setAllFragments(data as typeof allFragments)
    }
    setLoadingFragments(false)
  }

  async function openTitlePicker() {
    if (!currentUserId) return
    setShowTitlePicker(true)

    const { data } = await supabase.rpc('get_all_player_titles', { p_user_id: currentUserId })
    if (data) {
      const d = data as {
        gameTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; condition?: { stat: string; min?: number; rank?: number } }> | null
        factionTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; condition?: { stat: string; min?: number; rank?: number } }> | null
        fragmentTitles: Array<{ id: number; name: string; icon: string | null; description: string | null; icon_url: string | null; image_url: string | null; unlocked: boolean; source_label: string }> | null
        displayedIds: number[]
        stats?: Record<string, number>
      }
      setTitleCategories({
        gameTitles: d.gameTitles ?? [],
        factionTitles: d.factionTitles ?? [],
        fragmentTitles: d.fragmentTitles ?? [],
      })
      setSelectedTitleIds(d.displayedIds ?? [])
      if (d.stats) setPlayerStats(d.stats)
    }
  }

  const STAT_LABELS: Record<string, string> = {
    discoveries: 'découvertes',
    claims: 'protections',
    notoriety: 'gloire',
    likes: 'likes',
    fortifications: 'fortifications',
    places_added: 'lieux ajoutés',
  }

  function formatProgress(condition?: { stat: string; min?: number; rank?: number }): string | null {
    if (!condition) return null
    const stat = condition.stat
    const current = playerStats[stat] ?? 0
    if (condition.min != null) {
      return `${current} / ${condition.min} ${STAT_LABELS[stat] ?? stat}`
    }
    if (condition.rank != null) {
      return `Top ${condition.rank} ${STAT_LABELS[stat] ?? stat}`
    }
    return null
  }

  function toggleTitle(titleId: number) {
    setSelectedTitleIds(prev => {
      if (prev.includes(titleId)) return prev.filter(id => id !== titleId)
      if (prev.length >= 3) return prev
      return [...prev, titleId]
    })
  }

  async function saveTitles() {
    if (!currentUserId) return
    setSavingTitles(true)
    await supabase.rpc('set_displayed_titles_v3', {
      p_user_id: currentUserId,
      p_title_ids: selectedTitleIds,
    })

    // Mettre à jour le primaryTitle dans le store (premier titre = carte)
    const allTitlesFlat = [...titleCategories.factionTitles, ...titleCategories.gameTitles, ...titleCategories.fragmentTitles]
    const selectedTitles = selectedTitleIds
      .map(id => allTitlesFlat.find(t => t.id === id))
      .filter(Boolean) as Array<{ id: number; name: string; icon: string | null; icon_url: string | null }>

    if (selectedTitles.length > 0) {
      const first = selectedTitles[0]
      const prefix = first.icon_url ? '' : (first.icon ?? '')
      usePlayerStore.getState().setPrimaryTitle(`${prefix} ${first.name}`.trim())
    }

    // Mettre à jour le profil local avec les titres sélectionnés
    if (profile) {
      setProfile({
        ...profile,
        displayedGeneralTitles: selectedTitles.map(t => ({ id: t.id, name: t.name, icon: t.icon ?? '', icon_url: t.icon_url ?? undefined })),
      })
    }

    setSavingTitles(false)
    setShowTitlePicker(false)
  }

  async function handleSave() {
    if (!currentUserId || !profile) return
    setSaving(true)

    let avatarUrl: string | undefined

    // Upload avatar si changé
    if (avatarFile) {
      const compressed = await compressImage(avatarFile, 400)
      const path = `${currentUserId}/avatar.webp`
      // Supprimer l'ancien avatar (policy DELETE exige que le dossier = userId)
      await supabase.storage.from('place-images').remove([path])
      const { error: uploadErr } = await supabase.storage
        .from('place-images')
        .upload(path, compressed, { contentType: 'image/webp' })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('place-images').getPublicUrl(path)
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
      }
    }

    await Promise.all([
      supabase.rpc('update_my_profile', {
        p_user_id: currentUserId,
        p_first_name: editName,
        p_bio: editBio,
        p_instagram: editInstagram,
        p_avatar_url: avatarUrl ?? null,
      }),
    ])

    const { data } = await supabase.rpc('get_player_profile', { p_user_id: currentUserId })
    if (data) setProfile(data as unknown as PlayerProfile)

    usePlayerStore.getState().setUserName(editName)
    if (avatarUrl) {
      usePlayerStore.getState().setUserAvatarUrl(avatarUrl)
    }
    setAvatarFile(null)
    setAvatarPreview(null)
    setIsEditing(false)
    setSaving(false)
  }

  function handlePlaceClick(placeId: string) {
    onClose()
    useMobileNavStore.getState().closePanel()
    useMapStore.getState().setSelectedPlaceId(placeId)
  }

  const isMobile = window.innerWidth <= 768

  const modal = (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="player-modal" onClick={e => e.stopPropagation()}>
        <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        {loading && <div className="player-modal-loading">Chargement...</div>}

        {!loading && !profile && <div className="player-modal-loading">Joueur introuvable</div>}

        {!loading && profile && (
          <>
            <div className="player-modal-header">

            {/* Top row : avatar left, info right */}
            <div className="player-modal-top">
              <div
                className={`player-modal-avatar-wrap${isEditing && isSelf ? ' editable' : ''}`}
                onClick={() => { if (isEditing && isSelf) avatarInputRef.current?.click() }}
              >
                {(avatarPreview || profile.profileImage) ? (
                  <img
                    src={avatarPreview ?? profile.profileImage!}
                    alt={profile.name}
                    className="player-modal-avatar"
                    style={{ borderColor: profile.factionColor ?? '#8A7B6A' }}
                  />
                ) : (
                  <div
                    className="player-modal-avatar-fallback"
                    style={{ background: profile.factionColor ?? '#8A7B6A' }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {isEditing && isSelf && (
                  <span className="player-modal-avatar-edit-label">Modifier</span>
                )}
                {profile.factionPattern && !isEditing && (
                  <img
                    src={profile.factionPattern}
                    alt=""
                    className="player-modal-faction-badge clickable"
                    onClick={(e) => { e.stopPropagation(); setShowFactionMembers(true) }}
                    title={profile.factionTitle ?? 'Héritage'}
                  />
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  hidden
                />
              </div>

              <div className="player-modal-info">
                <div className="player-modal-info-top">
                  <h2 className="player-modal-name">{profile.name}</h2>
                  {isSelf && !isEditing && (
                    <button className="player-modal-edit-btn" onClick={handleStartEdit} aria-label="Modifier">
                      {'\u270F\uFE0F'}
                    </button>
                  )}
                </div>

                <div className="player-modal-counts">
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.authoredPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">lieux</span>
                  </div>
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.discoveredPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">visités</span>
                  </div>
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.claimedPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">Veillés</span> 
                  </div>
                </div>

                <div className="player-modal-faction-row">
                  <span className="player-modal-notoriety">
                    {'\uD83C\uDFC5'} {profile.notorietyPoints}
                  </span>
                </div>
              </div>
            </div>

            {/* Titres */}
            <div className="player-modal-titles" style={{ '--faction-color': profile.factionColor ?? undefined } as React.CSSProperties}>
              {profile.displayedGeneralTitles?.map((t: { id: number; name: string; icon?: string; icon_url?: string }) => (
                <span key={t.id} className="title-badge title-badge-general">
                  {t.icon_url ? (
                    <img src={t.icon_url} alt="" className="title-badge-img" />
                  ) : t.icon ? (
                    <span>{t.icon}</span>
                  ) : null}
                  {t.name}
                </span>
              ))}
              {isSelf && !isEditing && (
                <button className="title-badge title-badge-edit" onClick={openTitlePicker}>
                  {'\u270F\uFE0F'}
                </button>
              )}
            </div>

            {/* Bio + Instagram (mode lecture) */}
            {!isEditing && (
              <>
                {profile.biography && (
                  <p className="player-modal-bio">{profile.biography}</p>
                )}
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="player-modal-instagram"
                  >
                    <svg className="player-modal-instagram-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    {profile.instagram.replace(/^@/, '')}
                  </a>
                )}
                <p className="player-modal-joined">
                  Explorateur depuis le {formatDate(profile.joinedAt)}
                </p>
              </>
            )}

            {/* Mode edition */}
            {isEditing && isSelf && (
              <div className="player-modal-edit-form">
                <label className="player-modal-edit-label">Nom</label>
                <input
                  className="player-modal-edit-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Votre nom d'explorateur"
                  maxLength={50}
                />

                <label className="player-modal-edit-label">Biographie</label>
                <div className="player-modal-edit-textarea-wrap">
                  <textarea
                    className="player-modal-edit-textarea"
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    placeholder="Votre biographie..."
                    maxLength={280}
                  />
                  <span className={`player-modal-edit-charcount${editBio.length > 250 ? ' warn' : ''}`}>
                    {editBio.length}/280
                  </span>
                </div>

                <label className="player-modal-edit-label">Instagram</label>
                <input
                  className="player-modal-edit-input"
                  value={editInstagram}
                  onChange={e => setEditInstagram(e.target.value)}
                  placeholder="@votre_compte"
                />

                <div className="player-modal-edit-actions">
                  <button
                    className="player-modal-cancel-btn"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                  >
                    Annuler
                  </button>
                  <button
                    className="player-modal-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            )}
            </div>

            {/* Fragments possedes — badges ronds compacts */}
            <div className="player-modal-fragments">
              <div className="player-modal-fragments-wrapper">
                {playerFragments.length > 4 && (
                  <button
                    className="fragments-arrow fragments-arrow--left"
                    onClick={() => {
                      const el = document.querySelector('.player-modal-fragments-row')
                      if (el) el.scrollBy({ left: -200, behavior: 'smooth' })
                    }}
                  >&#8249;</button>
                )}
              <div className="player-modal-fragments-row">
                {playerFragments.map(f => {
                  const ABILITY_LABELS: Record<string, string> = {
                    free_discover: '🔍 1x/j',
                    free_claim: '🛡️ 1x/j',
                    double_glory: '🏅 x2/j',
                    distance_ignore: '📍 0/j',
                  }
                  const bonusLabel = f.bonus_type && f.bonus_value
                    ? `${f.bonus_value > 0 ? '+' : ''}${f.bonus_value} ${f.bonus_type.replace('max_energy', '⚡ max').replace('regen_energy', '% regen ⚡').replace('max_conquest', '⚡ max').replace('max_construction', '⚡ max').replace('regen_conquest', '% regen ⚡').replace('regen_construction', '% regen ⚡').replace('max_vitalite', '⚡ max').replace('regen_vitalite', '% regen ⚡')}`
                    : null
                  const abilityLabel = f.ability_type ? ABILITY_LABELS[f.ability_type] ?? null : null
                  return (
                    <div
                      key={f.id}
                      className="player-modal-fragment-badge"
                      onClick={openFragmentCollection}
                      style={{ position: 'relative' }}
                    >
                      {f.image_url ? (
                        <img src={f.image_url} alt={f.name} className="player-modal-fragment-badge-img" />
                      ) : (
                        <span className="player-modal-fragment-badge-icon">{f.icon ?? '?'}</span>
                      )}
                      {(bonusLabel || abilityLabel) && (
                        <span className="player-modal-fragment-bonus">
                          {bonusLabel}{bonusLabel && abilityLabel ? ' · ' : ''}{abilityLabel}
                        </span>
                      )}
                    </div>
                  )
                })}
                {isSelf && (
                  <button
                    className="player-modal-fragment-badge player-modal-fragment-badge-add"
                    onClick={openFragmentCollection}
                  >
                    +
                  </button>
                )}
              </div>
                {playerFragments.length > 4 && (
                  <button
                    className="fragments-arrow fragments-arrow--right"
                    onClick={() => {
                      const el = document.querySelector('.player-modal-fragments-row')
                      if (el) el.scrollBy({ left: 200, behavior: 'smooth' })
                    }}
                  >&#8250;</button>
                )}
              </div>
            </div>

            {/* Places tabs */}
            <div className="player-modal-places">
              <div className="player-modal-tabs">
                <button
                  className={`player-modal-tab${placesTab === 'authored' ? ' active' : ''}`}
                  onClick={() => { setPlacesTab('authored'); setVisibleCount(12) }}
                >
                  Ajoutés <span className="player-modal-tabs-number">{profile.authoredPlaces?.length ?? 0}</span>
                </button>
                <button
                  className={`player-modal-tab${placesTab === 'discovered' ? ' active' : ''}`}
                  onClick={() => { setPlacesTab('discovered'); setVisibleCount(12) }}
                >
                  Visités  <span className="player-modal-tabs-number">{profile.discoveredPlaces?.length ?? 0}</span>
                </button>
                <button
                  className={`player-modal-tab${placesTab === 'claimed' ? ' active' : ''}`}
                  onClick={() => { setPlacesTab('claimed'); setVisibleCount(12) }}
                >
                  Veillés  <span className="player-modal-tabs-number">{profile.claimedPlaces?.length ?? 0}</span>
                </button>
              </div>

              {(() => {
                const places: PlaceCard[] =
                  placesTab === 'authored' ? (profile.authoredPlaces ?? []) :
                  placesTab === 'discovered' ? (profile.discoveredPlaces ?? []) :
                  (profile.claimedPlaces ?? [])

                if (places.length === 0) return (
                  <div className="player-modal-places-empty">Aucun lieu</div>
                )

                const visible = places.slice(0, visibleCount)
                const hasMore = places.length > visibleCount

                return (
                  <>
                    <div className="player-modal-places-grid">
                      {visible.map(place => (
                        <div
                          key={place.id}
                          className="player-modal-place-card"
                          onClick={() => handlePlaceClick(place.id)}
                        >
                          {place.imageUrl ? (
                            <img src={place.imageUrl} alt={place.title} className="player-modal-place-img" loading="lazy" />
                          ) : (
                            <div className="player-modal-place-img-fallback">
                              {'\uD83C\uDFDB\uFE0F'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {hasMore && (
                      <button
                        className="player-modal-show-more"
                        onClick={() => setVisibleCount(c => c + 12)}
                      >
                        Voir plus ({places.length - visibleCount} restants)
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>

      {showFragmentStore && (
        <div className="player-modal-overlay" onClick={() => setShowFragmentStore(false)} style={{ zIndex: 10002 }}>
          <div className="player-modal fragment-collection-modal" onClick={e => e.stopPropagation()}>
            <button className="player-modal-close" onClick={() => setShowFragmentStore(false)}>&#10005;</button>
            <h3 className="fragment-collection-title">Vos fragments</h3>
            <p className="fragment-collection-subtitle">
              Chez Runes de Chêne, nos illustrations originales sont appelées <b>Fragments</b>. Achetée sur la <u><a href="https://runesdechene.com"><b>Boutique officielle</b></a></u>, elles augmentent vos compétences.
            </p>

            {loadingFragments ? (
              <p style={{ textAlign: 'center', color: '#8A7B6A', fontStyle: 'italic', padding: '2rem 0' }}>Chargement...</p>
            ) : (
              <div className="frag-grid">
                {allFragments.map(f => (
                  <div key={f.id} className={`frag-grid-card${f.owned ? ' owned' : ''}`}>
                    <div className="frag-grid-img-wrap">
                      {f.image_url ? (
                        <img src={f.image_url} alt="" className="frag-grid-img" />
                      ) : (
                        <span className="frag-grid-emoji">{f.icon ?? '?'}</span>
                      )}
                      {f.owned && <span className="frag-grid-badge-owned">Possédé</span>}
                    </div>
                    <div className="frag-grid-info">
                      <h3 className="frag-grid-name">{f.name}</h3>
                      {f.description && <p className="frag-grid-desc">{f.description}</p>}
                      {f.bonus_type && f.bonus_value !== 0 && (
                        <span className="frag-grid-bonus">
                          {f.bonus_value > 0 ? '+' : ''}{f.bonus_value} {f.bonus_type.replace('max_energy', '⚡ max').replace('regen_energy', '% regen ⚡').replace('max_conquest', '⚡ max').replace('max_construction', '⚡ max').replace('regen_conquest', '% regen ⚡').replace('regen_construction', '% regen ⚡').replace('max_vitalite', '⚡ max').replace('regen_vitalite', '% regen ⚡')}
                        </span>
                      )}
                      {f.ability_type && (
                        <span className="frag-grid-bonus">
                          {f.ability_type === 'free_discover' && '🔍 Découverte gratuite 1x/jour'}
                          {f.ability_type === 'free_claim' && '🛡️ Protection gratuite 1x/jour'}
                          {f.ability_type === 'double_glory' && '🏅 Double Gloire 1x/jour'}
                          {f.ability_type === 'distance_ignore' && '📍 Ignorer la distance 1x/jour'}
                        </span>
                      )}
                      {f.link_url && (
                        <button className="frag-grid-shop-btn" onClick={() => window.open(f.link_url!, '_blank', 'noopener,noreferrer')}>
                          <img src={shopIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4, display: 'inline' }} />Acheter
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '12px 0 0', textAlign: 'center' }}>
              <a href="https://hub.runesdechene.com/soumettre-contenu" target="_blank" rel="noopener noreferrer" style={{ color: '#8A7B6A', fontSize: 11, textDecoration: 'none' }}>
                J'ai deja achete — Reclamer mes fragments
              </a>
            </div>
          </div>
        </div>
      )}

      {showTitlePicker && (
        <div className="player-modal-overlay" onClick={() => setShowTitlePicker(false)} style={{ zIndex: 10002 }}>
          <div className="player-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '85vh', overflow: 'auto', padding: '24px', alignItems: 'stretch' }}>
            <button className="player-modal-close" onClick={() => setShowTitlePicker(false)}>&#10005;</button>
            <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-accent)', textAlign: 'left' }}>Choisissez vos titres</h3>
            <p style={{ fontSize: 12, color: '#8A7B6A', margin: '0 0 16px', textAlign: 'left' }}>
              Max 3 titres. Le premier sera affiché sur la carte.
            </p>

            {titleCategories.gameTitles.length === 0 && titleCategories.factionTitles.length === 0 && titleCategories.fragmentTitles.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#8A7B6A', fontStyle: 'italic', padding: '1rem 0' }}>Chargement...</p>
            ) : (
              <>
                {(titleCategories.gameTitles.length > 0 || titleCategories.factionTitles.length > 0) && (
                  <div className="title-picker-category">
                    <span className="title-picker-category-label">Titres de jeu</span>
                    <div className="title-picker-grid">
                      {[...titleCategories.factionTitles.filter(t => t.unlocked), ...titleCategories.gameTitles].map(t => {
                        const isSelected = selectedTitleIds.includes(t.id)
                        const rank = isSelected ? selectedTitleIds.indexOf(t.id) + 1 : null
                        const progress = !t.unlocked ? formatProgress(t.condition) : null
                        const pct = !t.unlocked && t.condition?.min ? Math.min(100, Math.round(((playerStats[t.condition.stat] ?? 0) / t.condition.min) * 100)) : null
                        return (
                          <button
                            key={`game-${t.id}`}
                            className={`title-picker-item${isSelected ? ' selected' : ''}${!t.unlocked ? ' locked' : ''}`}
                            onClick={() => (t.unlocked || isSelected) && toggleTitle(t.id)}
                            disabled={!t.unlocked && !isSelected || (!isSelected && selectedTitleIds.length >= 3)}
                          >
                            {rank && <span className="title-picker-rank">{rank}</span>}
                            {t.icon_url ? (
                              <img src={t.icon_url} alt="" className="title-picker-img" />
                            ) : (
                              <span className="title-picker-icon">{t.icon ?? ''}</span>
                            )}
                            <span className="title-picker-name">{t.name}</span>
                            {t.unlocked && t.description && <span className="title-picker-desc">{t.description}</span>}
                            {progress && (
                              <span className="title-picker-progress">
                                <span className="title-picker-progress-bar">
                                  <span className="title-picker-progress-fill" style={{ width: `${pct}%` }} />
                                </span>
                                <span className="title-picker-progress-text">{progress}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {titleCategories.fragmentTitles.length > 0 && (
                  <div className="title-picker-category">
                    <span className="title-picker-category-label">Titres de fragment</span>
                    <div className="title-picker-grid">
                      {titleCategories.fragmentTitles.map(t => {
                        const isSelected = selectedTitleIds.includes(t.id)
                        const rank = isSelected ? selectedTitleIds.indexOf(t.id) + 1 : null
                        return (
                          <button
                            key={`frag-${t.id}`}
                            className={`title-picker-item${isSelected ? ' selected' : ''}${!t.unlocked ? ' locked' : ''}`}
                            onClick={() => (t.unlocked || isSelected) && toggleTitle(t.id)}
                            disabled={!t.unlocked && !isSelected || (!isSelected && selectedTitleIds.length >= 3)}
                          >
                            {rank && <span className="title-picker-rank">{rank}</span>}
                            {t.icon_url ? (
                              <img src={t.icon_url} alt="" className="title-picker-img" />
                            ) : (
                              <span className="title-picker-icon">{t.icon ?? ''}</span>
                            )}
                            <span className="title-picker-name">{t.name}</span>
                            {t.description && <span className="title-picker-desc">{t.description}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="title-picker-actions">
              <button className="player-modal-cancel-btn" onClick={() => setShowTitlePicker(false)} disabled={savingTitles}>
                Annuler
              </button>
              <button className="player-modal-save-btn" onClick={saveTitles} disabled={savingTitles}>
                {savingTitles ? 'Sauvegarde...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFactionMembers && profile?.factionId && (
        <FactionMembersModal
          factionId={profile.factionId}
          factionTitle={profile.factionTitle ?? ''}
          factionColor={profile.factionColor ?? '#8A7B6A'}
          onClose={() => setShowFactionMembers(false)}
        />
      )}
    </div>
  )

  return isMobile ? createPortal(modal, document.body) : modal
}
