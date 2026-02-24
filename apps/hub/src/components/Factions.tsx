import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Faction {
  id: string
  title: string
  color: string
  pattern: string | null
  description: string | null
  image_url: string | null
  order: number
  bonus_energy: number
  bonus_conquest: number
  bonus_construction: number
  bonus_regen_energy: number
  bonus_regen_conquest: number
  bonus_regen_construction: number
}

export function Factions() {
  const [factions, setFactions] = useState<Faction[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const uploadFactionIdRef = useRef<string | null>(null)
  const imageUploadFactionIdRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchFactions()
  }, [])

  async function fetchFactions() {
    const { data, error } = await supabase
      .from('factions')
      .select('id, title, color, pattern, description, image_url, order, bonus_energy, bonus_conquest, bonus_construction, bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction')
      .order('order')

    if (!error && data) {
      setFactions(data as Faction[])
    }
    setLoading(false)
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
      id,
      title,
      color: '#C19A6B',
      pattern: null,
      description: null,
      image_url: null,
      order: factions.length,
      bonus_energy: 0,
      bonus_conquest: 0,
      bonus_construction: 0,
      bonus_regen_energy: 0,
      bonus_regen_conquest: 0,
      bonus_regen_construction: 0,
    }

    const { error } = await supabase.from('factions').insert(newFaction)

    if (!error) {
      setFactions(prev => [...prev, newFaction])
      setNewTitle('')
    }
    setCreating(false)
  }

  // --- Supprimer ---

  async function handleDelete(factionId: string) {
    if (!window.confirm('Supprimer cette faction ?')) return

    // Supprimer le pattern du storage si present
    const faction = factions.find(f => f.id === factionId)
    if (faction?.pattern) {
      await supabase.storage.from('faction-patterns').remove([`${factionId}.svg`])
    }

    const { error } = await supabase.from('factions').delete().eq('id', factionId)

    if (!error) {
      setFactions(prev => prev.filter(f => f.id !== factionId))
    }
  }

  // --- Editer titre ---

  function handleTitleChange(factionId: string, value: string) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, title: value } : f))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveField(factionId, 'title', value)
    }, 400)
  }

  // --- Couleur ---

  function handleColorChange(factionId: string, value: string) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, color: value } : f))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveField(factionId, 'color', value)
    }, 400)
  }

  function handleDescriptionChange(factionId: string, value: string) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, description: value } : f))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveField(factionId, 'description', value)
    }, 600)
  }

  function handleBonusChange(factionId: string, field: 'bonus_energy' | 'bonus_conquest' | 'bonus_construction' | 'bonus_regen_energy' | 'bonus_regen_conquest' | 'bonus_regen_construction', value: number) {
    setFactions(prev => prev.map(f => f.id === factionId ? { ...f, [field]: value } : f))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveBonusField(factionId, field, value)
    }, 400)
  }

  async function saveBonusField(factionId: string, field: string, value: number) {
    setSaving(factionId)
    await supabase
      .from('factions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', factionId)
    setSaving(null)
  }

  async function saveField(factionId: string, field: string, value: string) {
    setSaving(factionId)
    await supabase
      .from('factions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', factionId)
    setSaving(null)
  }

  // --- Pattern SVG ---

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

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(null)
      return
    }

    const { data: urlData } = supabase.storage
      .from('faction-patterns')
      .getPublicUrl(path)

    const patternUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('factions')
      .update({ pattern: patternUrl, updated_at: new Date().toISOString() })
      .eq('id', factionId)

    if (!updateError) {
      setFactions(prev => prev.map(f => f.id === factionId ? { ...f, pattern: patternUrl } : f))
    }

    setUploading(null)
  }

  async function removePattern(factionId: string) {
    setUploading(factionId)

    await supabase.storage.from('faction-patterns').remove([`${factionId}.svg`])

    const { error } = await supabase
      .from('factions')
      .update({ pattern: null, updated_at: new Date().toISOString() })
      .eq('id', factionId)

    if (!error) {
      setFactions(prev => prev.map(f => f.id === factionId ? { ...f, pattern: null } : f))
    }

    setUploading(null)
  }

  // --- Image faction ---

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
      console.error('Image upload error:', uploadError)
      alert(`Erreur upload: ${uploadError.message}`)
      setUploading(null)
      return
    }

    const { data: urlData } = supabase.storage
      .from('faction-patterns')
      .getPublicUrl(path)

    const imageUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('factions')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', factionId)

    if (updateError) {
      console.error('DB update error:', updateError)
      alert(`Erreur DB: ${updateError.message}`)
    } else {
      setFactions(prev => prev.map(f => f.id === factionId ? { ...f, image_url: imageUrl } : f))
    }

    setUploading(null)
  }

  async function removeImage(factionId: string) {
    const faction = factions.find(f => f.id === factionId)
    if (!faction?.image_url) return

    setUploading(factionId)

    // Extraire le nom de fichier depuis l'URL
    const urlParts = faction.image_url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    await supabase.storage.from('faction-patterns').remove([fileName])

    const { error } = await supabase
      .from('factions')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('id', factionId)

    if (!error) {
      setFactions(prev => prev.map(f => f.id === factionId ? { ...f, image_url: null } : f))
    }

    setUploading(null)
  }

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Factions</h1>
        <span className="tags-count">{factions.length} factions</span>
      </div>

      {/* Formulaire de creation */}
      <div className="faction-create">
        <input
          type="text"
          placeholder="Nom de la nouvelle faction..."
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/svg+xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/webp,image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />

      <div className="tags-grid">
        {factions.map(faction => (
          <div key={faction.id} className="tag-card">
            {/* Preview territoire */}
            <div
              className="faction-preview"
              style={{ backgroundColor: faction.color }}
            >
              {faction.pattern && (
                <div
                  className="faction-preview-pattern"
                  style={{
                    WebkitMaskImage: `url(${faction.pattern})`,
                    maskImage: `url(${faction.pattern})`,
                  }}
                />
              )}
            </div>

            {/* Titre editable */}
            <div className="faction-title-row">
              <input
                type="text"
                value={faction.title}
                onChange={e => handleTitleChange(faction.id, e.target.value)}
                className="faction-title-input"
              />
              {saving === faction.id && (
                <span className="tag-saving-indicator">...</span>
              )}
            </div>

            {/* ID */}
            <div className="tag-card-info">
              <span className="tag-card-id">{faction.id}</span>
            </div>

            {/* Couleur */}
            <label className="tag-color-field">
              <span className="tag-color-label">Couleur</span>
              <input
                type="color"
                value={faction.color}
                onChange={e => handleColorChange(faction.id, e.target.value)}
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
                    <button
                      className="tag-icon-replace"
                      onClick={() => triggerUpload(faction.id)}
                      disabled={uploading === faction.id}
                    >
                      Changer
                    </button>
                    <button
                      className="icon-picker-clear"
                      onClick={() => removePattern(faction.id)}
                      disabled={uploading === faction.id}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="tag-icon-btn"
                  onClick={() => triggerUpload(faction.id)}
                  disabled={uploading === faction.id}
                >
                  {uploading === faction.id ? 'Upload...' : '+ pattern SVG'}
                </button>
              )}
            </div>

            {/* Description */}
            <div className="faction-field">
              <label className="faction-field-label">Description</label>
              <textarea
                value={faction.description ?? ''}
                onChange={e => handleDescriptionChange(faction.id, e.target.value)}
                placeholder="Description de la faction..."
                className="faction-description-input"
                rows={3}
              />
            </div>

            {/* Bonus jauges */}
            <div className="faction-field">
              <label className="faction-field-label">Bonus Jauges</label>
              <div className="faction-bonus-row">
                <label className="faction-bonus-input">
                  <span>Energie</span>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    step={0.5}
                    value={faction.bonus_energy}
                    onChange={e => handleBonusChange(faction.id, 'bonus_energy', parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="faction-bonus-input">
                  <span>Conquete</span>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    step={0.5}
                    value={faction.bonus_conquest}
                    onChange={e => handleBonusChange(faction.id, 'bonus_conquest', parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="faction-bonus-input">
                  <span>Construction</span>
                  <input
                    type="number"
                    min={-10}
                    max={10}
                    step={0.5}
                    value={faction.bonus_construction}
                    onChange={e => handleBonusChange(faction.id, 'bonus_construction', parseFloat(e.target.value) || 0)}
                  />
                </label>
              </div>
              <label className="faction-field-label" style={{ marginTop: 8 }}>Regen % (par ressource)</label>
              <div className="faction-bonus-row">
                <label className="faction-bonus-input">
                  <span>Energie</span>
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step={5}
                    value={faction.bonus_regen_energy}
                    onChange={e => handleBonusChange(faction.id, 'bonus_regen_energy', parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="faction-bonus-input">
                  <span>Conquete</span>
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step={5}
                    value={faction.bonus_regen_conquest}
                    onChange={e => handleBonusChange(faction.id, 'bonus_regen_conquest', parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="faction-bonus-input">
                  <span>Construction</span>
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step={5}
                    value={faction.bonus_regen_construction}
                    onChange={e => handleBonusChange(faction.id, 'bonus_regen_construction', parseFloat(e.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            {/* Image faction */}
            <div className="tag-card-icon-section">
              <label className="faction-field-label">Image</label>
              {faction.image_url ? (
                <div className="tag-icon-preview">
                  <img src={faction.image_url} alt="" className="faction-image-preview" />
                  <div className="tag-icon-actions">
                    <button
                      className="tag-icon-replace"
                      onClick={() => triggerImageUpload(faction.id)}
                      disabled={uploading === faction.id}
                    >
                      Changer
                    </button>
                    <button
                      className="icon-picker-clear"
                      onClick={() => removeImage(faction.id)}
                      disabled={uploading === faction.id}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="tag-icon-btn"
                  onClick={() => triggerImageUpload(faction.id)}
                  disabled={uploading === faction.id}
                >
                  {uploading === faction.id ? 'Upload...' : '+ image'}
                </button>
              )}
            </div>

            {/* Supprimer */}
            <button
              className="faction-delete-btn"
              onClick={() => handleDelete(faction.id)}
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
