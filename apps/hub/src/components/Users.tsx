import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

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
const PER_PAGE = 50

export function Users() {
  const [users, setUsers] = useState<HubUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const PAGE_SIZE = 1000
        let allUsers: HubUser[] = []
        let from = 0

        while (true) {
          let query = supabase
            .from('users')
            .select('id, email_address, first_name, display_name, role, is_active, created_at, last_login_at')
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1)

          if (search) {
            query = query.or(`email_address.ilike.%${search}%,first_name.ilike.%${search}%,display_name.ilike.%${search}%`)
          }

          const { data } = await query
          if (data && data.length > 0) {
            allUsers = allUsers.concat(data as HubUser[])
            if (data.length < PAGE_SIZE) break
            from += PAGE_SIZE
          } else {
            break
          }
        }

        setUsers(allUsers)
      } finally {
        setLoading(false)
      }
    }

    setPage(1)
    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const sortedUsers = useMemo(() => {
    const sorted = [...users]
    sorted.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortAsc ? ta - tb : tb - ta
    })
    return sorted
  }, [users, sortAsc])

  const totalCount = users.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return sortedUsers.slice(start, start + PER_PAGE)
  }, [sortedUsers, page])

  const recentCount = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return users.filter(u => new Date(u.created_at).getTime() > cutoff).length
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
    }
  }

  const now = Date.now()

  return (
    <div className="users">
      <div className="page-header">
        <h1>Utilisateurs</h1>
        <input
          type="search"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!loading && (
        <div className="users-stats">
          <span className="users-stat">
            <strong>{totalCount}</strong> utilisateur{totalCount > 1 ? 's' : ''}
          </span>
          <span className="users-stat users-stat-new">
            <strong>{recentCount}</strong> nouveau{recentCount > 1 ? 'x' : ''} cette semaine
          </span>
        </div>
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
                <th>Role</th>
                <th>Actif</th>
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
                  <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                    <td>
                      {user.display_name || user.first_name || '-'}
                      {isNew && <span className="users-new-badge">Nouveau !</span>}
                      {isReactivated && <span className="users-reactivated-badge">Reactive !</span>}
                    </td>
                    <td>{user.email_address}</td>
                    <td>
                      {editingRole === user.id ? (
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
                    <td>
                      <button
                        className={`toggle-btn ${user.is_active ? 'active' : 'inactive'}`}
                        onClick={() => toggleActive(user.id, user.is_active)}
                      >
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </button>
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
