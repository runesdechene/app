import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface RoleGauges {
  maxEnergy: number
  maxConquest: number
  maxConstruction: number
}

interface UserGauge {
  id: string
  name: string
  role: string
  maxEnergy: number
  maxConquest: number
  maxConstruction: number
}

const ROLES = ['user', 'admin'] as const

export function Settings() {
  const [roleDefaults, setRoleDefaults] = useState<Record<string, RoleGauges>>({
    user: { maxEnergy: 5, maxConquest: 5, maxConstruction: 5 },
    admin: { maxEnergy: 10, maxConquest: 10, maxConstruction: 10 },
  })
  const [users, setUsers] = useState<UserGauge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    // Charger les valeurs moyennes par role (pour pre-remplir les inputs)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, first_name, email_address, role, max_energy, max_conquest, max_construction')
      .order('role')
      .order('first_name')

    if (usersData) {
      const mapped: UserGauge[] = usersData.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        name: (u.first_name as string) || (u.email_address as string) || 'Anonyme',
        role: (u.role as string) || 'user',
        maxEnergy: Number(u.max_energy) || 5,
        maxConquest: Number(u.max_conquest) || 5,
        maxConstruction: Number(u.max_construction) || 5,
      }))
      setUsers(mapped)

      // Calculer les valeurs par role (prendre le premier trouvé)
      const byRole: Record<string, RoleGauges> = {}
      for (const role of ROLES) {
        const first = mapped.find(u => u.role === role)
        if (first) {
          byRole[role] = {
            maxEnergy: first.maxEnergy,
            maxConquest: first.maxConquest,
            maxConstruction: first.maxConstruction,
          }
        }
      }
      setRoleDefaults(prev => ({ ...prev, ...byRole }))
    }

    setLoading(false)
  }

  async function applyToRole(role: string) {
    const gauges = roleDefaults[role]
    if (!gauges) return

    setSaving(role)
    await supabase
      .from('users')
      .update({
        max_energy: gauges.maxEnergy,
        max_conquest: gauges.maxConquest,
        max_construction: gauges.maxConstruction,
      })
      .eq('role', role)

    // Mettre a jour la liste locale
    setUsers(prev =>
      prev.map(u =>
        u.role === role
          ? { ...u, maxEnergy: gauges.maxEnergy, maxConquest: gauges.maxConquest, maxConstruction: gauges.maxConstruction }
          : u
      )
    )
    setSaving(null)
  }

  function handleRoleChange(role: string, field: keyof RoleGauges, value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setRoleDefaults(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: num },
    }))
  }

  async function handleUserChange(userId: string, field: 'maxEnergy' | 'maxConquest' | 'maxConstruction', value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: num } : u))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const dbField = field === 'maxEnergy' ? 'max_energy' : field === 'maxConquest' ? 'max_conquest' : 'max_construction'
      await supabase
        .from('users')
        .update({ [dbField]: num })
        .eq('id', userId)
    }, 600)
  }

  if (loading) {
    return <div className="section"><p>Chargement...</p></div>
  }

  return (
    <div className="section">
      <h1>Reglages</h1>

      <div className="divers-card">
        <h3>Jauges par role</h3>
        <p className="divers-description">
          Definir les limites max d'energie, conquete et construction par role.
          Cliquer "Appliquer" met a jour tous les utilisateurs de ce role.
        </p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Max Energie</th>
              <th>Max Conquete</th>
              <th>Max Construction</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map(role => (
              <tr key={role}>
                <td className="settings-role-label">
                  {role === 'admin' ? 'Admin' : 'Joueur'}
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={roleDefaults[role]?.maxEnergy ?? 5}
                    onChange={e => handleRoleChange(role, 'maxEnergy', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={roleDefaults[role]?.maxConquest ?? 5}
                    onChange={e => handleRoleChange(role, 'maxConquest', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={roleDefaults[role]?.maxConstruction ?? 5}
                    onChange={e => handleRoleChange(role, 'maxConstruction', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <button
                    className="btn-primary"
                    onClick={() => applyToRole(role)}
                    disabled={saving === role}
                  >
                    {saving === role ? '...' : 'Appliquer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divers-card">
        <h3>Par joueur</h3>
        <p className="divers-description">
          Ajuster individuellement les limites d'un joueur.
          Les modifications sont sauvegardees automatiquement.
        </p>

        <table className="settings-table settings-users-table">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Role</th>
              <th>Energie</th>
              <th>Conquete</th>
              <th>Construction</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td className="settings-user-name">{user.name}</td>
                <td className="settings-role-badge">{user.role}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={user.maxEnergy}
                    onChange={e => handleUserChange(user.id, 'maxEnergy', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={user.maxConquest}
                    onChange={e => handleUserChange(user.id, 'maxConquest', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={user.maxConstruction}
                    onChange={e => handleUserChange(user.id, 'maxConstruction', e.target.value)}
                    className="settings-input"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
