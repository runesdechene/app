import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/imageUtils'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import shopIcon from '../../assets/shop_icon.webp'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { FactionMembersModal } from './FactionMembersModal'
import { VeteranBadge } from '../profile/VeteranBadge'
import { GloryProgressBar } from '../profile/GloryProgressBar'
import { LevelText } from '../profile/LevelText'
import { useNoteReactions } from '../../hooks/useNoteReactions'
import { useNoteReactors } from '../../hooks/useNoteReactors'
import { useMutedUsers } from '../../hooks/useMutedUsers'
import { NoteReactionsRow } from '../social/NoteReactionsRow'

interface PlaceCard {
  id: string
  title: string
  type: string
  imageUrl: string | null
}

interface AuthoredPlace extends PlaceCard {
  createdAt: string
}

interface VisitedPlace extends PlaceCard {
  visitsCount: number
  lastVisitedAt: string
}

interface FavoritePlace extends PlaceCard {
  totalPoints: number
  lastActionAt: string
}

interface VeilledPlace extends PlaceCard {
  plantedAt: string
  memberCount: number
}

type PlacesTab = 'authored' | 'discovered' | 'veilled'

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
  /** V0.5 fields */
  explorationPoints?: number
  eruditionPoints?: number
  influenceStock?: number
  influencePlaced?: number
  glory?: number
  /** V0.7 phase 3.5 — nouveaux compteurs (mig 030 + 031) */
  lieuxExplores?: number
  lieuxVeilles?: number
  enigmasSolved?: number
  /** V0.7 Niveaux — exposés par get_player_profile (mig 045) */
  level?: number
  xpTotal?: number
  xpToNextLevel?: number
  xpForNextLevel?: number
  veteranFirstEra?: boolean
  /** V0.7 — Couronnes & Coupe exposés pour tous les profils (mig 051) */
  crownsBalance?: number
  coupeScoreCurrentSeason?: number
  coupeSeasonName?: string | null
  joinedAt: string
  displayedGeneralTitles: TitleInfo[] | null
  factionTitle2: TitleInfo | null
  biography: string
  instagram: string | null
  authoredPlaces: AuthoredPlace[]
  discoveredPlaces: VisitedPlace[]
  /** V0.5 legacy — gardé pour rétrocompat mais l'onglet est remplacé par veilled */
  favoritePlaces: FavoritePlace[]
  /** V0.7 phase 3.5 — lieux actuellement veillés (mig 032) */
  veilledPlaces: VeilledPlace[]
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

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days < 1) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `il y a ${weeks} sem`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(days / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

export function PlayerProfileModal({ playerId, onClose }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const currentUserId = usePlayerStore(s => s.userId)
  const crownsBalance = useCrownsStore(s => s.balance)
  const { state: coupeState } = useCoupe(true)
  const level = usePlayerStore(s => s.level)
  const xpTotal = usePlayerStore(s => s.xpTotal)
  const xpToNextLevel = usePlayerStore(s => s.xpToNextLevel)
  const xpForNextLevel = usePlayerStore(s => s.xpForNextLevel)
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
  const [allFragments, setAllFragments] = useState<Array<{ id: number; name: string; description: string | null; icon: string | null; image_url: string | null; link_url: string | null; affinities: Array<{ tagId: string; tagTitle: string; tagIcon: string | null; tagColor: string; bonusPoints: number }> | null; owned: boolean }>>([])
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
  const [playerFragments, setPlayerFragments] = useState<Array<{ id: number; name: string; icon: string | null; icon_url: string | null; image_url: string | null; link_url: string | null; collection: string | null; affinities: Array<{ tagId: string; tagTitle: string; tagIcon: string | null; tagColor: string; bonusPoints: number }> | null }>>([])

  // V0.7+ Micro-social
  const [otherNoteText, setOtherNoteText] = useState<string | null>(null)
  const [otherNotePostedAt, setOtherNotePostedAt] = useState<string | null>(null)
  const { reactions, addReaction, refetch: refetchReactions } = useNoteReactions(playerId)
  const { reactors, refetch: refetchReactors } = useNoteReactors(playerId)
  const { isMuted, muteUser, unmuteUser } = useMutedUsers()

  const isSelf = profile?.userId === currentUserId

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
      const [profileRes, fragmentsRes, noteRes] = await Promise.all([
        supabase.rpc('get_player_profile', { p_user_id: playerId }),
        supabase.rpc('get_user_fragments', { p_user_id: playerId }),
        supabase.from('users').select('note_text, note_posted_at').eq('id', playerId).single(),
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
      // V0.7+ Note de l'autre voyageur (filtrage 24h côté client par sécurité — la DB filtre aussi)
      if (noteRes.data) {
        const text = (noteRes.data as { note_text: string | null }).note_text
        const postedAt = (noteRes.data as { note_posted_at: string | null }).note_posted_at
        const expired = postedAt && new Date(postedAt).getTime() < Date.now() - 24 * 60 * 60 * 1000
        setOtherNoteText(expired ? null : text)
        setOtherNotePostedAt(expired ? null : postedAt)
      }
      setLoading(false)
    }
    load()
  }, [playerId])


  async function handleReactToOther(emoji: string) {
    try {
      await addReaction(playerId, emoji)
      await Promise.all([refetchReactions(), refetchReactors()])
    } catch (err) {
      console.warn('[PlayerProfileModal] react_to_note failed', err)
    }
  }

  async function handleToggleMute() {
    try {
      if (isMuted(playerId)) await unmuteUser(playerId)
      else await muteUser(playerId)
    } catch (err) {
      console.warn('[PlayerProfileModal] mute toggle failed', err)
    }
  }

  async function handleReportNote() {
    if (!confirm('Signaler cette note pour modération ?')) return
    const { error } = await supabase.rpc('report_note', { p_target_user_id: playerId })
    if (error) {
      alert('Le signalement a échoué : ' + (error.message ?? 'erreur inconnue'))
      return
    }
    alert('Signalement envoyé. Merci.')
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
                />
                {/* V0.7 phase 3.5 \u2014 3 stats (Coupe / Couronnes / \u00C9nigmes) wrapp\u00E9es
                    dans un container : display: contents sur desktop (rendu inchang\u00E9,
                    lignes empil\u00E9es), grid 3 colonnes sur mobile (blocs centr\u00E9s). */}
                <div className="player-modal-stats">
                  {/* Coupe \u2014 score live pour soi, depuis le profil pour les autres */}
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

                  {/* Couronnes */}
                  {isSelf ? (
                    <div className="player-modal-stat">
                      <span className="player-modal-stat-icon">{'\uD83E\uDE99'}</span>
                      <span className="player-modal-stat-value">{crownsBalance}</span>
                      <span className="player-modal-stat-label">{'Couronne'}{crownsBalance > 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    (profile.crownsBalance ?? 0) > 0 ? (
                      <div className="player-modal-stat">
                        <span className="player-modal-stat-icon">{'\uD83E\uDE99'}</span>
                        <span className="player-modal-stat-value">{profile.crownsBalance}</span>
                        <span className="player-modal-stat-label">{'Couronne'}{(profile.crownsBalance ?? 0) > 1 ? 's' : ''}</span>
                      </div>
                    ) : null
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
                  Explorateur depuis le {formatDate(profile.joinedAt)}
                </p>

                {/* "Mon mot du moment" édité uniquement depuis la carte (avatar → popover).
                    Décision Uriel 2026-05-02 : pas d'input dans le profil, c'est moche. */}

                {!isSelf && otherNoteText && (
                  <div style={{
                    marginTop: 12,
                    padding: 10,
                    background: '#fdf3d6',
                    border: '1px solid #c8a874',
                    borderRadius: 8,
                  }}>
                    <div style={{
                      fontSize: 10, textTransform: 'uppercase', color: '#7a4a1a',
                      fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4,
                    }}>
                      {profile.name} {otherNotePostedAt && `· ${formatRelativeDate(otherNotePostedAt)}`}
                    </div>
                    <p style={{
                      fontStyle: 'italic', color: '#3a2a1a', margin: '0 0 6px 0',
                      fontSize: 14, lineHeight: 1.32,
                    }}>
                      {otherNoteText}
                    </p>
                    <NoteReactionsRow reactions={reactions} />

                    {/* Liste détaillée des reactors par emoji (qui a réagi) — V0.7+ feature */}
                    {reactors.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {reactions.map(({ emoji }) => {
                          const list = reactors.filter(r => r.emoji === emoji)
                          if (list.length === 0) return null
                          return (
                            <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
                              {list.map(r => (
                                <span
                                  key={r.reactorUserId}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: 'rgba(244, 232, 200, 0.6)',
                                    border: '1px solid rgba(90, 39, 24, 0.15)',
                                    borderRadius: 999,
                                    padding: '2px 8px 2px 2px',
                                    fontSize: 12,
                                    color: '#3a2a1a',
                                  }}
                                >
                                  {r.reactorAvatarUrl ? (
                                    <img
                                      src={r.reactorAvatarUrl}
                                      alt=""
                                      style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <span style={{
                                      width: 20, height: 20, borderRadius: '50%',
                                      background: '#8a6f4a', color: '#fff', fontSize: 11, fontWeight: 700,
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      {r.reactorName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  {r.reactorName}
                                </span>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Mini picker contextuel : 7 emojis salutation pour réagir vite */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {['👋', '❤️', '🤝', '🙏', '🌳', '☕', '🪙'].map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => handleReactToOther(e)}
                          style={{
                            background: '#fff', border: '1px solid #d4c4a4',
                            borderRadius: 6, padding: '3px 8px', fontSize: 16,
                            cursor: 'pointer',
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={handleReportNote}
                        style={{
                          background: 'none', border: '1px dashed #b87878',
                          color: '#8a4a4a', fontSize: 12, padding: '3px 8px',
                          borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        ⚠️ Signaler
                      </button>
                    </div>
                  </div>
                )}

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
                titleText="Étendard planté sur..."
                places={profile.veilledPlaces ?? []}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('veilled')}
              />
              <PlacesCarousel
                emoji={''}
                titleText="S'est rendu à..."
                places={profile.discoveredPlaces ?? []}
                onPlaceClick={handlePlaceClick}
                onViewAll={() => setViewAllSection('discovered')}
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
                      {f.affinities && f.affinities.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                          {f.affinities.map(a => (
                            <span key={a.tagId} className="frag-grid-bonus" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 18, height: 18, borderRadius: '50%', background: a.tagColor, flexShrink: 0,
                              }}>
                                {a.tagIcon && <img src={a.tagIcon} alt="" style={{ width: 11, height: 11, filter: 'brightness(0) invert(1)' }} />}
                              </span>
                              <span>+{a.bonusPoints}/j 🏴 {a.tagTitle}</span>
                            </span>
                          ))}
                        </div>
                      )}
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

      {viewAllSection && profile && (() => {
        const places: PlaceCard[] =
          viewAllSection === 'authored' ? (profile.authoredPlaces ?? []) :
          viewAllSection === 'discovered' ? (profile.discoveredPlaces ?? []) :
          (profile.veilledPlaces ?? [])
        const meta =
          viewAllSection === 'authored' ? { emoji: '\u{1F3DB}️', text: 'Ajoutés' } :
          viewAllSection === 'discovered' ? { emoji: '\u{1F9ED}', text: 'Explorés' } :
          { emoji: '\u{1F6A9}', text: 'Revendiqués' }
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
                    <span className="player-modal-place-tile-name">{place.title}</span>
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
  if (places.length === 0) return null

  const visible = places.slice(0, CAROUSEL_CAP)
  const showViewAll = places.length > CAROUSEL_CAP

  return (
    <div className="player-modal-section">
      <h3 className="player-modal-section-title">
        {emoji} {titleText} <span className="player-modal-section-count">{places.length}</span>
      </h3>
      <div className="player-modal-places-wrapper">
      <div className="player-modal-places-row">
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
            <span className="player-modal-place-tile-name">{place.title}</span>
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
      </div>
    </div>
  )
}
