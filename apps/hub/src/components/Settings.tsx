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

  // V0.5 Settings
  const [v05Influence, setV05Influence] = useState({
    influence_max_remote_per_day: 5,
    influence_decay_per_week: 1,
    influence_visit_gps: 3,
    influence_add_place: 5,
    influence_add_photo: 2,
    influence_add_carnet: 3,
    influence_per_vote: 1,
  })
  const [v05Exploration, setV05Exploration] = useState({
    exploration_visit_gps: 3,
    exploration_gps_bonus: 10,
    exploration_add_photo: 5,
    exploration_add_carnet: 5,
  })
  const [v05Erudition, setV05Erudition] = useState({
    erudition_add_carnet: 3,
  })
  const [v05Faction, setV05Faction] = useState({
    faction_change_cooldown_days: 30,
  })
  const [v05Enigma, setV05Enigma] = useState({
    fragment_enigma_influence: 5,
    fragment_enigma_erudition: 2,
    enigma_influence_easy: 2,
    enigma_influence_medium: 4,
    enigma_influence_hard: 6,
    enigma_erudition_easy: 3,
    enigma_erudition_medium: 6,
    enigma_erudition_hard: 10,
    enigma_place_influence_base: 1,
    enigma_place_influence_per_diff: 1,
    enigma_place_erudition_base: 2,
    enigma_place_erudition_per_diff: 2,
  })
  const [savingV05, setSavingV05] = useState(false)

  // Share template
  const [shareTemplate, setShareTemplate] = useState<string>('')
  const [savingShareTemplate, setSavingShareTemplate] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Charger les valeurs moyennes par role (pour pre-remplir les inputs)
      const { data: usersData } = await supabase
        .from('users_admin')
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

      // V0.5 settings
      const v05Keys = [
        ...Object.keys(v05Influence),
        ...Object.keys(v05Exploration),
        ...Object.keys(v05Erudition),
        ...Object.keys(v05Faction),
        ...Object.keys(v05Enigma),
      ]
      const { data: v05Data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', v05Keys)

      if (v05Data) {
        const infl = { ...v05Influence }
        const expl = { ...v05Exploration }
        const erud = { ...v05Erudition }
        const fact = { ...v05Faction }
        const enig = { ...v05Enigma }
        for (const row of v05Data as { key: string; value: string }[]) {
          const val = Number(row.value)
          if (isNaN(val)) continue
          if (row.key in infl) (infl as Record<string, number>)[row.key] = val
          else if (row.key in expl) (expl as Record<string, number>)[row.key] = val
          else if (row.key in erud) (erud as Record<string, number>)[row.key] = val
          else if (row.key in fact) (fact as Record<string, number>)[row.key] = val
          else if (row.key in enig) (enig as Record<string, number>)[row.key] = val
        }
        setV05Influence(infl)
        setV05Exploration(expl)
        setV05Erudition(erud)
        setV05Faction(fact)
        setV05Enigma(enig)
      }
      // Charger le template de partage social
      const { data: shareData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'share_text_template')
        .single()
      if (shareData) setShareTemplate(shareData.value)
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

  async function saveV05Settings() {
    setSavingV05(true)
    const allSettings: Record<string, number> = {
      ...v05Influence,
      ...v05Exploration,
      ...v05Erudition,
      ...v05Faction,
      ...v05Enigma,
    }
    for (const [key, value] of Object.entries(allSettings)) {
      await supabase.from('app_settings').upsert(
        { key, value: String(value) },
        { onConflict: 'key' }
      )
    }
    setSavingV05(false)
  }

  async function saveShareTemplate() {
    setSavingShareTemplate(true)
    const { error } = await supabase
      .from('app_settings')
      .update({ value: shareTemplate, updated_at: new Date().toISOString() })
      .eq('key', 'share_text_template')
    setSavingShareTemplate(false)
    if (error) alert('Erreur : ' + error.message)
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

      {/* ====== V0.5 — Influence & Enigmes ====== */}
      <h2 style={{ marginTop: '2rem', marginBottom: '0.5rem', borderTop: '2px solid rgba(193,154,107,0.3)', paddingTop: '1.5rem' }}>
        V0.5 — Influence &amp; Enigmes
      </h2>

      <div className="divers-card">
        <h3>Influence</h3>
        <p className="divers-description">
          Parametres du systeme d'influence : gains, limites et decroissance.
        </p>

        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Max remote / jour</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_max_remote_per_day}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_max_remote_per_day: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Decay / semaine</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_decay_per_week}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_decay_per_week: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Visite GPS</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_visit_gps}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_visit_gps: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Ajout lieu</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_add_place}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_add_place: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Ajout photo</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_add_photo}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_add_photo: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Ajout carnet</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_add_carnet}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_add_carnet: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Par vote</span>
            <input type="number" min="0" step="1" value={v05Influence.influence_per_vote}
              onChange={e => setV05Influence(prev => ({ ...prev, influence_per_vote: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
        </div>
      </div>

      <div className="divers-card">
        <h3>Exploration</h3>
        <p className="divers-description">
          Points d'Exploration gagnes par action terrain. La decouverte donne autant de pts que le cout en energie (proportionnel a la distance). Le bonus GPS s'applique en plus quand on est sur place.
        </p>

        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Bonus GPS (sur place)</span>
            <input type="number" min="0" step="1" value={v05Exploration.exploration_gps_bonus}
              onChange={e => setV05Exploration(prev => ({ ...prev, exploration_gps_bonus: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Visite GPS</span>
            <input type="number" min="0" step="1" value={v05Exploration.exploration_visit_gps}
              onChange={e => setV05Exploration(prev => ({ ...prev, exploration_visit_gps: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Ajout photo</span>
            <input type="number" min="0" step="1" value={v05Exploration.exploration_add_photo}
              onChange={e => setV05Exploration(prev => ({ ...prev, exploration_add_photo: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Ajout carnet</span>
            <input type="number" min="0" step="1" value={v05Exploration.exploration_add_carnet}
              onChange={e => setV05Exploration(prev => ({ ...prev, exploration_add_carnet: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
        </div>
      </div>

      <div className="divers-card">
        <h3>Erudition</h3>
        <p className="divers-description">
          Points d'Erudition gagnes par action savoir.
        </p>

        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Ajout carnet</span>
            <input type="number" min="0" step="1" value={v05Erudition.erudition_add_carnet}
              onChange={e => setV05Erudition(prev => ({ ...prev, erudition_add_carnet: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
        </div>
      </div>

      <div className="divers-card">
        <h3>Heritage (Faction)</h3>
        <p className="divers-description">
          Regles de changement d'Heritage.
        </p>

        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Cooldown changement (jours)</span>
            <input type="number" min="1" step="1" value={v05Faction.faction_change_cooldown_days}
              onChange={e => setV05Faction(prev => ({ ...prev, faction_change_cooldown_days: parseInt(e.target.value) || 30 }))}
              className="settings-input" />
          </label>
        </div>
      </div>

      <div className="divers-card">
        <h3>Enigmes — Recompenses</h3>
        <p className="divers-description">
          Influence et Erudition gagnes selon la difficulte de l'enigme.
        </p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Difficulte</th>
              <th>Influence</th>
              <th>Erudition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Facile</td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_influence_easy}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_influence_easy: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_erudition_easy}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_erudition_easy: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
            </tr>
            <tr>
              <td>Moyen</td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_influence_medium}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_influence_medium: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_erudition_medium}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_erudition_medium: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
            </tr>
            <tr>
              <td>Difficile</td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_influence_hard}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_influence_hard: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
              <td>
                <input type="number" min="0" step="1" value={v05Enigma.enigma_erudition_hard}
                  onChange={e => setV05Enigma(prev => ({ ...prev, enigma_erudition_hard: parseInt(e.target.value) || 0 }))}
                  className="settings-input" />
              </td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 14 }}>Enigmes de fragments</h4>
        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Influence</span>
            <input type="number" min="0" step="1" value={v05Enigma.fragment_enigma_influence}
              onChange={e => setV05Enigma(prev => ({ ...prev, fragment_enigma_influence: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Erudition</span>
            <input type="number" min="0" step="1" value={v05Enigma.fragment_enigma_erudition}
              onChange={e => setV05Enigma(prev => ({ ...prev, fragment_enigma_erudition: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 14 }}>Enigmes de lieu</h4>
        <div className="settings-global-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="settings-global-field">
            <span>Influence base</span>
            <input type="number" min="0" step="1" value={v05Enigma.enigma_place_influence_base}
              onChange={e => setV05Enigma(prev => ({ ...prev, enigma_place_influence_base: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Influence / diff</span>
            <input type="number" min="0" step="1" value={v05Enigma.enigma_place_influence_per_diff}
              onChange={e => setV05Enigma(prev => ({ ...prev, enigma_place_influence_per_diff: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Erudition base</span>
            <input type="number" min="0" step="1" value={v05Enigma.enigma_place_erudition_base}
              onChange={e => setV05Enigma(prev => ({ ...prev, enigma_place_erudition_base: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
          <label className="settings-global-field">
            <span>Erudition / diff</span>
            <input type="number" min="0" step="1" value={v05Enigma.enigma_place_erudition_per_diff}
              onChange={e => setV05Enigma(prev => ({ ...prev, enigma_place_erudition_per_diff: parseInt(e.target.value) || 0 }))}
              className="settings-input" />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <button className="btn-primary" onClick={saveV05Settings} disabled={savingV05}>
          {savingV05 ? '...' : 'Sauvegarder V0.5'}
        </button>
      </div>

      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 24 }}>
        <h3>Partage social</h3>
        <p className="divers-description">
          Texte pré-rempli quand un utilisateur partage un lieu depuis l'app ou la SEO Page.
          Utilise <code>{'{name}'}</code> pour insérer le nom du lieu. Le changement est instantané sur l'app ;
          la SEO Page se met à jour au prochain rebuild nightly (~24h max).
        </p>

        <label className="settings-global-field" style={{ width: '100%', maxWidth: 600 }}>
          <span>Template de partage</span>
          <textarea
            value={shareTemplate}
            onChange={e => setShareTemplate(e.target.value)}
            rows={3}
            className="settings-input"
            style={{ width: '100%', fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ marginTop: 8, padding: 12, background: '#f7ede1', borderRadius: 6 }}>
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Aperçu :</strong>
          <em style={{ fontSize: 14 }}>
            {shareTemplate.replace('{name}', 'Abbaye de Fontenay') || '(template vide)'}
          </em>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={saveShareTemplate} disabled={savingShareTemplate}>
            {savingShareTemplate ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

    </div>
  )
}
