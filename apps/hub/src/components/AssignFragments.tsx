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

  // Création compte stand (festival) — modale avec champ prénom focus auto
  const [firstNameInput, setFirstNameInput] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accountModalEmail, setAccountModalEmail] = useState('')

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
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)

    const { data } = await supabase
      .from('users_admin')
      .select('id, first_name, email_address, avatar_url')
      .or(`first_name.ilike.%${q}%,email_address.ilike.%${q}%`)
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
    setFirstNameInput('')

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

  function openCreateAccountModal() {
    const email = search.trim().toLowerCase()
    if (!email) return
    setAccountModalEmail(email)
    setFirstNameInput('')
    setAccountModalOpen(true)
  }

  function closeCreateAccountModal() {
    if (creatingAccount) return
    setAccountModalOpen(false)
    setFirstNameInput('')
  }

  async function confirmCreateStandAccount() {
    if (!accountModalEmail || creatingAccount) return

    setCreatingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) {
        alert('Session expirée — reconnecte-toi.')
        return
      }

      const resp = await fetch('/.netlify/functions/stand-create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          email: accountModalEmail,
          firstName: firstNameInput.trim() || null,
        }),
      })

      const data = await resp.json()
      if (!resp.ok || !data.success) {
        alert(`Échec création compte : ${data.error || resp.statusText}`)
        return
      }

      // Bascule en mode joueur existant avec le user retourné
      const u = data.user as { id: string; first_name: string | null; email_address: string; avatar_url: string | null }
      setSelectedPlayer({
        id: u.id,
        first_name: u.first_name,
        email_address: u.email_address,
        avatar_url: u.avatar_url,
      })
      setPendingEmail(null)
      setSearch('')
      setResults([])
      setFirstNameInput('')
      setAccountModalOpen(false)
      setAccountModalEmail('')
      setPlayerFragmentIds(new Set())
      setPendingFragmentIds(new Set())
    } catch (err) {
      alert(`Erreur : ${err}`)
    } finally {
      setCreatingAccount(false)
    }
  }

  function resetSelection() {
    setSelectedPlayer(null)
    setPendingEmail(null)
    setPlayerFragmentIds(new Set())
    setPendingFragmentIds(new Set())
    setFirstNameInput('')
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
                  <>
                    <button
                      className="assign-search-result assign-create-option assign-create-account"
                      onClick={openCreateAccountModal}
                    >
                      <div className="assign-result-avatar-fallback assign-create-icon">+</div>
                      <span className="assign-result-name">Créer un compte pour {search.trim()}</span>
                      <span className="assign-result-email">Compte + email Shopify de bienvenue</span>
                    </button>
                    <button
                      className="assign-search-result assign-create-option assign-create-pending"
                      onClick={selectPendingEmail}
                    >
                      <div className="assign-result-avatar-fallback assign-create-icon">…</div>
                      <span className="assign-result-name">Mettre en attente pour {search.trim()}</span>
                      <span className="assign-result-email">Fragments en attente, claim plus tard</span>
                    </button>
                  </>
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

      {accountModalOpen && (
        <div className="modal-overlay" onClick={closeCreateAccountModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Créer un compte au stand</h2>
            <p className="modal-subtitle">
              Email : <strong>{accountModalEmail}</strong>
            </p>

            <label className="modal-label">Prénom du client</label>
            <input
              type="text"
              autoFocus
              value={firstNameInput}
              onChange={e => setFirstNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmCreateStandAccount()
                if (e.key === 'Escape') closeCreateAccountModal()
              }}
              placeholder="Alice"
              className="modal-input"
              disabled={creatingAccount}
            />
            <p className="modal-hint">
              Optionnel — utilisé pour personnaliser l'email Shopify de bienvenue.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-cancel"
                onClick={closeCreateAccountModal}
                disabled={creatingAccount}
              >
                Annuler
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-confirm"
                onClick={confirmCreateStandAccount}
                disabled={creatingAccount}
              >
                {creatingAccount ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
