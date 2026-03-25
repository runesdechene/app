import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/imageUtils'
import { usePlayerStore } from '../../stores/playerStore'
import runeImg from '../../assets/rune_de_chene.png'
import shopIcon from '../../assets/shop_icon.webp'
import tshirtIcon from '../../assets/t-shirt_icon.png'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { FactionMembersModal } from './FactionMembersModal'
import { TitleComposer } from './TitleComposer'

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
  const [showComposer, setShowComposer] = useState(false)
  const [showFragmentStore, setShowFragmentStore] = useState(false)
  const [composedPhrase, setComposedPhrase] = useState<string | null>(null)
  const [composedWordIds, setComposedWordIds] = useState<number[]>([])
  const [savingTitle, setSavingTitle] = useState(false)
  const [playerFragments, setPlayerFragments] = useState<Array<{ id: number; name: string; icon: string | null; image_url: string | null; link_url: string | null; collection: string | null; bonus_type: string | null; bonus_value: number }>>([])

  const isSelf = profile?.userId === currentUserId

  useEffect(() => {
    async function load() {
      const [profileRes, composedRes, fragmentsRes] = await Promise.all([
        supabase.rpc('get_player_profile', { p_user_id: playerId }),
        supabase.rpc('get_user_composed_title', { p_user_id: playerId }),
        supabase.rpc('get_user_fragments', { p_user_id: playerId }),
      ])
      if (profileRes.data) {
        const p = profileRes.data as unknown as PlayerProfile
        setProfile(p)
        setEditBio(p.biography ?? '')
        setEditInstagram(p.instagram ?? '')
      }
      if (composedRes.data) {
        const cd = composedRes.data as { phrase: string | null; wordIds: number[] | null }
        if (cd.phrase) {
          setComposedPhrase(cd.phrase)
          setComposedWordIds(cd.wordIds ?? [])
        }
      }
      if (fragmentsRes.data && Array.isArray(fragmentsRes.data)) {
        setPlayerFragments(fragmentsRes.data as Array<{ id: number; name: string; icon: string | null; image_url: string | null; link_url: string | null; collection: string | null; bonus_type: string | null; bonus_value: number }>)
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
                    title={profile.factionTitle ?? 'Faction'}
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

                {composedPhrase ? (
                  <div className="player-modal-composed-title" style={{ '--faction-color': profile.factionColor ?? undefined } as React.CSSProperties}>
                    <span className="player-modal-composed-phrase">{composedPhrase}</span>
                    {isSelf && !isEditing && (
                      <button className="player-modal-compose-btn" onClick={() => setShowComposer(true)} title="Modifier">
                        {'\u270F\uFE0F'}
                      </button>
                    )}
                  </div>
                ) : isSelf && !isEditing ? (
                  <button className="player-modal-compose-link" onClick={() => setShowComposer(true)}>
                    Composer mon titre
                  </button>
                ) : null}

                <div className="player-modal-counts">
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.authoredPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">lieux</span>
                  </div>
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.discoveredPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">explores</span>
                  </div>
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.claimedPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">conquis</span>
                  </div>
                </div>

                <div className="player-modal-faction-row">
                  <span className="player-modal-notoriety">
                    {'\uD83C\uDFC5'} {profile.notorietyPoints}
                  </span>
                </div>
              </div>
            </div>

            {/* Titres classiques (fallback si pas de phrase composee) */}
            {!composedPhrase && ((profile.displayedGeneralTitles && profile.displayedGeneralTitles.length > 0) || profile.factionTitle2) && (
              <div className="player-modal-titles" style={{ '--faction-color': profile.factionColor ?? undefined } as React.CSSProperties}>
                {profile.displayedGeneralTitles?.map(t => (
                  <span key={t.id} className="title-badge title-badge-general">
                    {t.icon} {t.name}
                  </span>
                ))}
                {profile.factionTitle2 && (
                  <span
                    className="title-badge title-badge-faction title-badge-clickable"
                    onClick={() => setShowFactionMembers(true)}
                  >
                    {profile.factionTitle2.icon} {profile.factionTitle2.name} <span className="title-badge-origin">(faction)</span>
                  </span>
                )}
              </div>
            )}

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

            {/* Fragments possedes */}
            {playerFragments.length > 0 && (
              <div className="player-modal-fragments">
                <span className="player-modal-fragments-label">Fragments possédés</span>
                <div className="player-modal-fragments-scroll">
                  {playerFragments.map(f => (
                    <div
                      key={f.id}
                      className={`player-modal-fragment-chip${f.link_url ? ' clickable' : ''}`}
                      onClick={() => f.link_url && window.open(f.link_url, '_blank', 'noopener,noreferrer')}
                    >
                        {f.image_url ? (
                          <img src={f.image_url} alt="" className="player-modal-fragment-img" />
                        ) : f.icon ? (
                          <span className="player-modal-fragment-icon">{f.icon}</span>
                        ) : null}
                        <span className="player-modal-fragment-name">{f.name}</span>
                        {f.bonus_type && f.bonus_value !== 0 && (
                          <span className="player-modal-fragment-bonus">
                            {f.bonus_value > 0 ? '+' : ''}{f.bonus_value} {f.bonus_type.replace('max_', 'Max ').replace('regen_', '% Regen ').replace('energy', 'Energie').replace('conquest', 'Conquete').replace('construction', 'Construction')}
                          </span>
                        )}
                    </div>
                  ))}
                  <button
                    className="player-modal-fragment-chip player-modal-fragment-add"
                    onClick={() => setShowFragmentStore(true)}
                  >
                    <span className="player-modal-fragment-add-icon">+</span>
                    <span className="player-modal-fragment-name">Obtenir</span>
                  </button>
                </div>
              </div>
            )}

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
                  Explorés  <span className="player-modal-tabs-number">{profile.discoveredPlaces?.length ?? 0}</span>
                </button>
                <button
                  className={`player-modal-tab${placesTab === 'claimed' ? ' active' : ''}`}
                  onClick={() => { setPlacesTab('claimed'); setVisibleCount(12) }}
                >
                  Conquis  <span className="player-modal-tabs-number">{profile.claimedPlaces?.length ?? 0}</span>
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
          <div className="fragment-store-modal" onClick={e => e.stopPropagation()}>
            <button className="player-modal-close" onClick={() => setShowFragmentStore(false)}>&#10005;</button>
            <img src={runeImg} alt="" className="fragment-store-logo" />
            <h2 className="fragment-store-title">Obtenir des fragments</h2>
            <p className="fragment-store-subtitle">
              Obtenez des bonus et des titres selon vos articles de la boutique Runes de Chene.
            </p>
            <div className="fragment-store-cards">
              <a
                href="https://runesdechene.com"
                target="_blank"
                rel="noopener noreferrer"
                className="fragment-store-card"
              >
                <img src={shopIcon} alt="" className="fragment-store-card-img" />
                <h3 className="fragment-store-card-title">Explorer la boutique</h3>
                <p className="fragment-store-card-desc">
                  Découvrez notre catalogue de vêtements biologiques, imprimés en Bretagne et sans IA.
                </p>
              </a>
              <a
                href="https://hub.runesdechene.com/soumettre-contenu"
                target="_blank"
                rel="noopener noreferrer"
                className="fragment-store-card"
              >
                <img src={tshirtIcon} alt="" className="fragment-store-card-img" />
                <h3 className="fragment-store-card-title">J'ai deja des fragments !</h3>
                <p className="fragment-store-card-desc">
                  Envoyez nous une photo de vous, avec ou sans visage, pour reclamer vos fragments dans l'application.
                </p>
              </a>
            </div>
            <div className="fragment-store-footer">
              <p className="fragment-store-footer-subtitle">
                Vous avez déjà acheté par le passé ? Certains motifs sont éligibles !
              </p>
              <p className="fragment-store-footer-motifs">
                Varegue, Avalon, Valkyrie, Druide, Morrigan, Esprit du Loup, Esprit du Hibou
              </p>
            </div>
          </div>
        </div>
      )}

      {showComposer && (
        <div className="player-modal-overlay" onClick={() => setShowComposer(false)} style={{ zIndex: 10002 }}>
          <div className="player-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: '80vh', overflow: 'auto', padding: '24px' }}>
            <button className="player-modal-close" onClick={() => setShowComposer(false)}>&#10005;</button>
            <TitleComposer
              currentWordIds={composedWordIds}
              saving={savingTitle}
              onCancel={() => setShowComposer(false)}
              onSave={async (wordIds, phrase) => {
                if (!currentUserId) return
                setSavingTitle(true)
                const { data } = await supabase.rpc('set_composed_title', {
                  p_user_id: currentUserId,
                  p_word_ids: wordIds,
                  p_phrase: phrase,
                })
                if (data?.error) {
                  alert(data.error)
                } else {
                  setComposedWordIds(wordIds)
                  setComposedPhrase(phrase)
                  setShowComposer(false)
                }
                setSavingTitle(false)
              }}
            />
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
