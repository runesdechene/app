import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface FragmentInfo {
  id: number
  name: string
  icon: string | null
  image_url: string | null
  bonus_type: string | null
  bonus_value: number
}

interface PlayerResult {
  id: string
  first_name: string | null
  email_address: string
  avatar_url: string | null
}

export function AssignFragments() {
  const [fragments, setFragments] = useState<FragmentInfo[]>([])
  const [loading, setLoading] = useState(true)

  // Recherche joueur
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PlayerResult[]>([])
  const [searching, setSearching] = useState(false)

  // Mode 1 : joueur existant
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null)
  const [playerFragmentIds, setPlayerFragmentIds] = useState<Set<number>>(new Set())

  // Mode 2 : email pending (pas encore de compte)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [pendingFragmentIds, setPendingFragmentIds] = useState<Set<number>>(new Set())

  const [toggling, setToggling] = useState<number | null>(null)

  // Quel mode est actif
  const isPlayerMode = selectedPlayer !== null
  const isPendingMode = pendingEmail !== null
  const isActive = isPlayerMode || isPendingMode
  const activeFragmentIds = isPlayerMode ? playerFragmentIds : pendingFragmentIds

  useEffect(() => {
    fetchFragments()
  }, [])

  async function fetchFragments() {
    try {
      const { data } = await supabase
        .from('title_fragments')
        .select('id, name, icon, image_url, bonus_type, bonus_value')
        .order('created_at', { ascending: false })
      if (data) setFragments(data as FragmentInfo[])
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(query: string) {
    setSearch(query)
    if (query.length < 2) { setResults([]); return }
    setSearching(true)

    const { data } = await supabase
      .from('users')
      .select('id, first_name, email_address, avatar_url')
      .or(`first_name.ilike.%${query}%,email_address.ilike.%${query}%`)
      .limit(8)

    setResults((data ?? []) as PlayerResult[])
    setSearching(false)
  }

  async function selectPlayer(player: PlayerResult) {
    setSelectedPlayer(player)
    setPendingEmail(null)
    setSearch('')
    setResults([])

    const { data } = await supabase
      .from('user_fragments')
      .select('fragment_id')
      .eq('user_id', player.id)

    setPlayerFragmentIds(new Set(data ? data.map(d => d.fragment_id) : []))
    setPendingFragmentIds(new Set())
  }

  async function selectPendingEmail() {
    const email = search.trim().toLowerCase()
    if (!email) return

    setPendingEmail(email)
    setSelectedPlayer(null)
    setSearch('')
    setResults([])

    // Charger les fragments pending existants pour cet email
    const { data } = await supabase
      .from('purchase_log')
      .select('unlock_ref_id')
      .eq('email', email)
      .eq('status', 'pending')
      .eq('unlock_type', 'fragment')

    setPendingFragmentIds(new Set(data ? data.map(d => d.unlock_ref_id) : []))
    setPlayerFragmentIds(new Set())
  }

  function resetSelection() {
    setSelectedPlayer(null)
    setPendingEmail(null)
    setPlayerFragmentIds(new Set())
    setPendingFragmentIds(new Set())
  }

  async function toggleFragment(fragmentId: number) {
    if (toggling !== null) return
    setToggling(fragmentId)

    if (isPlayerMode && selectedPlayer) {
      // Mode joueur existant : insert/delete dans user_fragments
      const has = playerFragmentIds.has(fragmentId)

      if (has) {
        const { error } = await supabase.from('user_fragments').delete()
          .eq('user_id', selectedPlayer.id).eq('fragment_id', fragmentId)
        if (!error) {
          setPlayerFragmentIds(prev => { const n = new Set(prev); n.delete(fragmentId); return n })
        }
      } else {
        const { error } = await supabase.from('user_fragments')
          .upsert({ user_id: selectedPlayer.id, fragment_id: fragmentId, source: 'manual' })
        if (!error) {
          setPlayerFragmentIds(prev => { const n = new Set(prev); n.add(fragmentId); return n })
          await supabase.from('purchase_log').insert({
            email: selectedPlayer.email_address,
            user_id: selectedPlayer.id,
            unlock_type: 'fragment',
            unlock_ref_id: fragmentId,
            status: 'manual',
          })
        }
      }
    } else if (isPendingMode && pendingEmail) {
      // Mode pending : insert/delete dans purchase_log
      const has = pendingFragmentIds.has(fragmentId)

      if (has) {
        await supabase.from('purchase_log').delete()
          .eq('email', pendingEmail).eq('unlock_ref_id', fragmentId).eq('status', 'pending')
        setPendingFragmentIds(prev => { const n = new Set(prev); n.delete(fragmentId); return n })
      } else {
        await supabase.from('purchase_log').insert({
          email: pendingEmail,
          unlock_type: 'fragment',
          unlock_ref_id: fragmentId,
          status: 'pending',
        })
        setPendingFragmentIds(prev => { const n = new Set(prev); n.add(fragmentId); return n })
      }
    }

    setToggling(null)
  }

  const isEmail = search.includes('@') && search.includes('.')
  const noResults = !searching && search.length >= 2 && results.length === 0

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Associer Fragments</h1>
        <span className="tags-count">{fragments.length} fragments</span>
      </div>

      {/* Recherche / Selection */}
      <div className="assign-search-section">
        {isActive ? (
          <div className="assign-selected-player clickable" onClick={resetSelection}>
            {isPlayerMode && selectedPlayer ? (
              <>
                {selectedPlayer.avatar_url ? (
                  <img src={selectedPlayer.avatar_url} alt="" className="assign-player-avatar" />
                ) : (
                  <div className="assign-player-avatar-fallback">
                    {(selectedPlayer.first_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="assign-player-info">
                  <span className="assign-player-name">{selectedPlayer.first_name || 'Sans nom'}</span>
                  <span className="assign-player-email">{selectedPlayer.email_address}</span>
                </div>
                <span className="assign-player-count">
                  {playerFragmentIds.size} / {fragments.length}
                </span>
              </>
            ) : (
              <>
                <div className="assign-player-avatar-fallback assign-pending-icon">@</div>
                <div className="assign-player-info">
                  <span className="assign-player-name">{pendingEmail}</span>
                  <span className="assign-player-email assign-pending-label">En attente d'inscription</span>
                </div>
                <span className="assign-player-count">
                  {pendingFragmentIds.size} / {fragments.length}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="assign-search-wrap">
            <input
              type="text"
              placeholder="Rechercher un joueur (nom ou email)..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isEmail && noResults && selectPendingEmail()}
              className="assign-search-input"
              autoFocus
            />
            {searching && <span className="assign-searching">Recherche...</span>}
            {(results.length > 0 || (noResults && isEmail)) && (
              <div className="assign-search-results">
                {results.map(p => (
                  <button key={p.id} className="assign-search-result" onClick={() => selectPlayer(p)}>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="assign-result-avatar" />
                    ) : (
                      <div className="assign-result-avatar-fallback">
                        {(p.first_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="assign-result-name">{p.first_name || 'Sans nom'}</span>
                    <span className="assign-result-email">{p.email_address}</span>
                  </button>
                ))}
                {noResults && isEmail && (
                  <button className="assign-search-result assign-create-option" onClick={selectPendingEmail}>
                    <div className="assign-result-avatar-fallback assign-create-icon">+</div>
                    <span className="assign-result-name">Enregistrer pour {search.trim()}</span>
                    <span className="assign-result-email">Fragments en attente d'inscription</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grille de fragments */}
      {isActive && (
        <div className="assign-fragments-grid">
          {fragments.map(f => {
            const owned = activeFragmentIds.has(f.id)
            const isToggling = toggling === f.id
            return (
              <button
                key={f.id}
                className={`assign-fragment-card${owned ? ' owned' : ''}`}
                onClick={() => toggleFragment(f.id)}
                disabled={isToggling}
              >
                <div className="assign-fragment-check">
                  {owned ? '\u2705' : '\u2B1C'}
                </div>
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="assign-fragment-img" />
                ) : f.icon ? (
                  <span className="assign-fragment-icon">{f.icon}</span>
                ) : (
                  <span className="assign-fragment-icon">?</span>
                )}
                <span className="assign-fragment-name">{f.name}</span>
                {f.bonus_type && f.bonus_value !== 0 && (
                  <span className="assign-fragment-bonus">
                    {f.bonus_value > 0 ? '+' : ''}{f.bonus_value} {f.bonus_type.replace('max_', 'Max ').replace('regen_', '% Regen ').replace('energy', 'Energie').replace('conquest', 'Conquete').replace('construction', 'Construction')}
                  </span>
                )}
                {isToggling && <span className="assign-fragment-loading">...</span>}
              </button>
            )
          })}
        </div>
      )}

      {!isActive && (
        <div className="assign-empty">
          Recherchez un joueur ou entrez un email pour associer des fragments.
        </div>
      )}
    </div>
  )
}
