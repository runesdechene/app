import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface RoleGauges {
  maxEnergy: number
}

interface UserGauge {
  id: string
  name: string
  role: string
  maxEnergy: number
}

interface TerritoryTier {
  id: number
  minPlaces: number
  title: string
}

const ROLES = ['user', 'admin'] as const

export function Settings() {
  const [globalDefaults, setGlobalDefaults] = useState<RoleGauges>({
    maxEnergy: 5,
  })
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [roleDefaults, setRoleDefaults] = useState<Record<string, RoleGauges>>({
    user: { maxEnergy: 5 },
    admin: { maxEnergy: 10 },
  })
  const [users, setUsers] = useState<UserGauge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const debounceMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Territory tiers
  const [tiers, setTiers] = useState<TerritoryTier[]>([])
  const [savingTiers, setSavingTiers] = useState(false)

  // Regen cycles (in seconds)
  const [regenCycles, setRegenCycles] = useState({
    energy_base_cycle: 7200,
  })
  const [savingRegen, setSavingRegen] = useState(false)

  // Glory rates
  const [gloryRates, setGloryRates] = useState({
    glory_discover: 2,
    glory_claim: 5,
    glory_fortify: 5,
    glory_cost_bonus_pct: 10,
  })
  const [savingGlory, setSavingGlory] = useState(false)

  const [distSettings, setDistSettings] = useState({
    distance_gps_km: 0.5,
    distance_close_km: 10,
    distance_mid_km: 50,
    distance_mult_gps: 0.5,
    distance_mult_close: 1,
    distance_mult_mid: 2,
    distance_mult_far: 3,
  })
  const [savingDist, setSavingDist] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Charger les valeurs moyennes par role (pour pre-remplir les inputs)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, email_address, role, max_energy')
        .order('role')
        .order('first_name')

      if (usersData) {
        const mapped: UserGauge[] = usersData.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          name: (u.first_name as string) || (u.email_address as string) || 'Anonyme',
          role: (u.role as string) || 'user',
          maxEnergy: Number(u.max_energy) || 5,
        }))
        setUsers(mapped)

        // Calculer les valeurs par role (prendre le premier trouvé)
        const byRole: Record<string, RoleGauges> = {}
        for (const role of ROLES) {
          const first = mapped.find(u => u.role === role)
          if (first) {
            byRole[role] = {
              maxEnergy: first.maxEnergy,
            }
          }
        }
        setRoleDefaults(prev => ({ ...prev, ...byRole }))
      }
      // Charger les tiers de territoire
      const { data: tiersData } = await supabase
        .from('territory_tiers')
        .select('id, min_places, title')
        .order('min_places')

      if (tiersData) {
        setTiers(tiersData.map((t: Record<string, unknown>) => ({
          id: Number(t.id),
          minPlaces: Number(t.min_places),
          title: String(t.title),
        })))
      }

      // Charger default_max_energy depuis app_settings
      const { data: defaultEnergyData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_max_energy')
        .single()

      if (defaultEnergyData?.value) {
        setGlobalDefaults(prev => ({ ...prev, maxEnergy: Number(defaultEnergyData.value) || prev.maxEnergy }))
      }

      // Charger les cycles de regen
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['energy_base_cycle'])

      if (settingsData) {
        const cycles = { ...regenCycles }
        for (const row of settingsData as { key: string; value: string }[]) {
          if (row.key in cycles) {
            (cycles as Record<string, number>)[row.key] = Number(row.value) || (cycles as Record<string, number>)[row.key]
          }
        }
        setRegenCycles(cycles)
      }

      // Charger les taux de Gloire
      const { data: gloryData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['glory_discover', 'glory_claim', 'glory_fortify', 'glory_cost_bonus_pct'])

      if (gloryData) {
        const g = { ...gloryRates }
        for (const row of gloryData as { key: string; value: string }[]) {
          if (row.key in g) {
            (g as Record<string, number>)[row.key] = Number(row.value) || (g as Record<string, number>)[row.key]
          }
        }
        setGloryRates(g)
      }

      // Charger les settings de distance
      const { data: distData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['distance_gps_km', 'distance_close_km', 'distance_mid_km', 'distance_mult_gps', 'distance_mult_close', 'distance_mult_mid', 'distance_mult_far'])

      if (distData) {
        const dist = { ...distSettings }
        for (const row of distData as { key: string; value: string }[]) {
          if (row.key in dist) {
            (dist as Record<string, number>)[row.key] = Number(row.value) || (dist as Record<string, number>)[row.key]
          }
        }
        setDistSettings(dist)
      }
    } finally {
      setLoading(false)
    }
  }

  async function applyToRole(role: string) {
    const gauges = roleDefaults[role]
    if (!gauges) return

    setSaving(role)
    await supabase
      .from('users')
      .update({
        max_energy: gauges.maxEnergy,
      })
      .eq('role', role)

    // Mettre a jour la liste locale
    setUsers(prev =>
      prev.map(u =>
        u.role === role
          ? { ...u, maxEnergy: gauges.maxEnergy }
          : u
      )
    )
    setSaving(null)
  }

  function handleGlobalChange(field: keyof RoleGauges, value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setGlobalDefaults(prev => ({ ...prev, [field]: num }))
  }

  async function applyGlobalToAll() {
    setSavingGlobal(true)
    await supabase
      .from('users')
      .update({
        max_energy: globalDefaults.maxEnergy,
      })
      .gte('id', '')  // match all rows

    // Persister dans app_settings pour que handle_new_user lise la bonne valeur
    await supabase.from('app_settings').upsert(
      { key: 'default_max_energy', value: String(globalDefaults.maxEnergy) },
      { onConflict: 'key' }
    )

    setUsers(prev =>
      prev.map(u => ({
        ...u,
        maxEnergy: globalDefaults.maxEnergy,
      }))
    )
    // Sync role defaults display
    setRoleDefaults(prev => {
      const updated = { ...prev }
      for (const role of ROLES) {
        updated[role] = { ...globalDefaults }
      }
      return updated
    })
    setSavingGlobal(false)
  }

  function handleRoleChange(role: string, field: keyof RoleGauges, value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setRoleDefaults(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: num },
    }))
  }

  async function handleUserChange(userId: string, field: 'maxEnergy', value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: num } : u))

    const key = `${userId}:${field}`
    const existing = debounceMapRef.current.get(key)
    if (existing) clearTimeout(existing)
    debounceMapRef.current.set(key, setTimeout(async () => {
      debounceMapRef.current.delete(key)
      await supabase
        .from('users')
        .update({ max_energy: num })
        .eq('id', userId)
    }, 600))
  }

  function handleTierChange(idx: number, field: 'minPlaces' | 'title', value: string) {
    setTiers(prev => prev.map((t, i) => {
      if (i !== idx) return t
      if (field === 'minPlaces') return { ...t, minPlaces: parseInt(value) || 0 }
      return { ...t, title: value }
    }))
  }

  function addTier() {
    const maxMin = tiers.length > 0 ? Math.max(...tiers.map(t => t.minPlaces)) : 0
    setTiers(prev => [...prev, { id: 0, minPlaces: maxMin + 5, title: '' }])
  }

  function removeTier(idx: number) {
    setTiers(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveTiers() {
    setSavingTiers(true)
    // Supprimer tous les tiers existants et re-insérer
    await supabase.from('territory_tiers').delete().gte('id', 0)
    const rows = tiers
      .filter(t => t.title.trim() && t.minPlaces > 0)
      .map(t => ({ min_places: t.minPlaces, title: t.title.trim() }))
    if (rows.length > 0) {
      await supabase.from('territory_tiers').insert(rows)
    }
    setSavingTiers(false)
  }

  async function saveRegenCycles() {
    setSavingRegen(true)
    const keys = ['energy_base_cycle'] as const
    for (const key of keys) {
      await supabase.from('app_settings').upsert(
        { key, value: String(regenCycles[key]) },
        { onConflict: 'key' }
      )
    }
    setSavingRegen(false)
  }

  async function saveGloryRates() {
    setSavingGlory(true)
    const keys = Object.keys(gloryRates) as (keyof typeof gloryRates)[]
    for (const key of keys) {
      await supabase.from('app_settings').upsert(
        { key, value: String(gloryRates[key]) },
        { onConflict: 'key' }
      )
    }
    setSavingGlory(false)
  }

  async function saveDistSettings() {
    setSavingDist(true)
    const keys = Object.keys(distSettings) as (keyof typeof distSettings)[]
    for (const key of keys) {
      await supabase.from('app_settings').upsert(
        { key, value: String(distSettings[key]) },
        { onConflict: 'key' }
      )
    }
    setSavingDist(false)
  }

  if (loading) {
    return <div className="section"><p>Chargement...</p></div>
  }

  return (
    <div className="section">
      <h1>Reglages</h1>

      <div className="divers-card">
        <h3>Cycles de regeneration</h3>
        <p className="divers-description">
          Duree de base (en heures) pour regenerer 1 point de chaque jauge.
        </p>

        <div className="settings-global-row">
          <label className="settings-global-field">
            <span>⚡ Energie</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={regenCycles.energy_base_cycle / 3600}
              onChange={e => {
                const h = parseFloat(e.target.value)
                if (!isNaN(h) && h > 0) setRegenCycles(prev => ({ ...prev, energy_base_cycle: Math.round(h * 3600) }))
              }}
              className="settings-input"
            />
            <span style={{ fontSize: '0.8em', opacity: 0.6 }}>heures</span>
          </label>
          <button
            className="btn-primary"
            onClick={saveRegenCycles}
            disabled={savingRegen}
          >
            {savingRegen ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="divers-card">
        <h3>Taux de Gloire</h3>
        <p className="divers-description">
          Points de Gloire gagnes par action. Les Fragments avec "Gloire multipliee" appliquent un multiplicateur sur ces valeurs.
        </p>

        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Decouverte</span>
            <input
              type="number" min="0" step="1"
              value={gloryRates.glory_discover}
              onChange={e => setGloryRates(prev => ({ ...prev, glory_discover: parseInt(e.target.value) || 0 }))}
              className="settings-input"
            />
          </label>
          <label className="settings-global-field">
            <span>Protection</span>
            <input
              type="number" min="0" step="1"
              value={gloryRates.glory_claim}
              onChange={e => setGloryRates(prev => ({ ...prev, glory_claim: parseInt(e.target.value) || 0 }))}
              className="settings-input"
            />
          </label>
          <label className="settings-global-field">
            <span>Fortification</span>
            <input
              type="number" min="0" step="1"
              value={gloryRates.glory_fortify}
              onChange={e => setGloryRates(prev => ({ ...prev, glory_fortify: parseInt(e.target.value) || 0 }))}
              className="settings-input"
            />
          </label>
          <label className="settings-global-field">
            <span>Bonus cout (%)</span>
            <input
              type="number" min="0" step="5"
              value={gloryRates.glory_cost_bonus_pct}
              onChange={e => setGloryRates(prev => ({ ...prev, glory_cost_bonus_pct: parseInt(e.target.value) || 0 }))}
              className="settings-input"
            />
          </label>
          <button className="btn-primary" onClick={saveGloryRates} disabled={savingGlory}>
            {savingGlory ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="divers-card">
        <h3>Cout par distance</h3>
        <p className="divers-description">
          Seuils de distance (km) et multiplicateurs de cout en energie.
        </p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Distance max (km)</th>
              <th>Multiplicateur</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GPS (sur place)</td>
              <td>
                <input type="number" min="0.1" step="0.1" value={distSettings.distance_gps_km}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_gps_km: parseFloat(e.target.value) || 0.5 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="0.1" value={distSettings.distance_mult_gps}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_mult_gps: parseFloat(e.target.value) || 0.5 }))}
                  className="settings-input" />
              </td>
            </tr>
            <tr>
              <td>Proche</td>
              <td>
                <input type="number" min="1" step="1" value={distSettings.distance_close_km}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_close_km: parseFloat(e.target.value) || 10 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="0.1" value={distSettings.distance_mult_close}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_mult_close: parseFloat(e.target.value) || 1 }))}
                  className="settings-input" />
              </td>
            </tr>
            <tr>
              <td>Moyen</td>
              <td>
                <input type="number" min="1" step="5" value={distSettings.distance_mid_km}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_mid_km: parseFloat(e.target.value) || 50 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="0.1" value={distSettings.distance_mult_mid}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_mult_mid: parseFloat(e.target.value) || 2 }))}
                  className="settings-input" />
              </td>
            </tr>
            <tr>
              <td>Loin (au-dela)</td>
              <td>—</td>
              <td>
                <input type="number" min="0" step="0.1" value={distSettings.distance_mult_far}
                  onChange={e => setDistSettings(prev => ({ ...prev, distance_mult_far: parseFloat(e.target.value) || 3 }))}
                  className="settings-input" />
              </td>
            </tr>
          </tbody>
        </table>

        <button className="btn-primary" onClick={saveDistSettings} disabled={savingDist} style={{ marginTop: 10 }}>
          {savingDist ? '...' : 'Sauvegarder'}
        </button>
      </div>

      <div className="divers-card">
        <h3>Titres de territoires</h3>
        <p className="divers-description">
          Definir les titres progressifs des territoires selon le nombre de lieux fusionnes.
          Ex: 3 lieux = "Campement", 30 lieux = "Duche".
        </p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Lieux minimum</th>
              <th>Titre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tier.minPlaces}
                    onChange={e => handleTierChange(idx, 'minPlaces', e.target.value)}
                    className="settings-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={tier.title}
                    onChange={e => handleTierChange(idx, 'title', e.target.value)}
                    className="settings-input"
                    placeholder="Ex: Campement"
                  />
                </td>
                <td>
                  <button
                    className="btn-danger"
                    onClick={() => removeTier(idx)}
                    title="Supprimer"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button className="btn-secondary" onClick={addTier}>
            + Ajouter un tier
          </button>
          <button
            className="btn-primary"
            onClick={saveTiers}
            disabled={savingTiers}
          >
            {savingTiers ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="divers-card">
        <h3>Energie par role</h3>
        <p className="divers-description">
          Definir la limite max d'energie par role.
          Cliquer "Appliquer" met a jour tous les utilisateurs de ce role.
        </p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>⚡ Energie max</th>
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
        <h3>Energie par defaut (tous les joueurs)</h3>
        <p className="divers-description">
          Definir la limite d'energie pour TOUS les joueurs d'un coup.
        </p>

        <div className="settings-global-row">
          <label className="settings-global-field">
            <span>⚡ Energie max</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={globalDefaults.maxEnergy}
              onChange={e => handleGlobalChange('maxEnergy', e.target.value)}
              className="settings-input"
            />
          </label>
          <button
            className="btn-primary"
            onClick={applyGlobalToAll}
            disabled={savingGlobal}
          >
            {savingGlobal ? '...' : 'Appliquer a tous'}
          </button>
        </div>
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
              <th>⚡ Energie max</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
