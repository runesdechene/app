import { useEffect, useState, useCallback } from 'react'
import type { TerritorySelection } from '../../stores/mapStore'
import { useMapStore } from '../../stores/mapStore'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

interface PlaceTag {
  id: string
  title: string
  color: string
  background: string
  icon: string | null
}

interface TerritoryPlace {
  id: string
  title: string
  imageUrl: string | null
  likes: number
  tags: PlaceTag[]
  latitude: number
  longitude: number
}

interface Proposal {
  id: string
  name: string
  proposedBy: string
  netScore: number
  myVote: number | null
}

interface Props {
  data: TerritorySelection
  onClose: () => void
  onNameSaved: (anchorPlaceId: string, customName: string | null) => void
  onFactionModal: () => void
}

/** Distance en km entre deux points (Haversine) */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export function TerritoryPanel({ data, onClose, onNameSaved, onFactionModal }: Props) {
  const userId = useFogStore(s => s.userId)
  const userPosition = useFogStore(s => s.userPosition)
  const setSelectedPlaceId = useMapStore(s => s.setSelectedPlaceId)
  const setSelectedTerritoryData = useMapStore(s => s.setSelectedTerritoryData)

  // Lieux du territoire
  const [places, setPlaces] = useState<TerritoryPlace[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)

  // Systeme de vote
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votePower, setVotePower] = useState(0)
  const [usedVotes, setUsedVotes] = useState(0)
  const [proposalsCount, setProposalsCount] = useState(0)
  const [votesLoading, setVotesLoading] = useState(false)
  const [showProposeInput, setShowProposeInput] = useState(false)
  const [proposeName, setProposeName] = useState('')
  const [proposing, setProposing] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  const displayTitle = data.customName === null
    ? 'Nom incertain'
    : (data.customName || data.factionTitle)

  // Charger les votes
  const loadVotes = useCallback(async () => {
    if (!userId || !data.anchorPlaceId) return
    setVotesLoading(true)
    const { data: result } = await supabase.rpc('get_territory_votes', {
      p_anchor_place_id: data.anchorPlaceId,
      p_user_id: userId,
      p_blob_place_ids: data.placeIds,
    })
    setVotesLoading(false)
    if (result) {
      const r = result as { votePower: number; usedVotes: number; proposalsCount: number; proposals: Proposal[] }
      setVotePower(r.votePower)
      setUsedVotes(r.usedVotes)
      setProposalsCount(r.proposalsCount)
      setProposals(r.proposals ?? [])
    }
  }, [userId, data.anchorPlaceId, data.placeIds])

  useEffect(() => { loadVotes() }, [loadVotes])

  // Charger les lieux du territoire
  useEffect(() => {
    if (data.placeIds.length === 0) return
    setLoadingPlaces(true)

    Promise.all([
      supabase
        .from('places')
        .select('id, title, images, latitude, longitude')
        .in('id', data.placeIds),
      supabase
        .from('places_liked')
        .select('place_id')
        .in('place_id', data.placeIds),
      supabase
        .from('place_tags')
        .select('place_id, tag_id, tags(id, title, color, background, icon)')
        .in('place_id', data.placeIds),
    ]).then(([placesRes, likesRes, tagsRes]) => {
      if (!placesRes.data) { setLoadingPlaces(false); return }

      // Likes par lieu
      const likesMap = new Map<string, number>()
      if (likesRes.data) {
        for (const r of likesRes.data) {
          likesMap.set(r.place_id, (likesMap.get(r.place_id) ?? 0) + 1)
        }
      }

      // Tags par lieu
      const tagsMap = new Map<string, PlaceTag[]>()
      if (tagsRes.data) {
        for (const r of tagsRes.data as unknown as Array<{ place_id: string; tag_id: string; tags: { id: string; title: string; color: string; background: string; icon: string | null } | null }>) {
          if (!r.tags) continue
          const arr = tagsMap.get(r.place_id) ?? []
          arr.push({ id: r.tags.id, title: r.tags.title, color: r.tags.color, background: r.tags.background, icon: r.tags.icon })
          tagsMap.set(r.place_id, arr)
        }
      }

      const mapped: TerritoryPlace[] = placesRes.data.map((r: Record<string, unknown>) => {
        const images = r.images as Array<{ url: string }> | null
        return {
          id: r.id as string,
          title: r.title as string,
          imageUrl: images && images.length > 0 ? images[0].url : null,
          likes: likesMap.get(r.id as string) ?? 0,
          tags: tagsMap.get(r.id as string) ?? [],
          latitude: r.latitude as number,
          longitude: r.longitude as number,
        }
      })

      mapped.sort((a, b) => b.likes - a.likes)
      setPlaces(mapped)
      setLoadingPlaces(false)
    })
  }, [data.placeIds])

  async function handlePropose() {
    if (!proposeName.trim() || !userId) return
    setProposing(true)
    setVoteError(null)

    const { data: result } = await supabase.rpc('propose_territory_name', {
      p_user_id: userId,
      p_anchor_place_id: data.anchorPlaceId,
      p_name: proposeName.trim(),
      p_blob_place_ids: data.placeIds,
    })

    setProposing(false)
    const r = result as Record<string, unknown> | null
    if (r?.error) {
      const errMap: Record<string, string> = {
        invalid_length: 'Le nom doit faire entre 3 et 50 caracteres.',
        inappropriate: 'Ce nom contient des termes inappropries.',
        not_eligible: 'Revendiquez au moins 1 lieu dans ce territoire.',
        max_proposals: 'Maximum 3 propositions atteint.',
      }
      setVoteError(errMap[r.error as string] ?? 'Erreur inconnue.')
    } else {
      setProposeName('')
      setShowProposeInput(false)
      await loadVotes()
    }
  }

  async function handleVote(proposalId: string, value: number) {
    if (!userId) return
    setVoteError(null)

    // Determiner le nouveau vote (toggle si meme valeur)
    const proposal = proposals.find(p => p.id === proposalId)
    const oldVote = proposal?.myVote ?? 0
    const newValue = oldVote === value ? 0 : value

    // Mise a jour optimiste
    setProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p
      return {
        ...p,
        netScore: p.netScore - oldVote + newValue,
        myVote: newValue === 0 ? null : newValue,
      }
    }))

    const { data: result } = await supabase.rpc('vote_territory_name', {
      p_user_id: userId,
      p_proposal_id: proposalId,
      p_value: newValue,
      p_blob_place_ids: data.placeIds,
      p_anchor_place_id: data.anchorPlaceId,
    })

    const r = result as Record<string, unknown> | null
    if (r?.error) {
      await loadVotes()
    } else if (r) {
      const winningName = (r.winningName as string | null) ?? null
      useMapStore.getState().setTerritoryName(data.anchorPlaceId, winningName, '')
      onNameSaved(data.anchorPlaceId, winningName)
    }
  }

  function openPlace(placeId: string) {
    setSelectedTerritoryData(null)
    setSelectedPlaceId(placeId)
  }

  return (
    <>
      <div className="place-panel-backdrop" onClick={onClose} />

      <div className="place-panel place-panel-open territory-panel">
        <button className="place-panel-close" onClick={onClose} aria-label="Fermer">
          &times;
        </button>

        <div className="territory-panel-header" style={{ borderColor: data.tagColor }}>
          <h2
            className="territory-panel-title"
            style={{ color: data.customName === null ? '#888' : data.tagColor }}
          >
            {displayTitle}
          </h2>
          <div className="territory-panel-subtitle">
            {'Controle par '}
            <span
              className="territory-panel-faction-link"
              onClick={onFactionModal}
            >
              {data.factionTitle}
            </span>
          </div>
        </div>

        <div className="territory-panel-stats">
          <div className="territory-panel-stat">
            <span className="territory-panel-stat-value">{data.placesCount}</span>
            <span className="territory-panel-stat-label">Lieu{data.placesCount > 1 ? 'x' : ''}</span>
          </div>
          <div className="territory-panel-stat">
            <span className="territory-panel-stat-value">+{data.hourlyRate % 1 === 0 ? data.hourlyRate : data.hourlyRate.toFixed(1)}/h</span>
            <span className="territory-panel-stat-label">Notoriete</span>
          </div>
          <div className="territory-panel-stat">
            <span className="territory-panel-stat-value">{data.totalFortification}</span>
            <span className="territory-panel-stat-label">Fortification</span>
          </div>
        </div>

        {data.players && (
          <div className="territory-panel-section">
            <h3 className="territory-panel-section-title">Joueurs</h3>
            <div className="territory-panel-players">
              {data.players.split(', ').map((name, i) => (
                <span key={i} className="territory-panel-player" style={{ borderColor: data.tagColor }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section Vote */}
        {userId && (
          <div className="territory-panel-section">
            <h3 className="territory-panel-section-title">Nommer ce territoire</h3>

            {votesLoading ? (
              <p className="territory-panel-hint">Chargement...</p>
            ) : votePower < 1 ? (
              <p className="territory-panel-hint">
                Revendiquez un lieu dans ce territoire pour proposer un nom et voter.
              </p>
            ) : (
              <>
                <div className="territory-vote-power">
                  {usedVotes} / {votePower} vote{votePower > 1 ? 's' : ''} utilise{usedVotes > 1 ? 's' : ''}
                </div>

                {proposals.length > 0 && (
                  <div className="territory-vote-list">
                    {proposals.map(p => (
                      <div key={p.id} className="territory-vote-row">
                        <button
                          className={`territory-vote-btn territory-vote-up${p.myVote === 1 ? ' active' : ''}`}
                          onClick={() => handleVote(p.id, 1)}
                          disabled={votePower < 1}
                        >
                          {'\u25B2'}
                        </button>
                        <span className={`territory-vote-score${p.netScore > 0 ? ' positive' : p.netScore < 0 ? ' negative' : ''}`}>
                          {p.netScore > 0 ? '+' : ''}{p.netScore}
                        </span>
                        <button
                          className={`territory-vote-btn territory-vote-down${p.myVote === -1 ? ' active' : ''}`}
                          onClick={() => handleVote(p.id, -1)}
                          disabled={votePower < 1}
                        >
                          {'\u25BC'}
                        </button>
                        <span className="territory-vote-name">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {proposals.length === 0 && (
                  <p className="territory-panel-hint">Aucune proposition pour le moment.</p>
                )}

                {showProposeInput ? (
                  <div className="territory-panel-name-form">
                    <input
                      type="text"
                      className="territory-panel-name-input"
                      placeholder="Votre proposition (3-50 car.)"
                      value={proposeName}
                      onChange={e => setProposeName(e.target.value)}
                      maxLength={50}
                      autoFocus
                    />
                    <button
                      className="territory-panel-name-btn"
                      onClick={handlePropose}
                      disabled={proposing || !proposeName.trim()}
                    >
                      {proposing ? '...' : 'Proposer'}
                    </button>
                    <button
                      className="territory-panel-name-btn territory-panel-cancel-btn"
                      onClick={() => { setShowProposeInput(false); setProposeName(''); setVoteError(null) }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : proposalsCount < 3 && (
                  <button
                    className="territory-propose-btn"
                    onClick={() => setShowProposeInput(true)}
                  >
                    + Proposer un nom
                  </button>
                )}

                {voteError && <div className="territory-panel-error">{voteError}</div>}
              </>
            )}
          </div>
        )}

        <div className="territory-panel-section">
          <h3 className="territory-panel-section-title">Lieux</h3>
          {loadingPlaces && <p className="territory-panel-hint">Chargement...</p>}
          <div className="territory-places-list">
            {places.map(p => (
              <div key={p.id} className="territory-place-row" onClick={() => openPlace(p.id)}>
                <div className="territory-place-img-wrap">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="territory-place-img" />
                  ) : (
                    <div className="territory-place-img-empty" />
                  )}
                </div>
                <div className="territory-place-info">
                  <div className="territory-place-name">{p.title}</div>
                  {p.tags.length > 0 && (
                    <div className="territory-place-tags">
                      {p.tags.map(tag => (
                        <span
                          key={tag.id}
                          className="territory-place-tag"
                          style={{ color: tag.color, backgroundColor: tag.background }}
                        >
                          {tag.icon && (
                            <span
                              className="territory-place-tag-icon"
                              style={{
                                WebkitMaskImage: `url(${tag.icon})`,
                                maskImage: `url(${tag.icon})`,
                              }}
                            />
                          )}
                          {tag.title}
                        </span>
                      ))}
                    </div>
                  )}
                  {userPosition && (
                    <div className="territory-place-meta">
                      <span className="territory-place-dist">
                        {formatDistance(distanceKm(userPosition.lat, userPosition.lng, p.latitude, p.longitude))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="territory-place-likes">
                  <span>{'\u2764\uFE0F'}</span>
                  <span>{p.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
