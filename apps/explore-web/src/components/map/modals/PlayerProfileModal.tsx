import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { uploadAvatar } from '../../../lib/avatarUpload'
import { formatFrenchLongDate } from '../../../lib/dateFormat'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCoupe } from '../../../hooks/useCoupe'
import shopIcon from '../../../assets/shop_icon.webp'
import { useMapStore } from '../../../stores/mapStore'
import { useMobileNavStore } from '../../../stores/mobileNavStore'
import { FactionMembersModal } from './FactionMembersModal'
import { VeteranBadge } from '../../profile/VeteranBadge'
import { GloryProgressBar } from '../../profile/GloryProgressBar'
import { LevelText } from '../../profile/LevelText'
import { useMutedUsers } from '../../../hooks/useMutedUsers'
import type { PlayerProfile, PlacesTab, PlaceCard } from '../../../types/playerProfile'
import { formatTitleProgress } from '../../../lib/titleProgress'

interface Props {
  playerId: string
  onClose: () => void
}

export function PlayerProfileModal({ playerId, onClose }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const currentUserId = usePlayerStore(s => s.userId)
  const { state: coupeState } = useCoupe(true)
  const level = usePlayerStore(s => s.level)
  const xpTotal = usePlayerStore(s => s.xpTotal)
  const xpToNextLevel = usePlayerStore(s => s.xpToNextLevel)
  const xpForNextLevel = usePlayerStore(s => s.xpForNextLevel)
  const xpForCurrentLevel = usePlayerStore(s => s.xpForCurrentLevel)
  const veteranFirstEra = usePlayerStore(s => s.veteranFirstEra)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  // V0.7+ Refonte 2026-05-02 : plus d'onglets — 3 carrousels horizontaux empilés.
  // Si > CAROUSEL_CAP : tile "Voir tout (N)" à la fin → overlay grid.
  const [viewAllSection, setViewAllSection] = useState<PlacesTab | null>(null)
  const [showFactionMembers, setShowFactionMembers] = useState(false)
  const [showFragmentStore, setShowFragmentStore] = useState(false)
  const [allFragments, setAllFragments] = useState<Array<{ id: number; name: string; description: string | null; icon: string | null; image_url: string | null; link_url: string | null; owned: boolean }>>([])
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
  const [playerFragments, setPlayerFragments] = useState<Array<{ id: number; name: string; icon: string | null; icon_url: string | null; image_url: string | null; link_url: string | null; collection: string | null }>>([])

  const { isMuted, muteUser, unmuteUser } = useMutedUsers()

  const isSelf = profile?.userId === currentUserId

  // V0.9.53 — « Étendard planté sur… » = GPS pur (by_influence false). Les lieux
  // tenus à distance via La Cour ne comptent que dans le badge « lieux protégés »
  // (veilledPlaces.length, total). plantedPlaces alimente le carrousel + son « voir tout ».
  const plantedPlaces = (profile?.veilledPlaces ?? []).filter(p => !p.byInfluence)

  // V070 — toast d'énigme de fragment cliquable : si le mapStore demande
  // l'ouverture de la galerie Fragments, on l'ouvre ici (le profil chargé
  // est nécessaire pour que get_all_fragments retourne les bonnes données).
  const pendingOpenFragmentStore = useMapStore(s => s.pendingOpenFragmentStore)
  const clearPendingOpenFragmentStore = useMapStore(s => s.clearPendingOpenFragmentStore)
  useEffect(() => {
    if (pendingOpenFragmentStore && profile) {
      openFragmentCollection()
      clearPendingOpenFragmentStore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenFragmentStore, profile])

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
        setPlayerFragments(fragmentsRes.data as typeof playerFragments)
      }
      setLoading(false)
    }
    load()
  }, [playerId])

  async function handleToggleMute() {
    try {
      if (isMuted(playerId)) await unmuteUser(playerId)
      else await muteUser(playerId)
    } catch (err) {
      console.warn('[PlayerProfileModal] mute toggle failed', err)
    }
  }

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

    // Mettre à jour displayedTitles dans le store (tous les titres affichés sur la carte)
    const allTitlesFlat = [...titleCategories.factionTitles, ...titleCategories.gameTitles, ...titleCategories.fragmentTitles]
    const selectedTitles = selectedTitleIds
      .map(id => allTitlesFlat.find(t => t.id === id))
      .filter(Boolean) as Array<{ id: number; name: string; icon: string | null; icon_url: string | null }>

    const titlesForMap = selectedTitles.map(t => {
      const prefix = t.icon_url ? '' : (t.icon ?? '')
      return `${prefix} ${t.name}`.trim()
    })
    usePlayerStore.getState().setDisplayedTitles(titlesForMap)

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

    if (avatarFile) {
      const uploaded = await uploadAvatar(currentUserId, avatarFile, { cacheBust: true })
      if (uploaded) avatarUrl = uploaded
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
                  <LevelText level={isSelf ? level : (profile.level ?? 1)} />
                  {(isSelf ? veteranFirstEra : (profile.veteranFirstEra ?? false)) && (
                    <VeteranBadge size="sm" />
                  )}
                  {isSelf && !isEditing && (
                    <button className="player-modal-edit-btn" onClick={handleStartEdit} aria-label="Modifier">
                      {'\u270F\uFE0F'}
                    </button>
                  )}
                </div>

                {profile.factionTitle && (
                  <div className="player-modal-faction-member">
                    {profile.factionPattern && (
                      <span
                        className="player-modal-faction-member-icon"
                        style={{
                          WebkitMaskImage: `url(${profile.factionPattern})`,
                          maskImage: `url(${profile.factionPattern})`,
                          backgroundColor: profile.factionColor ?? '#8A7B6A',
                        }}
                        aria-hidden
                      />
                    )}
                    <span>
                      Classe{' '}
                      <button
                        type="button"
                        className="player-modal-faction-link"
                        style={{ color: profile.factionColor ?? undefined }}
                        onClick={() => setShowFactionMembers(true)}
                      >
                        {profile.factionTitle}
                      </button>
                    </span>
                  </div>
                )}

                {/* V0.7 phase 3.5 — Titres déplacés sous le nom (depuis le
                    bas du header) pour densifier l'identité visuelle.
                    Les compteurs (lieux explorés / énigmes / lieux veillés)
                    sont déplacés plus bas, sous les Couronnes, en lignes
                    cohérentes avec Gloire/Coupe/Couronnes. */}
                {/* V0.7 phase 3.5 \u2014 Refonte Gloire + Coupe + Couronnes
                    Pour soi : on utilise get_my_glory (formule \u00E0 la vol\u00E9e, lifetime).
                    Pour les autres : on garde l'ancienne formule profile.glory
                    (exploration_points + erudition_points) jusqu'\u00E0 ce que
                    get_player_profile soit align\u00E9. */}
                <GloryProgressBar
                  level={isSelf ? level : (profile.level ?? 1)}
                  xpTotal={isSelf ? xpTotal : (profile.xpTotal ?? 0)}
                  xpToNextLevel={isSelf ? xpToNextLevel : (profile.xpToNextLevel ?? 5)}
                  xpForNextLevel={isSelf ? xpForNextLevel : (profile.xpForNextLevel ?? 5)}
                  xpForCurrentLevel={isSelf ? xpForCurrentLevel : (profile.xpForCurrentLevel ?? 0)}
                />
                {/* V0.7 phase 3.5 \u2014 3 stats (Coupe / Couronnes / \u00C9nigmes) wrapp\u00E9es
                    dans un container : display: contents sur desktop (rendu inchang\u00E9,
                    lignes empil\u00E9es), grid 3 colonnes sur mobile (blocs centr\u00E9s). */}
                <div className="player-modal-stats">
                  {/* Coupe\u2014 score live pour soi, depuis le profil pour les autres */}
                  {isSelf ? (
                    coupeState?.myBreakdown ? (
                      <div className="player-modal-stat">
                        <span className="player-modal-stat-icon">{'\uD83C\uDFC6'}</span>
                        <span className="player-modal-stat-value">{coupeState.myBreakdown.score}</span>
                        <span className="player-modal-stat-label">{'\u00E0 la Coupe'}</span>
                      </div>
                    ) : null
                  ) : (
                    (profile.coupeScoreCurrentSeason ?? 0) > 0 ? (
                      <div className="player-modal-stat">
                        <span className="player-modal-stat-icon">{'\uD83C\uDFC6'}</span>
                        <span className="player-modal-stat-value">{profile.coupeScoreCurrentSeason}</span>
                        <span className="player-modal-stat-label">{'\u00E0 la Coupe'}</span>
                      </div>
                    ) : null
                  )}

                  {/* Couronnes retir\u00E9es du profil (V0.9.54) \u2014 le solde vit d\u00E9j\u00E0
                      dans la barre de l'app ; inutile de le redonder, et \u00E7a reste
                      priv\u00E9 vis-\u00E0-vis des autres. */}

                  {/* Lieux prot\u00E9g\u00E9s \u2014 affich\u00E9 pour tous, \u00E0 la place des Couronnes.
                      Source : veilledPlaces (place_veille), qui couvre le plantage
                      GPS ET la tenue \u00E0 distance via La Cour (basculement Couronnes,
                      cf. invest_crowns mig 150). M\u00EAme compte que le carrousel
                      \u00AB \u00C9tendard plant\u00E9 sur\u2026 \u00BB juste en dessous. */}
                  {(profile.veilledPlaces?.length ?? 0) > 0 && (
                    <div className="player-modal-stat">
                      <span className="player-modal-stat-icon">{'\uD83D\uDEA9'}</span>
                      <span className="player-modal-stat-value">{profile.veilledPlaces.length}</span>
                      <span className="player-modal-stat-label">{profile.veilledPlaces.length > 1 ? 'lieux prot\u00E9g\u00E9s' : 'lieu prot\u00E9g\u00E9'}</span>
                    </div>
                  )}

                  {/* \u00C9nigmes r\u00E9solues */}
                  <div className="player-modal-stat">
                    <span className="player-modal-stat-icon">{'\uD83D\uDCD6'}</span>
                    <span className="player-modal-stat-value">{profile.enigmasSolved ?? 0}</span>
                    <span className="player-modal-stat-label">{'\u00E9nigmes'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Titres \u2014 au-dessus de la bio (position d'origine) */}
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
                  Explorateur depuis le {formatFrenchLongDate(profile.joinedAt)}
                </p>


                {/* V0.7+ Mute soft — petit lien discret en bas, l'utilisateur ne va le
                    chercher que s'il en a vraiment besoin. */}
                {!isSelf && (
                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: '#8a6f4a', opacity: 0.7,
                        padding: '2px 4px', fontFamily: 'inherit',
                      }}
                    >
                      {isMuted(playerId) ? '🔔 réactiver les emojis' : '🔕 mute les emojis'}
                    </button>
                  </div>
                )}
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
                  onChange={e => setEditInstagram(e.target.value.replace(/[^a-zA-Z0-9._@]/g, ''))}
                  placeholder="@votre_compte"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
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

            {/* Fragments possedes */}
            {(playerFragments.length > 0 || isSelf) && (
            <div className="player-modal-fragments">
              <p className="player-modal-fragments-title">{'Fragments possédés'}</p>
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
                {playerFragments.map(f => (
                    <div
                      key={f.id}
                      className="player-modal-fragment-badge"
                      onClick={openFragmentCollection}
                    >
                      {f.image_url ? (
                        <img src={f.image_url} alt={f.name} className="player-modal-fragment-badge-img" />
                      ) : (
                        <span className="player-modal-fragment-badge-icon">{f.icon ?? '?'}</span>
                      )}
                      <span className="player-modal-fragment-name">{f.name}</span>
                      {/* V0.7 phase 3.5 — Billes de couleur (affinités tags V0.5)
                          retirées. Le bonus d'affinité ne donne plus d'influence
                          depuis le freeze V0.5. À reconsidérer si on rebranche
                          quelque chose dessus à la phase 5+. */}
                    </div>
                ))}
                {isSelf && playerFragments.length > 0 && (
                  <button
                    className="player-modal-fragment-badge player-modal-fragment-badge-add"
                    onClick={openFragmentCollection}
                  >
                    +
                  </button>
                )}
                {isSelf && playerFragments.length === 0 && (
                  <button
                    className="player-modal-fragment-cta"
                    onClick={openFragmentCollection}
                  >
                    + S'équiper de mon premier fragment
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
            )}

            {/* Places tabs */}
            <div className="player-modal-places">
              {/* V0.7+ Refonte 2026-05-02 : 3 carrousels horizontaux empilés. */}
              <PlacesCarousel
                emoji={''}
                titleText="A cartographié"
                places={profile.authoredPlaces ?? []}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('authored')}
              />
              <PlacesCarousel
                emoji={''}
                titleText="S'est rendu à..."
                places={profile.discoveredPlaces ?? []}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('discovered')}
              />
              {/* V0.9.53 — GPS pur (plantedPlaces), pas les prises à distance. */}
              <PlacesCarousel
                emoji={''}
                titleText="Étendard planté sur..."
                places={plantedPlaces}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('veilled')}
              />
              {/* V0.9.53 — wishlist publique « à visiter ». */}
              <PlacesCarousel
                emoji={''}
                titleText="Veut s'y rendre..."
                places={profile.wishlistPlaces ?? []}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('wishlist')}
              />
            </div>
          </>
        )}
      </div>

      {showFragmentStore && (
        <div className="player-modal-overlay" onClick={() => setShowFragmentStore(false)} style={{ zIndex: 10002 }}>
          <div className="player-modal fragment-collection-modal" onClick={e => e.stopPropagation()}>
            <button className="player-modal-close" onClick={() => setShowFragmentStore(false)}>&#10005;</button>
            <h3 className="fragment-collection-title">Fragments disponibles</h3>
            <p className="fragment-collection-subtitle">
              Chez Runes de Chêne, nos illustrations originales sont appelées <b>Fragments</b>. Achetées sur la <u><a href="https://runesdechene.com"><b>Boutique officielle</b></a></u>, elles vous offrent des 🔮 énigmes thématiques supplémentaires toutes les 48h.
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
                      {f.link_url && (
                        <button className="frag-grid-shop-btn" onClick={() => window.open(f.link_url!, '_blank', 'noopener,noreferrer')}>
                          <img src={shopIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4, display: 'inline' }} />Découvrir la collection
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '12px 0 0', textAlign: 'center' }}>
              <a href="https://hub.runesdechene.com/soumettre-contenu" target="_blank" rel="noopener noreferrer" style={{ color: '#8A7B6A', fontSize: 16, textDecoration: 'none' }}>
                J'ai deja achete — Reclamer mes fragments
              </a>
            </div>
          </div>
        </div>
      )}

      {showTitlePicker && (
        <div className="player-modal-overlay" onClick={() => setShowTitlePicker(false)} style={{ zIndex: 10002 }}>
          <div className="player-modal title-picker-modal" onClick={e => e.stopPropagation()}>
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
                        const progress = !t.unlocked ? formatTitleProgress(t.condition, playerStats) : null
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

      {viewAllSection && profile && (() => {
        const places: PlaceCard[] =
          viewAllSection === 'authored' ? (profile.authoredPlaces ?? []) :
          viewAllSection === 'discovered' ? (profile.discoveredPlaces ?? []) :
          viewAllSection === 'wishlist' ? (profile.wishlistPlaces ?? []) :
          plantedPlaces
        const meta =
          viewAllSection === 'authored' ? { emoji: '\u{1F3DB}️', text: 'Ajoutés' } :
          viewAllSection === 'discovered' ? { emoji: '\u{1F9ED}', text: 'Explorés' } :
          viewAllSection === 'wishlist' ? { emoji: '\u{1F516}', text: 'À visiter' } :
          { emoji: '\u{1F6A9}', text: 'Étendard planté' }
        return (
          <div className="player-modal-overlay" onClick={() => setViewAllSection(null)} style={{ zIndex: 10003 }}>
            <div className="player-modal player-modal-view-all" onClick={e => e.stopPropagation()}>
              <button className="player-modal-close" onClick={() => setViewAllSection(null)}>&#10005;</button>
              <h3 className="player-modal-view-all-title">
                {meta.emoji} {meta.text} <span className="player-modal-view-all-count">{places.length}</span>
              </h3>
              <div className="player-modal-view-all-grid">
                {places.map(place => (
                  <button
                    key={place.id}
                    className="player-modal-place-tile"
                    onClick={() => { handlePlaceClick(place.id); setViewAllSection(null) }}
                  >
                    {place.imageUrl ? (
                      <img src={place.imageUrl} alt={place.title} className="player-modal-place-tile-img" loading="lazy" />
                    ) : (
                      <div className="player-modal-place-tile-img player-modal-place-tile-img-fallback">{'\u{1F3DB}️'}</div>
                    )}
                    <span className="player-modal-place-tile-name">
                      {place.tagIcon && (
                        <span className="player-modal-place-tile-tag-bubble" style={{ background: place.tagColor ?? '#8A7B6A' }} aria-hidden>
                          <img src={place.tagIcon} alt="" />
                        </span>
                      )}
                      {place.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )

  return isMobile ? createPortal(modal, document.body) : modal
}

/** V0.7+ Sous-composant local — carousel horizontal d'un type de lieux (Ajoutés
 *  / Explorés / Revendiqués) avec compteur dans le titre + tile "Voir tout" si
 *  > CAROUSEL_CAP. Section masquée si 0 lieu (pas de carousel vide affreux). */
const CAROUSEL_CAP = 20

function PlacesCarousel({ emoji, titleText, places, onPlaceClick, onViewAll }: {
  emoji: string
  titleText: string
  places: PlaceCard[]
  onPlaceClick: (id: string) => void
  onViewAll: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  if (places.length === 0) return null

  const visible = places.slice(0, CAROUSEL_CAP)
  const showViewAll = places.length > CAROUSEL_CAP

  function scrollBy(delta: number) {
    rowRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="player-modal-section">
      <h3 className="player-modal-section-title">
        {emoji} {titleText} <span className="player-modal-section-count">{places.length}</span>
      </h3>
      <div className="player-modal-places-wrapper">
        <button
          className="places-arrow places-arrow--left"
          onClick={() => scrollBy(-280)}
          aria-label="Précédent"
          type="button"
        >‹</button>
        <div ref={rowRef} className="player-modal-places-row">
          {visible.map(place => (
            <button
              key={place.id}
              className="player-modal-place-tile"
              onClick={() => onPlaceClick(place.id)}
            >
              {place.imageUrl ? (
                <img src={place.imageUrl} alt={place.title} className="player-modal-place-tile-img" loading="lazy" />
              ) : (
                <div className="player-modal-place-tile-img player-modal-place-tile-img-fallback">{'\u{1F3DB}️'}</div>
              )}
              <span className="player-modal-place-tile-name">
                {place.tagIcon && (
                  <span className="player-modal-place-tile-tag-bubble" style={{ background: place.tagColor ?? '#8A7B6A' }} aria-hidden>
                    <img src={place.tagIcon} alt="" />
                  </span>
                )}
                {place.title}
              </span>
            </button>
          ))}
          {showViewAll && (
            <button
              className="player-modal-place-tile player-modal-place-tile-view-all"
              onClick={onViewAll}
            >
              <span className="player-modal-place-tile-img player-modal-place-tile-view-all-icon">+{places.length - CAROUSEL_CAP}</span>
              <span className="player-modal-place-tile-name">Voir tout</span>
            </button>
          )}
        </div>
        <button
          className="places-arrow places-arrow--right"
          onClick={() => scrollBy(280)}
          aria-label="Suivant"
          type="button"
        >›</button>
      </div>
    </div>
  )
}
