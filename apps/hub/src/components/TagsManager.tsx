import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
}

export function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTagIdRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchTags()
  }, [])

  async function fetchTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('id, title, color, background, icon, order, reward_energy, reward_conquest, reward_construction')
      .order('order')

    if (!error && data) {
      setTags(data as Tag[])
    }
    setLoading(false)
  }

  // --- Créer un tag ---

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
      id,
      title,
      color: '#C19A6B',
      background: '#F5E6D3',
      order: maxOrder + 1,
      reward_energy: 0,
      reward_conquest: 0,
      reward_construction: 0,
    }).select().single()

    if (!error && data) {
      setTags(prev => [...prev, data as Tag])
      setNewId('')
      setNewTitle('')
    }

    setCreating(false)
  }

  // --- Couleurs ---

  function handleColorChange(tagId: string, field: 'color' | 'background', value: string) {
    // Mise à jour locale immédiate
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, [field]: value } : t))

    // Debounce la sauvegarde en base (éviter de spammer pendant qu'on glisse le picker)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveColor(tagId, field, value)
    }, 400)
  }

  async function saveColor(tagId: string, field: 'color' | 'background', value: string) {
    setSaving(tagId)
    await supabase
      .from('tags')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', tagId)
    setSaving(null)
  }

  // --- Récompenses ---

  const rewardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleRewardChange(tagId: string, field: 'reward_energy' | 'reward_conquest' | 'reward_construction', value: number) {
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, [field]: value } : t))

    if (rewardDebounceRef.current) clearTimeout(rewardDebounceRef.current)
    rewardDebounceRef.current = setTimeout(() => {
      saveReward(tagId, field, value)
    }, 400)
  }

  async function saveReward(tagId: string, field: string, value: number) {
    setSaving(tagId)
    await supabase
      .from('tags')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', tagId)
    setSaving(null)
  }

  // --- Icône SVG ---

  function triggerUpload(tagId: string) {
    uploadTagIdRef.current = tagId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const tagId = uploadTagIdRef.current
    if (!file || !tagId) return

    // Reset input pour pouvoir re-sélectionner le même fichier
    e.target.value = ''

    setUploading(tagId)

    // Supprimer tous les anciens fichiers de ce tag (legacy + précédents uploads)
    const { data: existing } = await supabase.storage.from('tag-icons').list('', {
      search: tagId,
    })
    if (existing && existing.length > 0) {
      await supabase.storage.from('tag-icons').remove(existing.map(f => f.name))
    }

    // Upload avec timestamp pour casser le cache CDN
    const path = `${tagId}-${Date.now()}.svg`

    const { error: uploadError } = await supabase.storage
      .from('tag-icons')
      .upload(path, file, { contentType: 'image/svg+xml' })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(null)
      return
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('tag-icons')
      .getPublicUrl(path)

    const iconUrl = urlData.publicUrl

    // Sauvegarder l'URL dans la table tags
    const { error: updateError } = await supabase
      .from('tags')
      .update({ icon: iconUrl, updated_at: new Date().toISOString() })
      .eq('id', tagId)

    if (!updateError) {
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, icon: iconUrl } : t))
    }

    setUploading(null)
  }

  async function removeIcon(tagId: string) {
    setUploading(tagId)

    // Supprimer tous les fichiers de ce tag
    const { data: existing } = await supabase.storage.from('tag-icons').list('', {
      search: tagId,
    })
    if (existing && existing.length > 0) {
      await supabase.storage.from('tag-icons').remove(existing.map(f => f.name))
    }

    // Mettre icon à null
    const { error } = await supabase
      .from('tags')
      .update({ icon: null, updated_at: new Date().toISOString() })
      .eq('id', tagId)

    if (!error) {
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, icon: null } : t))
    }

    setUploading(null)
  }

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <div>
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

      {/* Input fichier caché, partagé */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/svg+xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="tags-grid">
        {tags.map(tag => (
          <div key={tag.id} className="tag-card">
            {/* Badge preview */}
            <div className="tag-card-preview">
              <span
                className="tag-card-badge"
                style={{ backgroundColor: tag.background, color: tag.color }}
              >
                {tag.icon && (
                  <span
                    className="tag-card-icon-img"
                    style={{
                      WebkitMaskImage: `url(${tag.icon}?v=1)`,
                      maskImage: `url(${tag.icon}?v=1)`,
                      backgroundColor: tag.color,
                    }}
                  />
                )}
                {tag.title}
              </span>
              {saving === tag.id && (
                <span className="tag-saving-indicator">...</span>
              )}
            </div>

            {/* ID + couleurs */}
            <div className="tag-card-info">
              <span className="tag-card-id">{tag.id}</span>
            </div>

            {/* Color pickers */}
            <div className="tag-card-colors-section">
              <label className="tag-color-field">
                <span className="tag-color-label">Texte</span>
                <input
                  type="color"
                  value={tag.color}
                  onChange={e => handleColorChange(tag.id, 'color', e.target.value)}
                  className="tag-color-input"
                />
                <span className="tag-color-value">{tag.color}</span>
              </label>
              <label className="tag-color-field">
                <span className="tag-color-label">Fond</span>
                <input
                  type="color"
                  value={tag.background}
                  onChange={e => handleColorChange(tag.id, 'background', e.target.value)}
                  className="tag-color-input"
                />
                <span className="tag-color-value">{tag.background}</span>
              </label>
            </div>

            {/* Icône SVG */}
            <div className="tag-card-icon-section">
              {tag.icon ? (
                <div className="tag-icon-preview">
                  <img src={`${tag.icon}?v=1`} alt="" className="tag-icon-img" />
                  <div className="tag-icon-actions">
                    <button
                      className="tag-icon-replace"
                      onClick={() => triggerUpload(tag.id)}
                      disabled={uploading === tag.id}
                    >
                      Changer
                    </button>
                    <button
                      className="icon-picker-clear"
                      onClick={() => removeIcon(tag.id)}
                      disabled={uploading === tag.id}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="tag-icon-btn"
                  onClick={() => triggerUpload(tag.id)}
                  disabled={uploading === tag.id}
                >
                  {uploading === tag.id ? 'Upload...' : '+ icône SVG'}
                </button>
              )}
            </div>

            {/* Récompenses découverte */}
            <div className="tag-card-rewards-section">
              <span className="tag-rewards-title">Récompenses</span>
              <div className="tag-rewards-row">
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u26A1'}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={tag.reward_energy}
                    onChange={e => handleRewardChange(tag.id, 'reward_energy', Number(e.target.value))}
                    className="tag-reward-input"
                  />
                </label>
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u2694'}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={tag.reward_conquest}
                    onChange={e => handleRewardChange(tag.id, 'reward_conquest', Number(e.target.value))}
                    className="tag-reward-input"
                  />
                </label>
                <label className="tag-reward-field">
                  <span className="tag-reward-icon">{'\u2692'}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={tag.reward_construction}
                    onChange={e => handleRewardChange(tag.id, 'reward_construction', Number(e.target.value))}
                    className="tag-reward-input"
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
