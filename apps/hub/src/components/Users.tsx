import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { syncUserTagsToShopify } from '../lib/shopifyTags'

type Role = 'user' | 'ambassador' | 'moderator' | 'admin'

interface HubUser {
  id: string
  email_address: string
  first_name: string | null
  display_name: string | null
  role: Role
  is_active: boolean
  created_at: string
  last_login_at: string | null
  isPending?: boolean
  account_source?: string | null
  shopify_customer_id?: number | null
  faction_title?: string | null
  isClient?: boolean
  exploration_points?: number
  erudition_points?: number
  influence_stock?: number
}

const ROLE_LABELS: Record<Role, string> = {
  user: 'Utilisateur',
  ambassador: 'Ambassadeur',
  moderator: 'Moderateur',
  admin: 'Admin'
}

const ROLE_COLORS: Record<Role, string> = {
  user: '#6b7280',
  ambassador: '#f59e0b',
  moderator: '#3b82f6',
  admin: '#ef4444'
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const PER_PAGE = 50

export function Users() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<HubUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'app' | 'shopify'>('all')

  useEffect(() => {
    let ignore = false

    async function fetchUsers() {
      try {
        const PAGE_SIZE = 1000
        let allUsers: HubUser[] = []
        let from = 0

        while (true) {
          let query = supabase
            .from('users')
            .select('id, email_address, first_name, display_name, role, is_active, created_at, last_login_at, account_source, shopify_customer_id, exploration_points, erudition_points, influence_stock, factions(title)')
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1)

          if (search) {
            query = query.or(`email_address.ilike.%${search}%,first_name.ilike.%${search}%,display_name.ilike.%${search}%`)
          }

          const { data } = await query
          if (ignore) return
          if (data && data.length > 0) {
            const mapped = data.map((u: Record<string, unknown>) => {
              const { factions, ...rest } = u
              return {
                ...rest,
                faction_title: (factions as { title: string } | null)?.title ?? null,
              }
            }) as unknown as HubUser[]
            allUsers = allUsers.concat(mapped)
            if (data.length < PAGE_SIZE) break
            from += PAGE_SIZE
          } else {
            break
          }
        }

        // Charger les emails pending (pas encore de compte)
        const { data: pendingData } = await supabase
          .from('purchase_log')
          .select('email, created_at')
          .eq('status', 'pending')

        if (!ignore && pendingData) {
          const existingEmails = new Set(allUsers.map(u => u.email_address.toLowerCase()))
          const pendingEmails = new Map<string, string>()
          for (const p of pendingData as Array<{ email: string; created_at: string }>) {
            if (p.email && !existingEmails.has(p.email.toLowerCase()) && !pendingEmails.has(p.email.toLowerCase())) {
              pendingEmails.set(p.email.toLowerCase(), p.created_at)
            }
          }
          const pendingUsers: HubUser[] = Array.from(pendingEmails.entries()).map(([email, created]) => ({
            id: `pending-${email}`,
            email_address: email,
            first_name: null,
            display_name: null,
            role: 'user' as Role,
            is_active: false,
            created_at: created,
            last_login_at: null,
            isPending: true,
          }))
          allUsers = [...allUsers, ...pendingUsers]
        }

        // Charger les emails clients (ont au moins un achat confirmé)
        const { data: clientData } = await supabase
          .from('purchase_log')
          .select('email')
          .eq('status', 'unlocked')
        if (!ignore && clientData) {
          const clientEmails = new Set(
            (clientData as Array<{ email: string }>)
              .map(c => c.email?.toLowerCase())
              .filter(Boolean)
          )
          allUsers = allUsers.map(u => ({
            ...u,
            isClient: clientEmails.has(u.email_address.toLowerCase()),
          }))
        }

        if (!ignore) setUsers(allUsers)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    setPage(1)
    const debounce = setTimeout(fetchUsers, 300)
    return () => { ignore = true; clearTimeout(debounce) }
  }, [search])

  const sortedUsers = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    function priority(u: HubUser) {
      const createdAt = new Date(u.created_at).getTime()
      if (createdAt > cutoff) return 0 // Nouveau
      if (u.last_login_at && new Date(u.last_login_at).getTime() > cutoff) return 1 // Réactivé
      return 2 // Reste
    }
    const sorted = [...users]
    sorted.sort((a, b) => {
      const pa = priority(a)
      const pb = priority(b)
      if (pa !== pb) return pa - pb
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortAsc ? ta - tb : tb - ta
    })
    return sorted
  }, [users, sortAsc])

  const filteredUsers = useMemo(() => {
    if (sourceFilter === 'all') return sortedUsers
    return sortedUsers.filter(u => (u.account_source || 'app') === sourceFilter)
  }, [sortedUsers, sourceFilter])

  const totalCount = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return filteredUsers.slice(start, start + PER_PAGE)
  }, [filteredUsers, page])

  const sourceCounts = useMemo(() => ({
    all: users.length,
    app: users.filter(u => (u.account_source || 'app') === 'app').length,
    shopify: users.filter(u => u.account_source === 'shopify').length,
  }), [users])

  const recentCounts = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    const recent = users.filter(u => new Date(u.created_at).getTime() > cutoff)
    return {
      app: recent.filter(u => (u.account_source || 'app') !== 'shopify').length,
      shopify: recent.filter(u => u.account_source === 'shopify').length,
    }
  }, [users])

  const stats = useMemo(() => {
    const appUsers = users.filter(u => u.account_source !== 'shopify' && !u.isPending)
    const withLogin = appUsers.filter(u => u.last_login_at)
    const active30d = withLogin.filter(u => u.last_login_at && (Date.now() - new Date(u.last_login_at).getTime()) < THIRTY_DAYS_MS)
    const active7d = withLogin.filter(u => u.last_login_at && (Date.now() - new Date(u.last_login_at).getTime()) < SEVEN_DAYS_MS)
    const shopifyOnly = users.filter(u => u.account_source === 'shopify')
    const shopifyWithLogin = shopifyOnly.filter(u => u.last_login_at)
    const conversionRate = shopifyOnly.length > 0
      ? Math.round((shopifyWithLogin.length / shopifyOnly.length) * 100)
      : 0

    return {
      totalApp: appUsers.length,
      active30d: active30d.length,
      active7d: active7d.length,
      retention30d: appUsers.length > 0 ? Math.round((active30d.length / appUsers.length) * 100) : 0,
      retention7d: appUsers.length > 0 ? Math.round((active7d.length / appUsers.length) * 100) : 0,
      shopifyConversion: conversionRate,
      neverConnected: appUsers.filter(u => !u.last_login_at).length,
    }
  }, [users])

  // Reset page quand on change le tri
  useEffect(() => { setPage(1) }, [sortAsc])

  const updateRole = async (userId: string, newRole: Role) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      // Sync tags vers Shopify (fire-and-forget)
      const user = users.find(u => u.id === userId)
      if (user?.shopify_customer_id) {
        syncUserTagsToShopify(user).catch(() => {})
      }
    }
    setEditingRole(null)
  }

  const toggleActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentActive })
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u))
      // Sync tags vers Shopify (fire-and-forget)
      const user = users.find(u => u.id === userId)
      if (user?.shopify_customer_id) {
        syncUserTagsToShopify(user).catch(() => {})
      }
    }
  }

  const now = Date.now()
  const [showExport, setShowExport] = useState(false)

  const cutoffMs = Date.now() - SEVEN_DAYS_MS
  const newUsers = users.filter(u => !u.isPending && new Date(u.created_at).getTime() > cutoffMs)
  const reactivatedUsers = users.filter(u => !u.isPending && new Date(u.created_at).getTime() <= cutoffMs && u.last_login_at && new Date(u.last_login_at).getTime() > cutoffMs)
  const dormantUsers = users.filter(u => !u.isPending && new Date(u.created_at).getTime() <= cutoffMs && (!u.last_login_at || new Date(u.last_login_at).getTime() <= cutoffMs))

  function exportEmails(filter: 'all' | 'active' | 'inactive' | 'pending' | 'validated' | 'new' | 'reactivated' | 'dormant') {
    let filtered: HubUser[]
    let label: string
    switch (filter) {
      case 'active':
        filtered = users.filter(u => !u.isPending && u.is_active)
        label = 'actifs'
        break
      case 'inactive':
        filtered = users.filter(u => !u.isPending && !u.is_active)
        label = 'inactifs'
        break
      case 'pending':
        filtered = users.filter(u => u.isPending)
        label = 'en attente'
        break
      case 'validated':
        filtered = users.filter(u => !u.isPending)
        label = 'valides'
        break
      case 'new':
        filtered = newUsers
        label = 'nouveaux (< 7j)'
        break
      case 'reactivated':
        filtered = reactivatedUsers
        label = 'reactives (login < 7j)'
        break
      case 'dormant':
        filtered = dormantUsers
        label = 'anciens non reactives'
        break
      default:
        filtered = users
        label = 'tous'
    }
    const emails = filtered.map(u => u.email_address)
    if (emails.length === 0) { alert('Aucun email'); return }
    navigator.clipboard.writeText(emails.join('\n'))
    alert(`${emails.length} email(s) ${label} copie(s)`)
    setShowExport(false)
  }

  return (
    <div className="users">
      <div className="page-header">
        <h1>Utilisateurs</h1>
        <div className="page-header-actions">
          <div className="users-export-wrap">
            <button className="users-export-btn" onClick={() => setShowExport(!showExport)}>
              Exporter &#9662;
            </button>
            {showExport && (
              <div className="users-export-dropdown">
                <button onClick={() => exportEmails('new')}>Nouveaux &lt; 7j ({newUsers.length})</button>
                <button onClick={() => exportEmails('reactivated')}>Reactives &lt; 7j ({reactivatedUsers.length})</button>
                <button onClick={() => exportEmails('dormant')}>Anciens non reactives ({dormantUsers.length})</button>
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid rgba(193,154,107,0.3)' }} />
                <button onClick={() => exportEmails('validated')}>Comptes valides ({users.filter(u => !u.isPending).length})</button>
                <button onClick={() => exportEmails('active')}>Comptes actifs ({users.filter(u => !u.isPending && u.is_active).length})</button>
                <button onClick={() => exportEmails('inactive')}>Comptes inactifs ({users.filter(u => !u.isPending && !u.is_active).length})</button>
                <button onClick={() => exportEmails('pending')}>Comptes en attente ({users.filter(u => u.isPending).length})</button>
                <button onClick={() => exportEmails('all')}>Tous les comptes ({users.length})</button>
              </div>
            )}
          </div>
          <input
            type="search"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!loading && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(193,154,107,0.08)', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.totalApp}</div>
              <div style={{ fontSize: 11, color: '#6b5a47' }}>Joueurs app</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(42,122,48,0.08)', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2a7a30' }}>{stats.active7d}</div>
              <div style={{ fontSize: 11, color: '#6b5a47' }}>Actifs 7j ({stats.retention7d}%)</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(42,122,48,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2a7a30' }}>{stats.active30d}</div>
              <div style={{ fontSize: 11, color: '#6b5a47' }}>Actifs 30j ({stats.retention30d}%)</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: 'rgba(184,134,11,0.08)', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#b8860b' }}>{stats.shopifyConversion}%</div>
              <div style={{ fontSize: 11, color: '#6b5a47' }}>Clients Shopify → App</div>
            </div>
          </div>
          <div className="users-stats">
            {recentCounts.app > 0 && (
              <span className="users-stat users-stat-new">
                🗺️ <strong>{recentCounts.app}</strong> nouveau{recentCounts.app > 1 ? 'x' : ''} compte{recentCounts.app > 1 ? 's' : ''} app (7j)
              </span>
            )}
            {recentCounts.shopify > 0 && (
              <span className="users-stat" style={{ color: '#b8860b' }}>
                🛒 <strong>{recentCounts.shopify}</strong> nouveau{recentCounts.shopify > 1 ? 'x' : ''} client{recentCounts.shopify > 1 ? 's' : ''} Shopify (7j)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className={sourceFilter === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setSourceFilter('all'); setPage(1) }}>
              Tous ({sourceCounts.all})
            </button>
            <button className={sourceFilter === 'app' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setSourceFilter('app'); setPage(1) }} style={sourceFilter === 'app' ? { background: '#6b46c1' } : { color: '#6b46c1', borderColor: '#6b46c1' }}>
              🗺️ App ({sourceCounts.app})
            </button>
            <button className={sourceFilter === 'shopify' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setSourceFilter('shopify'); setPage(1) }} style={sourceFilter === 'shopify' ? { background: '#b8860b' } : { color: '#b8860b', borderColor: '#b8860b' }}>
              🛒 Shopify ({sourceCounts.shopify})
            </button>
          </div>
        </>
      )}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : users.length === 0 ? (
        <div className="empty">Aucun utilisateur</div>
      ) : (
        <>
          <table className="users-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Source</th>
                <th>Client</th>
                <th>Gloire</th>
                <th>Role</th>
                <th>Statut</th>
                <th
                  className="users-th-sortable"
                  onClick={() => setSortAsc(!sortAsc)}
                  title="Cliquer pour inverser le tri"
                >
                  Inscription {sortAsc ? '\u25B2' : '\u25BC'}
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map(user => {
                const isNew = (now - new Date(user.created_at).getTime()) < SEVEN_DAYS_MS
                const isReactivated = !isNew && user.last_login_at && (now - new Date(user.last_login_at).getTime()) < SEVEN_DAYS_MS
                return (
                  <tr
                    key={user.id}
                    className={`users-row-clickable${!user.is_active ? ' inactive' : ''}`}
                    onClick={() => !user.isPending && navigate(`/users/${encodeURIComponent(user.id)}`)}
                    style={user.isPending ? undefined : { cursor: 'pointer' }}
                  >
                    <td>
                      {user.display_name || user.first_name || '-'}
                      {user.isPending && <span className="users-pending-badge">En attente</span>}
                      {isNew && !user.isPending && <span className="users-new-badge">Nouveau !</span>}
                      {isReactivated && <span className="users-reactivated-badge">Reactive !</span>}
                    </td>
                    <td>{user.email_address}</td>
                    <td style={{ fontSize: 11 }}>
                      {(user.account_source || 'app') === 'app' && <span style={{ color: '#6b46c1' }}>🗺️ App</span>}
                      {user.account_source === 'shopify' && <span style={{ color: '#b8860b' }}>🛒 Shopify</span>}
                    </td>
                    <td style={{ fontSize: 11, textAlign: 'center' }}>
                      {user.isClient
                        ? <span style={{ color: '#2a7a30', fontWeight: 600 }}>Oui</span>
                        : <span style={{ color: '#8A7B6A' }}>Non</span>
                      }
                    </td>
                    <td style={{ fontSize: 11, textAlign: 'center' }} title={`Exploration: ${user.exploration_points ?? 0} | Erudition: ${user.erudition_points ?? 0} | Influence: ${user.influence_stock ?? 0}`}>
                      {user.isPending ? '-' : (user.exploration_points ?? 0) + (user.erudition_points ?? 0)}
                    </td>
                    <td>
                      {user.isPending ? (
                        <span className="role-badge" style={{ backgroundColor: '#a08060', cursor: 'default' }}>En attente</span>
                      ) : editingRole === user.id ? (
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value as Role)}
                          onBlur={() => setEditingRole(null)}
                          autoFocus
                        >
                          <option value="user">Utilisateur</option>
                          <option value="ambassador">Ambassadeur</option>
                          <option value="moderator">Moderateur</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span
                          className="role-badge"
                          style={{ backgroundColor: ROLE_COLORS[user.role || 'user'], cursor: 'pointer' }}
                          onClick={() => setEditingRole(user.id)}
                          title="Cliquer pour modifier"
                        >
                          {ROLE_LABELS[user.role || 'user']}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {user.account_source === 'shopify' ? (
                        <span style={{ color: '#b8860b', fontWeight: 600 }}>⏳ En attente</span>
                      ) : user.last_login_at && (now - new Date(user.last_login_at).getTime()) < THIRTY_DAYS_MS ? (
                        <span style={{ color: '#2a7a30', fontWeight: 600 }}>🟢 Actif</span>
                      ) : user.last_login_at ? (
                        <span style={{ color: '#8A7B6A', fontWeight: 600 }}>💤 Inactif</span>
                      ) : (
                        <span style={{ color: '#6b5a47', fontWeight: 600 }}>❓ Jamais connecté</span>
                      )}
                      {user.last_login_at && (
                        <div style={{ color: '#8A7B6A', fontSize: 10 }}>
                          {new Date(user.last_login_at).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="users-pagination">
              <button
                className="users-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Precedent
              </button>
              <span className="users-page-info">
                Page {page} / {totalPages}
              </span>
              <button
                className="users-page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
