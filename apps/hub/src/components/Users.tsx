import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Role = 'user' | 'ambassador' | 'moderator' | 'admin'

interface HubUser {
  id: string
  email_address: string
  first_name: string | null
  last_name: string
  display_name: string | null
  role: Role
  is_active: boolean
  created_at: string
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

export function Users() {
  const [users, setUsers] = useState<HubUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsers() {
      let query = supabase
        .from('users')
        .select('id, email_address, first_name, last_name, display_name, role, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (search) {
        query = query.ilike('email_address', `%${search}%`)
      }

      const { data } = await query
      setUsers(data || [])
      setLoading(false)
    }

    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [search])

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

  return (
    <div className="users">
      <div className="page-header">
        <h1>Utilisateurs</h1>
        <input
          type="search"
          placeholder="Rechercher par email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : users.length === 0 ? (
        <div className="empty">Aucun utilisateur</div>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actif</th>
              <th>Inscription</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                <td>{user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-'}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
