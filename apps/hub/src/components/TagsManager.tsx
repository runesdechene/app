import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface Tag {
  id: string
  title: string
  color: string
  background: string
  icon: string | null
  order: number
  reward_energy: number
  reward_conquest: number
  reward_construction: number
  gauge: string
  base_cost: number
}


export function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([])
  const [savedTags, setSavedTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({})
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTagIdRef = useRef<string | null>(null)

  const hasChanges = JSON.stringify(tags) !== JSON.stringify(savedTags)

  useEffect(() => {
    fetchTags()
  }, [])

  async function fetchTags() {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, title, color, background, icon, order, reward_energy, reward_conquest, reward_construction, gauge, base_cost')
        .order('order')

      if (!error && data) {
        setTags(data as Tag[])
        setSavedTags(data as Tag[])
      }

      // Compter les lieux par tag
      const { data: counts } = await supabase
        .from('place_tags')
        .select('tag_id')
      if (counts) {
        const map: Record<string, number> = {}
        for (const row of counts as Array<{ tag_id: string }>) {
          map[row.tag_id] = (map[row.tag_id] || 0) + 1
        }
        setPlaceCounts(map)
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Modifier localement ---

  function updateField(tagId: string, field: string, value: string | number) {
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, [field]: value } : t))
  }

  // --- Sauvegarder tout ---

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const promises = tags.map(t => {
        const saved = savedTags.find(s => s.id === t.id)
        if (JSON.stringify(t) === JSON.stringify(saved)) return null
        return supabase.from('tags').update({
          title: t.title,
          icon: t.icon,
          color: t.color,
          background: t.background,
          reward_energy: t.reward_energy,
          reward_conquest: t.reward_conquest,
          reward_construction: t.reward_construction,
          gauge: t.gauge,
          base_cost: t.base_cost,
          updated_at: new Date().toISOString(),
        }).eq('id', t.id).then(r => r)
      }).filter(Boolean)

      const results = await Promise.all(promises)
      const errors = results.filter(r => r?.error)

      if (errors.length > 0) {
        setSaveError(`Erreur sur ${errors.length} tag(s)`)
      } else {
        await fetchTags()
      }
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTags(JSON.parse(JSON.stringify(savedTags)))
    setSaveError(null)
  }

  // --- Créer ---

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function handleCreate() {
    const id = newId.trim() || slugify(newTitle)
    const title = newTitle.trim()
    if (!id || !title) return
    if (tags.some(t => t.id === id)) return

    setCreating(true)
    const maxOrder = tags.reduce((max, t) => Math.max(max, t.order), -1)

    const { data, error } = await supabase.from('tags').insert({
      id, title, color: '#C19A6B', background: '#F5E6D3',
      order: maxOrder + 1, reward_energy: 0, reward_conquest: 0, reward_construction: 0, gauge: 'energy', base_cost: 1,
    }).select().single()

    if (!error && data) {
      setTags(prev => [...prev, data as Tag])
      setSavedTags(prev => [...prev, data as Tag])
      setNewId('')
      setNewTitle('')
    }
    setCreating(false)
  }

  // --- Icône SVG (save immédiat car fichier) ---

  function triggerUpload(tagId: string) {
    uploadTagIdRef.current = tagId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const tagId = uploadTagIdRef.current
    if (!file || !tagId) return
    e.target.value = ''
    setUploading(tagId)

    const { data: existing } = await supabase.storage.from('tag-icons').list('', { search: tagId })
    if (existing && existing.length > 0) {
      await supabase.storage.from('tag-icons').remove(existing.map(f => f.name))
    }

    const path = `${tagId}-${Date.now()}.svg`
    const { error: uploadError } = await supabase.storage
      .from('tag-icons')
      .upload(path, file, { contentType: 'image/svg+xml' })

    if (uploadError) { setUploading(null); return }

    const { data: urlData } = supabase.storage.from('tag-icons').getPublicUrl(path)
    const iconUrl = urlData.publicUrl

    setTags(prev => prev.map(t => t.id === tagId ? { ...t, icon: iconUrl } : t))
    setUploading(null)
  }

  function removeIcon(tagId: string) {
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, icon: null } : t))
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Tags</h1>
        <span className="tags-count">{tags.length} tags</span>
      </div>

      {/* Formulaire d'ajout */}
      <div className="tag-create-row">
        <input
          type="text"
          placeholder="Nom du tag..."
          value={newTitle}
          onChange={e => { setNewTitle(e.target.value); if (!newId) setNewId('') }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="tag-create-input"
          disabled={creating}
        />
        <input
          type="text"
          placeholder={newTitle ? slugify(newTitle) || 'id' : 'ID (auto)'}
          value={newId}
          onChange={e => setNewId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="tag-create-input tag-create-id"
          disabled={creating}
        />
        <button
          className="faction-create-btn"
          onClick={handleCreate}
          disabled={creating || !newTitle.trim()}
        >
          {creating ? '...' : '+ Ajouter'}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/svg+xml" style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="tags-grid">
        {tags.map(tag => (
          <div key={tag.id} className="tag-card">
            {/* Badge preview */}
            <div className="tag-card-preview">
              <span className="tag-card-badge" style={{ backgroundColor: tag.background, color: tag.color }}>
                {tag.icon && (
                  <span className="tag-card-icon-img" style={{
                    WebkitMaskImage: `url(${tag.icon}?v=1)`,
                    maskImage: `url(${tag.icon}?v=1)`,
                    backgroundColor: tag.color,
                  }} />
                )}
                <input
                  type="text"
                  value={tag.title}
                  onChange={e => updateField(tag.id, 'title', e.target.value)}
                  className="tag-title-input"
                />
              </span>
            </div>

            <div className="tag-card-info">
              <span className="tag-card-id">{tag.id}</span>
              <span className="tag-card-count">{placeCounts[tag.id] || 0} lieu{(placeCounts[tag.id] || 0) > 1 ? 'x' : ''}</span>
            </div>

            {/* Color pickers */}
            <div className="tag-card-colors-section">
              <label className="tag-color-field">
                <span className="tag-color-label">Texte</span>
                <input type="color" value={tag.color} onChange={e => updateField(tag.id, 'color', e.target.value)} className="tag-color-input" />
                <span className="tag-color-value">{tag.color}</span>
              </label>
              <label className="tag-color-field">
                <span className="tag-color-label">Fond</span>
                <input type="color" value={tag.background} onChange={e => updateField(tag.id, 'background', e.target.value)} className="tag-color-input" />
                <span className="tag-color-value">{tag.background}</span>
              </label>
            </div>

            {/* Icône SVG */}
            <div className="tag-card-icon-section">
              {tag.icon ? (
                <div className="tag-icon-preview">
                  <img src={`${tag.icon}?v=1`} alt="" className="tag-icon-img" />
                  <div className="tag-icon-actions">
                    <button className="tag-icon-replace" onClick={() => triggerUpload(tag.id)} disabled={uploading === tag.id}>Changer</button>
                    <button className="icon-picker-clear" onClick={() => removeIcon(tag.id)} disabled={uploading === tag.id}>Retirer</button>
                  </div>
                </div>
              ) : (
                <button className="tag-icon-btn" onClick={() => triggerUpload(tag.id)} disabled={uploading === tag.id}>
                  {uploading === tag.id ? 'Upload...' : '+ icône SVG'}
                </button>
              )}
            </div>

            {/* Coût en énergie */}
            <div className="tag-card-rewards-section">
              <span className="tag-rewards-title">Cout energie</span>
              <input type="number" min={0.5} max={10} step={0.5} value={tag.base_cost}
                onChange={e => updateField(tag.id, 'base_cost', parseFloat(e.target.value) || 1)}
                className="tag-reward-input" />
            </div>

            {/* Récompenses découverte */}
            <div className="tag-card-rewards-section">
              <span className="tag-rewards-title">Recompenses</span>
              <div className="tag-rewards-row">
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u26A1'}</span>
                  <input type="number" min={0} step={1} value={tag.reward_energy}
                    onChange={e => updateField(tag.id, 'reward_energy', Number(e.target.value))} className="tag-reward-input" />
                </label>
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u2694'}</span>
                  <input type="number" min={0} step={1} value={tag.reward_conquest}
                    onChange={e => updateField(tag.id, 'reward_conquest', Number(e.target.value))} className="tag-reward-input" />
                </label>
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u2692'}</span>
                  <input type="number" min={0} step={1} value={tag.reward_construction}
                    onChange={e => updateField(tag.id, 'reward_construction', Number(e.target.value))} className="tag-reward-input" />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SaveBar hasChanges={hasChanges} saving={saving} error={saveError} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}
