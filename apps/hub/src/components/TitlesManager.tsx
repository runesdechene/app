import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface TitleCondition {
  stat: string
  min?: number
  rank?: number
  rank_from?: number
  rank_to?: number
}

interface Title {
  id: number
  name: string
  type: 'general' | 'faction'
  faction_id: string | null
  condition: TitleCondition
  order: number
  icon: string | null
  unlocks: string[]
}

interface Faction {
  id: string
  title: string
  color: string
}

const STAT_OPTIONS = [
  { value: 'discoveries', label: 'Decouvertes' },
  { value: 'claims', label: 'Claims' },
  { value: 'notoriety', label: 'Notoriete' },
  { value: 'likes', label: 'Likes' },
  { value: 'fortifications', label: 'Fortifications' },
]

const MODE_OPTIONS = [
  { value: 'threshold', label: 'Seuil' },
  { value: 'top', label: 'Top N' },
  { value: 'range', label: 'Classement' },
]

const UNLOCK_OPTIONS = [
  { value: 'add_place', label: 'Ajouter un lieu' },
]

function conditionToMode(c: TitleCondition): string {
  if (c.rank_from != null && c.rank_to != null) return 'range'
  if (c.rank != null) return 'top'
  return 'threshold'
}

function conditionLabel(c: TitleCondition): string {
  const stat = STAT_OPTIONS.find(s => s.value === c.stat)?.label ?? c.stat
  const mode = conditionToMode(c)
  if (mode === 'top') return `Top ${c.rank} ${stat}`
  if (mode === 'range') return `#${c.rank_from}-${c.rank_to} ${stat}`
  return `≥ ${c.min ?? 0} ${stat}`
}

export function TitlesManager() {
  const [titles, setTitles] = useState<Title[]>([])
  const [savedTitles, setSavedTitles] = useState<Title[]>([])
  const [factions, setFactions] = useState<Faction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'general' | 'faction'>('general')
  const [newFactionId, setNewFactionId] = useState('')
  const [creating, setCreating] = useState(false)

  const hasChanges = JSON.stringify(titles) !== JSON.stringify(savedTitles)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [titlesRes, factionsRes] = await Promise.all([
        supabase.from('titles').select('*').order('type').order('order'),
        supabase.from('factions').select('id, title, color').order('order'),
      ])

      if (titlesRes.data) {
        setTitles(titlesRes.data as Title[])
        setSavedTitles(titlesRes.data as Title[])
      }
      if (factionsRes.data) setFactions(factionsRes.data as Faction[])
    } finally {
      setLoading(false)
    }
  }

  // --- Modifier localement ---

  function handleFieldChange(titleId: number, field: string, value: string | number | string[]) {
    setTitles(prev => prev.map(t => t.id === titleId ? { ...t, [field]: value } : t))
  }

  function handleConditionChange(titleId: number, condition: TitleCondition) {
    setTitles(prev => prev.map(t => t.id === titleId ? { ...t, condition } : t))
  }

  function toggleUnlock(titleId: number, unlock: string) {
    const title = titles.find(t => t.id === titleId)
    if (!title) return

    const current = title.unlocks ?? []
    const next = current.includes(unlock)
      ? current.filter(u => u !== unlock)
      : [...current, unlock]

    handleFieldChange(titleId, 'unlocks', next)
  }

  // --- Sauvegarder tout ---

  async function handleSave() {
    setSaving(true)

    const promises = titles.map(t => {
      const saved = savedTitles.find(s => s.id === t.id)
      if (JSON.stringify(t) === JSON.stringify(saved)) return null
      return supabase.from('titles').update({
        name: t.name,
        icon: t.icon,
        order: t.order,
        condition: t.condition,
        unlocks: t.unlocks,
      }).eq('id', t.id)
    }).filter(Boolean)

    await Promise.all(promises)
    setSavedTitles([...titles])
    setSaving(false)
  }

  // --- Creer ---

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    if (newType === 'faction' && !newFactionId) return

    setCreating(true)

    const maxOrder = titles
      .filter(t => t.type === newType)
      .reduce((max, t) => Math.max(max, t.order), -1)

    const { data, error } = await supabase.from('titles').insert({
      name,
      type: newType,
      faction_id: newType === 'faction' ? newFactionId : null,
      condition: { stat: 'discoveries', min: 0 },
      order: maxOrder + 1,
      icon: null,
      unlocks: [],
    }).select().single()

    if (!error && data) {
      const t = data as Title
      setTitles(prev => [...prev, t])
      setSavedTitles(prev => [...prev, t])
      setNewName('')
    }
    setCreating(false)
  }

  // --- Supprimer ---

  async function handleDelete(titleId: number) {
    if (!window.confirm('Supprimer ce titre ?')) return

    const { error } = await supabase.from('titles').delete().eq('id', titleId)
    if (!error) {
      setTitles(prev => prev.filter(t => t.id !== titleId))
      setSavedTitles(prev => prev.filter(t => t.id !== titleId))
    }
  }

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  const generalTitles = titles.filter(t => t.type === 'general').sort((a, b) => a.order - b.order)
  const factionTitles = titles.filter(t => t.type === 'faction').sort((a, b) => a.order - b.order)

  const factionGroups: Record<string, Title[]> = {}
  for (const t of factionTitles) {
    if (t.faction_id) {
      if (!factionGroups[t.faction_id]) factionGroups[t.faction_id] = []
      factionGroups[t.faction_id].push(t)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Titres</h1>
        <div className="page-header-actions">
          <span className="tags-count">{titles.length} titres</span>
          {hasChanges && (
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}
        </div>
      </div>

      {/* Formulaire de creation */}
      <div className="title-create">
        <select
          value={newType}
          onChange={e => setNewType(e.target.value as 'general' | 'faction')}
          className="title-create-select"
        >
          <option value="general">General</option>
          <option value="faction">Faction</option>
        </select>
        {newType === 'faction' && (
          <select
            value={newFactionId}
            onChange={e => setNewFactionId(e.target.value)}
            className="title-create-select"
          >
            <option value="">-- Faction --</option>
            {factions.map(f => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Nom du titre..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="title-create-input"
          disabled={creating}
        />
        <button
          className="faction-create-btn"
          onClick={handleCreate}
          disabled={creating || !newName.trim() || (newType === 'faction' && !newFactionId)}
        >
          {creating ? '...' : '+ Creer'}
        </button>
      </div>

      {/* ====== Titres Generaux ====== */}
      <div className="title-section">
        <h2 className="title-section-heading">Titres Generaux</h2>
        {generalTitles.length === 0 && (
          <p className="title-empty">Aucun titre general</p>
        )}
        <div className="title-list">
          {generalTitles.map(t => (
            <TitleRow
              key={t.id}
              title={t}
              onFieldChange={handleFieldChange}
              onConditionChange={handleConditionChange}
              onToggleUnlock={toggleUnlock}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* ====== Titres de Faction ====== */}
      <div className="title-section">
        <h2 className="title-section-heading">Titres de Faction</h2>
        {factions.map(faction => {
          const group = factionGroups[faction.id] ?? []
          return (
            <div key={faction.id} className="title-faction-group">
              <div className="title-faction-header">
                <span
                  className="title-faction-dot"
                  style={{ background: faction.color }}
                />
                <span className="title-faction-name">{faction.title}</span>
                <span className="title-faction-count">{group.length} titres</span>
              </div>
              {group.length === 0 && (
                <p className="title-empty">Aucun titre pour cette faction</p>
              )}
              <div className="title-list">
                {group.map(t => (
                  <TitleRow
                    key={t.id}
                    title={t}
                    onFieldChange={handleFieldChange}
                    onConditionChange={handleConditionChange}
                    onToggleUnlock={toggleUnlock}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ====== Composant Titre Row ======

function TitleRow({
  title: t,
  onFieldChange,
  onConditionChange,
  onToggleUnlock,
  onDelete,
}: {
  title: Title
  onFieldChange: (id: number, field: string, value: string | number | string[]) => void
  onConditionChange: (id: number, condition: TitleCondition) => void
  onToggleUnlock: (id: number, unlock: string) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="title-row">
      <div className="title-row-main">
        {/* Icon */}
        <input
          type="text"
          value={t.icon ?? ''}
          onChange={e => onFieldChange(t.id, 'icon', e.target.value)}
          className="title-icon-input"
          placeholder="emoji"
          title="Icone (emoji)"
        />

        {/* Nom */}
        <input
          type="text"
          value={t.name}
          onChange={e => onFieldChange(t.id, 'name', e.target.value)}
          className="title-name-input"
          placeholder="Nom du titre"
        />

        {/* Ordre */}
        <label className="title-order">
          <span>#</span>
          <input
            type="number"
            min={0}
            value={t.order}
            onChange={e => onFieldChange(t.id, 'order', parseInt(e.target.value) || 0)}
            className="title-order-input"
          />
        </label>
      </div>

      {/* Condition Builder */}
      <ConditionBuilder
        condition={t.condition}
        onChange={c => onConditionChange(t.id, c)}
      />

      {/* Unlocks */}
      <div className="title-row-unlocks">
        {UNLOCK_OPTIONS.map(opt => (
          <label key={opt.value} className="title-unlock-checkbox">
            <input
              type="checkbox"
              checked={(t.unlocks ?? []).includes(opt.value)}
              onChange={() => onToggleUnlock(t.id, opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
        <button
          className="title-delete-btn"
          onClick={() => onDelete(t.id)}
          title="Supprimer"
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}

// ====== Condition Builder ======

function ConditionBuilder({
  condition,
  onChange,
}: {
  condition: TitleCondition
  onChange: (c: TitleCondition) => void
}) {
  const mode = conditionToMode(condition)

  function handleModeChange(newMode: string) {
    const stat = condition.stat
    if (newMode === 'threshold') {
      onChange({ stat, min: 0 })
    } else if (newMode === 'top') {
      onChange({ stat, rank: 1 })
    } else {
      onChange({ stat, rank_from: 2, rank_to: 5 })
    }
  }

  function handleStatChange(stat: string) {
    onChange({ ...condition, stat })
  }

  return (
    <div className="title-condition-builder">
      {/* Mode */}
      <select
        value={mode}
        onChange={e => handleModeChange(e.target.value)}
        className="title-condition-select"
      >
        {MODE_OPTIONS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {/* Stat */}
      <select
        value={condition.stat}
        onChange={e => handleStatChange(e.target.value)}
        className="title-condition-select"
      >
        {STAT_OPTIONS.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Valeurs dynamiques */}
      {mode === 'threshold' && (
        <label className="title-threshold">
          <span>≥</span>
          <input
            type="number"
            min={0}
            value={condition.min ?? 0}
            onChange={e => onChange({ ...condition, min: parseInt(e.target.value) || 0 })}
            className="title-threshold-input"
          />
        </label>
      )}

      {mode === 'top' && (
        <label className="title-threshold">
          <span>Top</span>
          <input
            type="number"
            min={1}
            value={condition.rank ?? 1}
            onChange={e => onChange({ ...condition, rank: parseInt(e.target.value) || 1 })}
            className="title-threshold-input"
          />
        </label>
      )}

      {mode === 'range' && (
        <div className="title-condition-range">
          <label className="title-threshold">
            <span>Du #</span>
            <input
              type="number"
              min={1}
              value={condition.rank_from ?? 2}
              onChange={e => onChange({ ...condition, rank_from: parseInt(e.target.value) || 1 })}
              className="title-threshold-input"
            />
          </label>
          <label className="title-threshold">
            <span>au #</span>
            <input
              type="number"
              min={1}
              value={condition.rank_to ?? 5}
              onChange={e => onChange({ ...condition, rank_to: parseInt(e.target.value) || 1 })}
              className="title-threshold-input"
            />
          </label>
        </div>
      )}

      {/* Resume */}
      <span className="title-condition-summary">{conditionLabel(condition)}</span>
    </div>
  )
}
