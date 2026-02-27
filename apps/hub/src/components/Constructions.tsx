import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ConstructionType {
  level: number
  name: string
  description: string
  image_url: string | null
  cost: number
  conquest_bonus: number
  tag_ids: string[] | null
}

interface Tag {
  id: string
  title: string
}

export function Constructions() {
  const [types, setTypes] = useState<ConstructionType[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadLevelRef = useRef<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [typesRes, tagsRes] = await Promise.all([
        supabase
          .from('construction_types')
          .select('level, name, description, image_url, cost, conquest_bonus, tag_ids')
          .order('level'),
        supabase
          .from('tags')
          .select('id, title')
          .order('order'),
      ])

      if (!typesRes.error && typesRes.data) {
        setTypes(typesRes.data as ConstructionType[])
      }
      if (!tagsRes.error && tagsRes.data) {
        setTags(tagsRes.data as Tag[])
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Creer ---

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    const nextLevel = types.length > 0 ? Math.max(...types.map(t => t.level)) + 1 : 1

    setCreating(true)
    const newType: ConstructionType = {
      level: nextLevel,
      name,
      description: '',
      image_url: null,
      cost: nextLevel,
      conquest_bonus: nextLevel,
      tag_ids: null,
    }

    const { error } = await supabase.from('construction_types').insert(newType)

    if (!error) {
      setTypes(prev => [...prev, newType])
      setNewName('')
    }
    setCreating(false)
  }

  // --- Supprimer ---

  async function handleDelete(level: number) {
    if (!window.confirm('Supprimer ce type de construction ?')) return

    const { error } = await supabase.from('construction_types').delete().eq('level', level)
    if (!error) {
      setTypes(prev => prev.filter(t => t.level !== level))
    }
  }

  // --- Editer champs texte ---

  function handleFieldChange(level: number, field: keyof ConstructionType, value: string) {
    setTypes(prev => prev.map(t => t.level === level ? { ...t, [field]: value } : t))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveField(level, field, value)
    }, 400)
  }

  function handleNumberChange(level: number, field: 'cost' | 'conquest_bonus', value: number) {
    setTypes(prev => prev.map(t => t.level === level ? { ...t, [field]: value } : t))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveField(level, field, value)
    }, 400)
  }

  async function saveField(level: number, field: string, value: string | number) {
    setSaving(level)
    await supabase
      .from('construction_types')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('level', level)
    setSaving(null)
  }

  // --- Tags ---

  function handleTagToggle(level: number, tagId: string) {
    const ct = types.find(t => t.level === level)
    if (!ct) return

    const current = ct.tag_ids ?? []
    const updated = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId]

    const newTagIds = updated.length > 0 ? updated : null
    setTypes(prev => prev.map(t => t.level === level ? { ...t, tag_ids: newTagIds } : t))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(level)
      await supabase
        .from('construction_types')
        .update({ tag_ids: newTagIds, updated_at: new Date().toISOString() })
        .eq('level', level)
      setSaving(null)
    }, 400)
  }

  // --- Image upload ---

  function triggerUpload(level: number) {
    uploadLevelRef.current = level
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const level = uploadLevelRef.current
    if (!file || level === null) return

    e.target.value = ''
    setUploading(level)

    const path = `construction-${level}-${Date.now()}.webp`

    const { error: uploadError } = await supabase.storage
      .from('place-images')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(null)
      return
    }

    const { data: urlData } = supabase.storage
      .from('place-images')
      .getPublicUrl(path)

    const imageUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('construction_types')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('level', level)

    if (!updateError) {
      setTypes(prev => prev.map(t => t.level === level ? { ...t, image_url: imageUrl } : t))
    }

    setUploading(null)
  }

  async function removeImage(level: number) {
    const ct = types.find(t => t.level === level)
    if (!ct?.image_url) return

    setUploading(level)

    const { error } = await supabase
      .from('construction_types')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('level', level)

    if (!error) {
      setTypes(prev => prev.map(t => t.level === level ? { ...t, image_url: null } : t))
    }

    setUploading(null)
  }

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Constructions</h1>
        <span className="tags-count">{types.length} niveaux</span>
      </div>

      <p className="construction-subtitle">
        Les joueurs depensent des points de Construction pour fortifier les lieux de leur faction.
        Chaque niveau augmente le cout de conquete pour les ennemis.
      </p>

      {/* Formulaire de creation */}
      <div className="faction-create">
        <input
          type="text"
          placeholder="Nom du nouveau niveau..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="faction-create-input"
          disabled={creating}
        />
        <button
          className="faction-create-btn"
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
        >
          {creating ? '...' : '+ Ajouter'}
        </button>
      </div>

      {/* Input fichier cache */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/webp,image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="tags-grid">
        {types.map(ct => (
          <div key={ct.level} className="tag-card">
            {/* Header avec level */}
            <div className="construction-level-badge">
              Niveau {ct.level}
            </div>

            {/* Image */}
            <div className="construction-image-section">
              {ct.image_url ? (
                <div className="construction-image-wrap">
                  <img src={ct.image_url} alt={ct.name} className="construction-image" />
                  <div className="tag-icon-actions">
                    <button
                      className="tag-icon-replace"
                      onClick={() => triggerUpload(ct.level)}
                      disabled={uploading === ct.level}
                    >
                      Changer
                    </button>
                    <button
                      className="icon-picker-clear"
                      onClick={() => removeImage(ct.level)}
                      disabled={uploading === ct.level}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="tag-icon-btn construction-upload-btn"
                  onClick={() => triggerUpload(ct.level)}
                  disabled={uploading === ct.level}
                >
                  {uploading === ct.level ? 'Upload...' : '+ Image'}
                </button>
              )}
            </div>

            {/* Nom */}
            <div className="faction-title-row">
              <input
                type="text"
                value={ct.name}
                onChange={e => handleFieldChange(ct.level, 'name', e.target.value)}
                className="faction-title-input"
                placeholder="Nom de la construction"
              />
              {saving === ct.level && (
                <span className="tag-saving-indicator">...</span>
              )}
            </div>

            {/* Description */}
            <div className="faction-field">
              <label className="faction-field-label">Description</label>
              <textarea
                value={ct.description}
                onChange={e => handleFieldChange(ct.level, 'description', e.target.value)}
                placeholder="Phrase explicative du bonus..."
                className="faction-description-input"
                rows={2}
              />
            </div>

            {/* Cout + Bonus */}
            <div className="faction-field">
              <label className="faction-field-label">Statistiques</label>
              <div className="faction-bonus-row">
                <label className="faction-bonus-input">
                  <span>Cout</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={ct.cost}
                    onChange={e => handleNumberChange(ct.level, 'cost', parseInt(e.target.value) || 1)}
                  />
                </label>
                <label className="faction-bonus-input">
                  <span>+Conquete</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={ct.conquest_bonus}
                    onChange={e => handleNumberChange(ct.level, 'conquest_bonus', parseInt(e.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            {/* Filtrage par tags */}
            <div className="faction-field">
              <label className="faction-field-label">
                Tags ({ct.tag_ids ? ct.tag_ids.length : 'tous'})
              </label>
              <div className="construction-tags-picker">
                {tags.map(tag => {
                  const isSelected = ct.tag_ids?.includes(tag.id) ?? false
                  return (
                    <label key={tag.id} className="construction-tag-option">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTagToggle(ct.level, tag.id)}
                      />
                      <span>{tag.title}</span>
                    </label>
                  )
                })}
              </div>
              <span className="construction-tags-hint">
                Aucun = applicable a tous les lieux
              </span>
            </div>

            {/* Supprimer */}
            <button
              className="faction-delete-btn"
              onClick={() => handleDelete(ct.level)}
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
