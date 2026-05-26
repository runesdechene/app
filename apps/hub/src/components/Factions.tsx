import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface Faction {
  id: string
  title: string
  color: string
  pattern: string | null
  description: string | null
  image_url: string | null
  adjective: string
  order: number
  bonus_energy: number
  bonus_conquest: number
  bonus_construction: number
  bonus_vitalite: number
  bonus_regen_energy: number
  bonus_regen_conquest: number
  bonus_regen_construction: number
  bonus_regen_vitalite: number
}

export function Factions() {
  const [factions, setFactions] = useState<Faction[]>([])
  const [savedFactions, setSavedFactions] = useState<Faction[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const uploadFactionIdRef = useRef<string | null>(null)
  const imageUploadFactionIdRef = useRef<string | null>(null)

  // Tag bonuses per faction
  const [allTags, setAllTags] = useState<Array<{ id: string; title: string }>>([])
  const [tagBonuses, setTagBonuses] = useState<Record<string, Record<string, number>>>({}) // faction_id -> tag_id -> reduction
  const [savedTagBonuses, setSavedTagBonuses] = useState<Record<string, Record<string, number>>>({})

  // Underdog settings
  const [underdogEnabled, setUnderdogEnabled] = useState(false)
  const [underdogMultiplier, setUnderdogMultiplier] = useState(2)
  const [underdogFactionId, setUnderdogFactionId] = useState<string | null>(null)
  const [savingUnderdog, setSavingUnderdog] = useState(false)

  const hasChanges = JSON.stringify(factions) !== JSON.stringify(savedFactions) || JSON.stringify(tagBonuses) !== JSON.stringify(savedTagBonuses)

  useEffect(() => {
    fetchFactions()
    fetchUnderdogSettings()
  }, [])

  async function fetchUnderdogSettings() {
    const [enabledRes, multRes, underdogRes] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'underdog_enabled').single(),
      supabase.from('app_settings').select('value').eq('key', 'underdog_multiplier').single(),
      supabase.rpc('get_underdog_faction_id'),
    ])
    if (enabledRes.data) setUnderdogEnabled(enabledRes.data.value === 'true')
    if (multRes.data) setUnderdogMultiplier(parseFloat(multRes.data.value) || 2)
    if (underdogRes.data) setUnderdogFactionId(underdogRes.data as string)
  }

  async function toggleUnderdog(enabled: boolean) {
    setUnderdogEnabled(enabled)
    setSavingUnderdog(true)
    await supabase.from('app_settings').update({ value: enabled ? 'true' : 'false' }).eq('key', 'underdog_enabled')
    if (enabled) {
      const { data } = await supabase.rpc('get_underdog_faction_id')
      setUnderdogFactionId(data as string)
    } else {
      setUnderdogFactionId(null)
    }
    setSavingUnderdog(false)
  }

  async function saveUnderdogMultiplier(value: number) {
    setUnderdogMultiplier(value)
    setSavingUnderdog(true)
    try {
      await supabase.from('app_settings').update({ value: String(value) }).eq('key', 'underdog_multiplier')
    } finally {
      setSavingUnderdog(false)
    }
  }

  async function fetchFactions() {
    try {
      const { data, error } = await supabase
        .from('factions')
        .select('id, title, adjective, color, pattern, description, image_url, order, bonus_energy, bonus_conquest, bonus_construction, bonus_vitalite, bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction, bonus_regen_vitalite')
        .order('order')

      if (!error && data) {
        setFactions(data as Faction[])
        setSavedFactions(data as Faction[])
      }

      // Fetch all tags
      const { data: tagsData } = await supabase.from('tags').select('id, title').order('order')
      if (tagsData) setAllTags(tagsData as Array<{ id: string; title: string }>)

      // Fetch tag bonuses
      const { data: bonusData } = await supabase.from('faction_tag_bonuses').select('faction_id, tag_id, cost_reduction')
      if (bonusData) {
        const map: Record<string, Record<string, number>> = {}
        for (const row of bonusData as Array<{ faction_id: string; tag_id: string; cost_reduction: number }>) {
          if (!map[row.faction_id]) map[row.faction_id] = {}
          map[row.faction_id][row.tag_id] = row.cost_reduction
        }
        setTagBonuses(map)
        setSavedTagBonuses(JSON.parse(JSON.stringify(map)))
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Modifier localement (pas de save) ---

  function updateField(factionId: string, field: string, value: string | number | null) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, [field]: value } : f))
  }

  // --- Sauvegarder tout ---

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const promises = factions.map(f => {
        const saved = savedFactions.find(s => s.id === f.id)
        if (JSON.stringify(f) === JSON.stringify(saved)) return null
        return supabase.from('factions').update({
          title: f.title,
          adjective: f.adjective,
          color: f.color,
          pattern: f.pattern,
          description: f.description,
          image_url: f.image_url,
          bonus_energy: f.bonus_energy,
          bonus_conquest: f.bonus_conquest,
          bonus_construction: f.bonus_construction,
          bonus_vitalite: f.bonus_vitalite,
          bonus_regen_energy: f.bonus_regen_energy,
          bonus_regen_conquest: f.bonus_regen_conquest,
          bonus_regen_construction: f.bonus_regen_construction,
          bonus_regen_vitalite: f.bonus_regen_vitalite,
          updated_at: new Date().toISOString(),
        }).eq('id', f.id).then(r => r)
      }).filter(Boolean)

      const results = await Promise.all(promises)
      const errors = results.filter(r => r?.error)

      if (errors.length > 0) {
        setSaveError(`Erreur sur ${errors.length} héritage(s)`)
      }

      await saveTagBonuses()
      await fetchFactions()
    } finally {
      setSaving(false)
    }
  }

  async function saveTagBonuses() {
    // Delete all existing and re-insert
    for (const factionId of Object.keys(tagBonuses)) {
      const entries = Object.entries(tagBonuses[factionId] || {}).filter(([, v]) => v > 0)
      // Delete existing for this faction
      await supabase.from('faction_tag_bonuses').delete().eq('faction_id', factionId)
      // Insert new
      if (entries.length > 0) {
        await supabase.from('faction_tag_bonuses').insert(
          entries.map(([tagId, reduction]) => ({
            faction_id: factionId,
            tag_id: tagId,
            cost_reduction: reduction,
          }))
        )
      }
    }
  }

  function handleCancel() {
    setFactions(JSON.parse(JSON.stringify(savedFactions)))
    setSaveError(null)
  }

  // --- Creer ---

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return

    const id = slugify(title)
    if (factions.some(f => f.id === id)) return

    setCreating(true)
    const newFaction: Faction = {
      id, title, adjective: '', color: '#C19A6B', pattern: null, description: null, image_url: null,
      order: factions.length,
      bonus_energy: 0, bonus_conquest: 0, bonus_construction: 0, bonus_vitalite: 0,
      bonus_regen_energy: 0, bonus_regen_conquest: 0, bonus_regen_construction: 0, bonus_regen_vitalite: 0,
    }

    const { error } = await supabase.from('factions').insert(newFaction)
    if (!error) {
      setFactions(prev => [...prev, newFaction])
      setSavedFactions(prev => [...prev, newFaction])
      setNewTitle('')
    }
    setCreating(false)
  }

  // --- Supprimer ---

  async function handleDelete(factionId: string) {
    if (!window.confirm('Supprimer cet héritage ?')) return
    const faction = factions.find(f => f.id === factionId)
    if (faction?.pattern) {
      await supabase.storage.from('faction-patterns').remove([`${factionId}.svg`])
    }
    const { error } = await supabase.from('factions').delete().eq('id', factionId)
    if (!error) {
      setFactions(prev => prev.filter(f => f.id !== factionId))
      setSavedFactions(prev => prev.filter(f => f.id !== factionId))
    }
  }

  // --- Renommer handle ---

  async function handleRename(oldId: string, newId: string) {
    const trimmed = newId.trim()
    if (!trimmed || trimmed === oldId) return
    const { data } = await supabase.rpc('rename_faction', { p_old_id: oldId, p_new_id: trimmed })
    if (data && typeof data === 'object' && 'error' in data) {
      alert((data as { error: string }).error)
      return
    }
    setFactions(prev => prev.map(f => f.id === oldId ? { ...f, id: trimmed } : f))
    setSavedFactions(prev => prev.map(f => f.id === oldId ? { ...f, id: trimmed } : f))
  }

  // --- Pattern SVG (save immediat car fichier) ---

  function triggerUpload(factionId: string) {
    uploadFactionIdRef.current = factionId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const factionId = uploadFactionIdRef.current
    if (!file || !factionId) return
    e.target.value = ''
    setUploading(factionId)

    const path = `${factionId}.svg`
    const { error: uploadError } = await supabase.storage
      .from('faction-patterns')
      .upload(path, file, { upsert: true, contentType: 'image/svg+xml' })

    if (uploadError) { setUploading(null); return }

    const { data: urlData } = supabase.storage.from('faction-patterns').getPublicUrl(path)
    const patternUrl = urlData.publicUrl

    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, pattern: patternUrl } : f))
    setUploading(null)
  }

  function removePattern(factionId: string) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, pattern: null } : f))
  }

  // --- Image faction (save immediat car fichier) ---

  function triggerImageUpload(factionId: string) {
    imageUploadFactionIdRef.current = factionId
    imageInputRef.current?.click()
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const factionId = imageUploadFactionIdRef.current
    if (!file || !factionId) return
    e.target.value = ''
    setUploading(factionId)

    const ext = file.name.split('.').pop() || 'webp'
    const path = `${factionId}-image.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('faction-patterns')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`)
      setUploading(null)
      return
    }

    const { data: urlData } = supabase.storage.from('faction-patterns').getPublicUrl(path)
    const imageUrl = urlData.publicUrl

    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, image_url: imageUrl } : f))
    setUploading(null)
  }

  function removeImage(factionId: string) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, image_url: null } : f))
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Héritages</h1>
        <span className="tags-count">{factions.length} héritages</span>
      </div>

      {/* Baroud d'Honneur — reglage underdog */}
      <div className="underdog-panel">
        <div className="underdog-header">
          <div className="underdog-title-row">
            <span className="underdog-icon">{'\uD83D\uDC80'}</span>
            <h3 className="underdog-title">Baroud d'Honneur</h3>
            {savingUnderdog && <span className="tag-saving-indicator">...</span>}
          </div>
          <label className="underdog-toggle">
            <input
              type="checkbox"
              checked={underdogEnabled}
              onChange={e => toggleUnderdog(e.target.checked)}
            />
            <span>{underdogEnabled ? 'Actif' : 'Inactif'}</span>
          </label>
        </div>
        <p className="underdog-desc">
          La faction en derniere position recoit un bonus de regen sur toutes ses ressources.
        </p>
        {underdogEnabled && (
          <div className="underdog-settings">
            <label className="underdog-mult-label">
              <span>Multiplicateur regen</span>
              <div className="underdog-mult-input">
                <input
                  type="number"
                  min={1.5}
                  max={5}
                  step={0.5}
                  value={underdogMultiplier}
                  onChange={e => saveUnderdogMultiplier(parseFloat(e.target.value) || 2)}
                />
                <span className="underdog-mult-suffix">x</span>
              </div>
            </label>
            {underdogFactionId && (
              <div className="underdog-current">
                Héritage actuel : <strong>{factions.find(f => f.id === underdogFactionId)?.title ?? underdogFactionId}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulaire de creation */}
      <div className="faction-create">
        <input
          type="text"
          placeholder="Nom du nouvel héritage..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="faction-create-input"
          disabled={creating}
        />
        <button
          className="faction-create-btn"
          onClick={handleCreate}
          disabled={creating || !newTitle.trim()}
        >
          {creating ? '...' : '+ Creer'}
        </button>
      </div>

      {/* Inputs fichiers caches */}
      <input ref={fileInputRef} type="file" accept="image/svg+xml" style={{ display: 'none' }} onChange={handleFileChange} />
      <input ref={imageInputRef} type="file" accept="image/webp,image/png,image/jpeg" style={{ display: 'none' }} onChange={handleImageChange} />

      <div className="tags-grid">
        {factions.map(faction => (
          <div key={faction.id} className="tag-card">
            {/* Preview territoire */}
            <div className="faction-preview" style={{ backgroundColor: faction.color }}>
              {faction.pattern && (
                <div className="faction-preview-pattern" style={{
                  WebkitMaskImage: `url(${faction.pattern})`,
                  maskImage: `url(${faction.pattern})`,
                }} />
              )}
            </div>

            {/* Titre editable */}
            <div className="faction-title-row">
              <input
                type="text"
                value={faction.title}
                onChange={e => updateField(faction.id, 'title', e.target.value)}
                className="faction-title-input"
              />
            </div>

            {/* Adjectif (ex: Nordique, Celtique) */}
            <div className="faction-title-row" style={{ marginTop: 4 }}>
              <input
                type="text"
                value={faction.adjective || ''}
                onChange={e => updateField(faction.id, 'adjective', e.target.value)}
                className="faction-title-input"
                placeholder="Adjectif (ex: Nordique)"
                style={{ fontSize: 13, opacity: 0.8 }}
              />
            </div>

            {/* ID (handle editable) */}
            <div className="tag-card-info">
              <input
                type="text"
                defaultValue={faction.id}
                className="tag-card-id faction-handle-input"
                onBlur={e => handleRename(faction.id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            </div>

            {/* Couleur */}
            <label className="tag-color-field">
              <span className="tag-color-label">Couleur</span>
              <input
                type="color"
                value={faction.color}
                onChange={e => updateField(faction.id, 'color', e.target.value)}
                className="tag-color-input"
              />
              <span className="tag-color-value">{faction.color}</span>
            </label>

            {/* Pattern SVG */}
            <div className="tag-card-icon-section">
              {faction.pattern ? (
                <div className="tag-icon-preview">
                  <img src={faction.pattern} alt="" className="tag-icon-img" />
                  <div className="tag-icon-actions">
                    <button className="tag-icon-replace" onClick={() => triggerUpload(faction.id)} disabled={uploading === faction.id}>Changer</button>
                    <button className="icon-picker-clear" onClick={() => removePattern(faction.id)} disabled={uploading === faction.id}>Retirer</button>
                  </div>
                </div>
              ) : (
                <button className="tag-icon-btn" onClick={() => triggerUpload(faction.id)} disabled={uploading === faction.id}>
                  {uploading === faction.id ? 'Upload...' : '+ pattern SVG'}
                </button>
              )}
            </div>

            {/* Description */}
            <div className="faction-field">
              <label className="faction-field-label">Description</label>
              <textarea
                value={faction.description ?? ''}
                onChange={e => updateField(faction.id, 'description', e.target.value)}
                placeholder="Description de la faction..."
                className="faction-description-input"
                rows={3}
              />
            </div>

            {/* Bonus énergie */}
            <div className="faction-field">
              <label className="faction-field-label">Bonus Énergie</label>
              <div className="faction-bonus-row">
                <label className="faction-bonus-input">
                  <span>⚡ Max</span>
                  <input type="number" min={-10} max={10} step={0.5} value={faction.bonus_energy}
                    onChange={e => updateField(faction.id, 'bonus_energy', parseFloat(e.target.value) || 0)} />
                </label>
                <label className="faction-bonus-input">
                  <span>⚡ Regen %</span>
                  <input type="number" min={-50} max={50} step={5} value={faction.bonus_regen_energy}
                    onChange={e => updateField(faction.id, 'bonus_regen_energy', parseFloat(e.target.value) || 0)} />
                </label>
              </div>
            </div>

            {/* Bonus par type de lieu */}
            <div className="faction-field">
              <label className="faction-field-label">Réduction de coût par type de lieu (%)</label>
              {allTags.map(tag => {
                const val = tagBonuses[faction.id]?.[tag.id] ?? 0
                return (
                  <div key={tag.id} className="faction-bonus-row" style={{ marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{tag.title}</span>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step={5}
                      value={val}
                      onChange={e => {
                        const num = parseFloat(e.target.value) || 0
                        setTagBonuses(prev => ({
                          ...prev,
                          [faction.id]: { ...(prev[faction.id] || {}), [tag.id]: num }
                        }))
                      }}
                      className="tag-reward-input"
                      style={{ width: 60 }}
                    />
                    <span style={{ fontSize: 11, color: '#8A7B6A', marginLeft: 4 }}>%</span>
                  </div>
                )
              })}
            </div>

            {/* Image faction */}
            <div className="tag-card-icon-section">
              <label className="faction-field-label">Image</label>
              {faction.image_url ? (
                <div className="tag-icon-preview">
                  <img src={faction.image_url} alt="" className="faction-image-preview" />
                  <div className="tag-icon-actions">
                    <button className="tag-icon-replace" onClick={() => triggerImageUpload(faction.id)} disabled={uploading === faction.id}>Changer</button>
                    <button className="icon-picker-clear" onClick={() => removeImage(faction.id)} disabled={uploading === faction.id}>Retirer</button>
                  </div>
                </div>
              ) : (
                <button className="tag-icon-btn" onClick={() => triggerImageUpload(faction.id)} disabled={uploading === faction.id}>
                  {uploading === faction.id ? 'Upload...' : '+ image'}
                </button>
              )}
            </div>

            {/* Supprimer */}
            <button className="faction-delete-btn" onClick={() => handleDelete(faction.id)}>
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
