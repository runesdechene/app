import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFogStore } from '../../stores/fogStore'
import { useMapStore } from '../../stores/mapStore'
import { setDisplayedTitles } from '../../hooks/useFog'

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

  const currentUserId = useFogStore(s => s.userId)
  const [isEditing, setIsEditing] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [editTitleIds, setEditTitleIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [placesTab, setPlacesTab] = useState<PlacesTab>('authored')

  const isSelf = profile?.userId === currentUserId

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_player_profile', { p_user_id: playerId })
      if (data) {
        const p = data as unknown as PlayerProfile
        setProfile(p)
        setEditBio(p.biography ?? '')
        setEditInstagram(p.instagram ?? '')
        if (p.displayedGeneralTitles && p.displayedGeneralTitles.length > 0) {
          setEditTitleIds(p.displayedGeneralTitles.map(t => t.id))
        }
      }
      setLoading(false)
    }
    load()
  }, [playerId])

  function handleStartEdit() {
    if (!profile) return
    setEditBio(profile.biography ?? '')
    setEditInstagram(profile.instagram ?? '')
    if (profile.displayedGeneralTitles && profile.displayedGeneralTitles.length > 0) {
      setEditTitleIds(profile.displayedGeneralTitles.map(t => t.id))
    } else {
      setEditTitleIds([])
    }
    setIsEditing(true)
  }

  function handleToggleTitle(titleId: number) {
    setEditTitleIds(prev => {
      if (prev.includes(titleId)) return prev.filter(id => id !== titleId)
      if (prev.length >= 2) return prev
      return [...prev, titleId]
    })
  }

  async function handleSave() {
    if (!currentUserId || !profile) return
    setSaving(true)

    await Promise.all([
      supabase.rpc('update_my_profile', {
        p_user_id: currentUserId,
        p_bio: editBio,
        p_instagram: editInstagram,
      }),
      setDisplayedTitles(editTitleIds),
    ])

    const { data } = await supabase.rpc('get_player_profile', { p_user_id: currentUserId })
    if (data) setProfile(data as unknown as PlayerProfile)

    setIsEditing(false)
    setSaving(false)
  }

  function handlePlaceClick(placeId: string) {
    onClose()
    useMapStore.getState().setSelectedPlaceId(placeId)
  }

  return (
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
              <div className="player-modal-avatar-wrap">
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
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
                {profile.factionPattern && (
                  <img
                    src={profile.factionPattern}
                    alt=""
                    className="player-modal-faction-badge"
                  />
                )}
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
                    <span className="player-modal-count-label">explores</span>
                  </div>
                  <div className="player-modal-count">
                    <span className="player-modal-count-value">{profile.claimedPlaces?.length ?? 0}</span>
                    <span className="player-modal-count-label">conquis</span>
                  </div>
                </div>

                <div className="player-modal-faction-row">
                  {profile.factionTitle && (
                    <span
                      className="player-modal-faction"
                      style={{ color: profile.factionColor ?? '#8A7B6A' }}
                    >
                      {profile.factionTitle}
                    </span>
                  )}
                  <span className="player-modal-notoriety">
                    {'\uD83C\uDFC5'} {profile.notorietyPoints}
                  </span>
                </div>
              </div>
            </div>

            {/* Titres */}
            {((profile.displayedGeneralTitles && profile.displayedGeneralTitles.length > 0) || profile.factionTitle2) && (
              <div className="player-modal-titles" style={{ '--faction-color': profile.factionColor ?? undefined } as React.CSSProperties}>
                {profile.displayedGeneralTitles?.map(t => (
                  <span key={t.id} className="title-badge title-badge-general">
                    {t.icon} {t.name}
                  </span>
                ))}
                {profile.factionTitle2 && (
                  <span className="title-badge title-badge-faction">
                    {profile.factionTitle2.icon} {profile.factionTitle2.name}
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
                    @{profile.instagram.replace(/^@/, '')}
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

                {profile.unlockedGeneralTitles && profile.unlockedGeneralTitles.length > 0 && (
                  <>
                    <label className="player-modal-edit-label">Titres affiches (max 2)</label>
                    <div className="player-modal-title-picker">
                      {profile.unlockedGeneralTitles.map(t => {
                        const isSelected = editTitleIds.includes(t.id)
                        return (
                          <label key={t.id} className="title-picker-option">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTitle(t.id)}
                              disabled={!isSelected && editTitleIds.length >= 2}
                            />
                            <span>{t.icon} {t.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}

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

            {/* Places tabs */}
            <div className="player-modal-places">
              <div className="player-modal-tabs">
                <button
                  className={`player-modal-tab${placesTab === 'authored' ? ' active' : ''}`}
                  onClick={() => setPlacesTab('authored')}
                >
                  Ajoutés <span className="player-modal-tabs-number">{profile.authoredPlaces?.length ?? 0}</span>
                </button>
                <button
                  className={`player-modal-tab${placesTab === 'discovered' ? ' active' : ''}`}
                  onClick={() => setPlacesTab('discovered')}
                >
                  Explorés  <span className="player-modal-tabs-number">{profile.discoveredPlaces?.length ?? 0}</span>
                </button>
                <button
                  className={`player-modal-tab${placesTab === 'claimed' ? ' active' : ''}`}
                  onClick={() => setPlacesTab('claimed')}
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

                return (
                  <div className="player-modal-places-grid">
                    {places.map(place => (
                      <div
                        key={place.id}
                        className="player-modal-place-card"
                        onClick={() => handlePlaceClick(place.id)}
                      >
                        {place.imageUrl ? (
                          <img src={place.imageUrl} alt={place.title} className="player-modal-place-img" />
                        ) : (
                          <div className="player-modal-place-img-fallback">
                            {'\uD83C\uDFDB\uFE0F'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
