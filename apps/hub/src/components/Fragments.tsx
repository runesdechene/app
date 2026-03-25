import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface FragmentWord {
  id: number
  word: string
  slot: 'nom' | 'epithete' | 'connecteur'
  gender: 'm' | 'f' | 'n'
}

interface Fragment {
  id: number
  name: string
  description: string | null
  icon: string | null
  icon_url: string | null
  image_url: string | null
  collection: string | null
  bonus_type: string | null
  bonus_value: number
  link_url: string | null
  visible: boolean
  words: FragmentWord[]
}

interface PlayerResult {
  id: string
  first_name: string | null
  email_address: string
}

const BONUS_TYPES = [
  { value: '', label: 'Aucun bonus' },
  { value: 'max_energy', label: 'Max Energie' },
  { value: 'max_conquest', label: 'Max Conquete' },
  { value: 'max_construction', label: 'Max Construction' },
  { value: 'regen_energy', label: '% Regen Energie' },
  { value: 'regen_conquest', label: '% Regen Conquete' },
  { value: 'regen_construction', label: '% Regen Construction' },
]

interface FactionOption {
  id: string
  title: string
}

export function Fragments() {
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [factions, setFactions] = useState<FactionOption[]>([])
  const [savedFragments, setSavedFragments] = useState<Fragment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageUploadFragIdRef = useRef<number | null>(null)
  const [uploadingImage, setUploadingImage] = useState<number | null>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const iconUploadFragIdRef = useRef<number | null>(null)
  const [uploadingIcon, setUploadingIcon] = useState<number | null>(null)

  // Owners par fragment
  const [owners, setOwners] = useState<Record<number, Array<{ userId: string; name: string }>>>({})

  // Attribution manuelle
  const [grantFragmentId, setGrantFragmentId] = useState<number | null>(null)
  const [grantSearch, setGrantSearch] = useState('')
  const [grantResults, setGrantResults] = useState<PlayerResult[]>([])
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    fetchFragments()
  }, [])

  async function fetchFragments() {
    try {
      const [fragsRes, wordsRes, factionsRes, ownersRes] = await Promise.all([
        supabase.from('title_fragments').select('*').order('created_at', { ascending: false }),
        supabase.from('fragment_words').select('*').order('id'),
        supabase.from('factions').select('id, title').order('order'),
        supabase.from('user_fragments').select('user_id, fragment_id, users!inner(first_name, email_address)'),
      ])

      const frags = fragsRes.data
      if (!frags) return
      if (factionsRes.data) setFactions(factionsRes.data as FactionOption[])

      // Regrouper les owners par fragment
      const ownerMap: Record<number, Array<{ userId: string; name: string }>> = {}
      if (ownersRes.data) {
        for (const row of ownersRes.data as Array<{ user_id: string; fragment_id: number; users: unknown }>) {
          if (!ownerMap[row.fragment_id]) ownerMap[row.fragment_id] = []
          const u = row.users as { first_name: string | null; email_address: string } | Array<{ first_name: string | null; email_address: string }>
          const user = Array.isArray(u) ? u[0] : u
          if (user) ownerMap[row.fragment_id].push({ userId: row.user_id, name: user.first_name || user.email_address })
        }
      }
      setOwners(ownerMap)

      const words = wordsRes.data

      const result: Fragment[] = (frags as Array<{
        id: number; name: string; description: string | null;
        icon: string | null; icon_url: string | null; image_url: string | null; collection: string | null;
        bonus_type: string | null; bonus_value: number; link_url: string | null; visible: boolean
      }>).map(f => ({
        ...f,
        words: ((words ?? []) as Array<{
          id: number; fragment_id: number; word: string; slot: string; gender: string
        }>)
          .filter(w => w.fragment_id === f.id)
          .map(w => ({ id: w.id, word: w.word, slot: w.slot as FragmentWord['slot'], gender: w.gender as FragmentWord['gender'] })),
      }))

      setFragments(result)
      setSavedFragments(result.map(f => ({ ...f })))
    } finally {
      setLoading(false)
    }
  }

  // --- Creer ---

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)

    const { data, error } = await supabase
      .from('title_fragments')
      .insert({ name })
      .select()
      .single()

    if (!error && data) {
      const newFrag = { ...data as Fragment, words: [] }
      setFragments(prev => [newFrag, ...prev])
      setSavedFragments(prev => [{ ...newFrag }, ...prev])
      setNewName('')
    }
    setCreating(false)
  }

  // --- Supprimer ---

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer ce fragment et tous ses mots ?')) return
    const { error } = await supabase.from('title_fragments').delete().eq('id', id)
    if (!error) {
      setFragments(prev => prev.filter(f => f.id !== id))
      setSavedFragments(prev => prev.filter(f => f.id !== id))
    }
  }

  // Comparaison sans les words (les words sont saved immédiatement)
  const hasChanges = JSON.stringify(fragments.map(f => ({ ...f, words: [] }))) !== JSON.stringify(savedFragments.map(f => ({ ...f, words: [] })))

  // --- Modifier localement ---

  function updateFragment(id: number, field: string, value: string | number | boolean | null) {
    setFragments(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  // --- Sauvegarder tout ---

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const promises = fragments.map(f => {
      const saved = savedFragments.find(s => s.id === f.id)
      if (!saved) return null
      // Comparer sans words
      const { words: _w1, ...fData } = f
      const { words: _w2, ...sData } = saved
      if (JSON.stringify(fData) === JSON.stringify(sData)) return null
      return supabase.from('title_fragments').update({
        name: f.name,
        description: f.description || null,
        icon: f.icon || null,
        image_url: f.image_url,
        link_url: f.link_url || null,
        collection: f.collection || null,
        bonus_type: f.bonus_type || null,
        bonus_value: f.bonus_value,
        visible: f.visible,
      }).eq('id', f.id).then(r => r)
    }).filter(Boolean)

    const results = await Promise.all(promises)
    const errors = results.filter(r => r?.error)

    if (errors.length > 0) {
      setSaveError(`Erreur sur ${errors.length} fragment(s)`)
    } else {
      setSavedFragments(fragments.map(f => ({ ...f })))
    }
    setSaving(false)
  }

  function handleCancel() {
    setFragments(savedFragments.map(f => ({ ...f })))
    setSaveError(null)
  }

  // --- Mots ---

  async function addWord(fragmentId: number, slot: 'nom' | 'epithete' | 'connecteur') {
    const { data, error } = await supabase
      .from('fragment_words')
      .insert({ fragment_id: fragmentId, word: '', slot, gender: 'n' })
      .select()
      .single()

    if (!error && data) {
      const w = data as { id: number; word: string; slot: string; gender: string }
      setFragments(prev => prev.map(f => f.id === fragmentId
        ? { ...f, words: [...f.words, { id: w.id, word: w.word, slot: w.slot as FragmentWord['slot'], gender: w.gender as FragmentWord['gender'] }] }
        : f
      ))
    }
  }

  function updateWord(fragmentId: number, wordId: number, field: string, value: string) {
    setFragments(prev => prev.map(f => f.id === fragmentId
      ? { ...f, words: f.words.map(w => w.id === wordId ? { ...w, [field]: value } : w) }
      : f
    ))
  }

  function saveWordOnBlur(wordId: number, field: string, value: string) {
    saveWord(wordId, field, value)
  }

  async function saveWord(wordId: number, field: string, value: string) {
    await supabase.from('fragment_words').update({ [field]: value }).eq('id', wordId)
  }

  async function deleteWord(fragmentId: number, wordId: number) {
    const { error } = await supabase.from('fragment_words').delete().eq('id', wordId)
    if (!error) {
      setFragments(prev => prev.map(f => f.id === fragmentId
        ? { ...f, words: f.words.filter(w => w.id !== wordId) }
        : f
      ))
    }
  }

  // --- Image fragment ---

  function triggerImageUpload(fragId: number) {
    imageUploadFragIdRef.current = fragId
    imageInputRef.current?.click()
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const fragId = imageUploadFragIdRef.current
    if (!file || !fragId) return
    e.target.value = ''
    setUploadingImage(fragId)

    const ext = file.name.split('.').pop() || 'webp'
    const path = `fragment-${fragId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('app-fragments')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) {
      alert(`Erreur upload: ${uploadErr.message}`)
      setUploadingImage(null)
      return
    }

    const { data: urlData } = supabase.storage.from('app-fragments').getPublicUrl(path)
    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`

    await supabase.from('title_fragments').update({ image_url: imageUrl }).eq('id', fragId)
    setFragments(prev => prev.map(f => f.id === fragId ? { ...f, image_url: imageUrl } : f))
    setUploadingImage(null)
  }

  async function removeImage(fragId: number) {
    const frag = fragments.find(f => f.id === fragId)
    if (!frag?.image_url) return
    setUploadingImage(fragId)

    const urlParts = frag.image_url.split('?')[0].split('/')
    const fileName = urlParts[urlParts.length - 1]
    await supabase.storage.from('app-fragments').remove([fileName])

    await supabase.from('title_fragments').update({ image_url: null }).eq('id', fragId)
    setFragments(prev => prev.map(f => f.id === fragId ? { ...f, image_url: null } : f))
    setUploadingImage(null)
  }

  // --- Icone fragment ---

  function triggerIconUpload(fragId: number) {
    iconUploadFragIdRef.current = fragId
    iconInputRef.current?.click()
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const fragId = iconUploadFragIdRef.current
    if (!file || !fragId) return
    e.target.value = ''
    setUploadingIcon(fragId)

    const ext = file.name.split('.').pop() || 'webp'
    const path = `icon-${fragId}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('app-fragments')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) {
      alert(`Erreur upload: ${uploadErr.message}`)
      setUploadingIcon(null)
      return
    }

    const { data: urlData } = supabase.storage.from('app-fragments').getPublicUrl(path)
    const iconUrl = `${urlData.publicUrl}?t=${Date.now()}`

    await supabase.from('title_fragments').update({ icon_url: iconUrl }).eq('id', fragId)
    setFragments(prev => prev.map(f => f.id === fragId ? { ...f, icon_url: iconUrl } : f))
    setSavedFragments(prev => prev.map(f => f.id === fragId ? { ...f, icon_url: iconUrl } : f))
    setUploadingIcon(null)
  }

  async function removeIcon(fragId: number) {
    setUploadingIcon(fragId)
    await supabase.from('title_fragments').update({ icon_url: null }).eq('id', fragId)
    setFragments(prev => prev.map(f => f.id === fragId ? { ...f, icon_url: null } : f))
    setSavedFragments(prev => prev.map(f => f.id === fragId ? { ...f, icon_url: null } : f))
    setUploadingIcon(null)
  }

  // --- Attribution manuelle ---

  async function searchPlayers(query: string) {
    setGrantSearch(query)
    if (query.length < 2) { setGrantResults([]); return }

    const { data } = await supabase
      .from('users')
      .select('id, first_name, email_address')
      .or(`first_name.ilike.%${query}%,email_address.ilike.%${query}%`)
      .limit(10)

    setGrantResults((data ?? []) as PlayerResult[])
  }

  async function grantFragment(userId: string) {
    if (!grantFragmentId) return
    setGranting(true)

    const { error } = await supabase
      .from('user_fragments')
      .upsert({ user_id: userId, fragment_id: grantFragmentId, source: 'manual' })

    if (!error) {
      // Log dans purchase_log
      const player = grantResults.find(p => p.id === userId)
      await supabase.from('purchase_log').insert({
        email: player?.email_address,
        user_id: userId,
        unlock_type: 'fragment',
        unlock_ref_id: grantFragmentId,
        status: 'manual',
      })
      // Mettre a jour l'affichage des owners
      const fragId = grantFragmentId
      setOwners(prev => ({
        ...prev,
        [fragId]: [...(prev[fragId] ?? []), { userId, name: player?.first_name || player?.email_address || '?' }],
      }))
    }

    setGranting(false)
    setGrantFragmentId(null)
    setGrantSearch('')
    setGrantResults([])
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Fragments</h1>
        <span className="tags-count">{fragments.length} fragments</span>
      </div>

      {/* Creation */}
      <div className="faction-create">
        <input
          type="text"
          placeholder="Nom du nouveau fragment..."
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
          {creating ? '...' : '+ Creer'}
        </button>
      </div>

      {/* Inputs fichiers caches */}
      <input ref={imageInputRef} type="file" accept="image/webp,image/png,image/jpeg" style={{ display: 'none' }} onChange={handleImageUpload} />
      <input ref={iconInputRef} type="file" accept="image/webp,image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={handleIconUpload} />

      {/* Liste des fragments */}
      <div className="tags-grid fragments-grid">
        {fragments.map(frag => (
          <div key={frag.id} className="tag-card fragment-card">
            {/* Header */}
            <div className="faction-title-row">
              <input
                type="text"
                value={frag.icon ?? ''}
                onChange={e => updateFragment(frag.id, 'icon', e.target.value)}
                className="title-icon-input"
                placeholder="emoji"
              />
              <input
                type="text"
                value={frag.name}
                onChange={e => updateFragment(frag.id, 'name', e.target.value)}
                className="faction-title-input"
              />
              {saving && <span className="tag-saving-indicator">...</span>}
            </div>

            {/* Description */}
            <div className="faction-field">
              <label className="faction-field-label">Description</label>
              <textarea
                value={frag.description ?? ''}
                onChange={e => updateFragment(frag.id, 'description', e.target.value)}
                placeholder="Description du fragment..."
                className="faction-description-input"
                rows={2}
                style={{ minHeight: 60 }}
              />
            </div>

            {/* Icone */}
            <div className="tag-card-icon-section">
              <label className="faction-field-label">Icone (badge)</label>
              {frag.icon_url ? (
                <div className="tag-icon-preview">
                  <img src={frag.icon_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  <div className="tag-icon-actions">
                    <button className="tag-icon-replace" onClick={() => triggerIconUpload(frag.id)} disabled={uploadingIcon === frag.id}>Changer</button>
                    <button className="icon-picker-clear" onClick={() => removeIcon(frag.id)} disabled={uploadingIcon === frag.id}>Retirer</button>
                  </div>
                </div>
              ) : (
                <button className="tag-icon-btn" onClick={() => triggerIconUpload(frag.id)} disabled={uploadingIcon === frag.id}>
                  {uploadingIcon === frag.id ? 'Upload...' : '+ icone'}
                </button>
              )}
            </div>

            {/* Image */}
            <div className="tag-card-icon-section">
              <label className="faction-field-label">Image (grande)</label>
              {frag.image_url ? (
                <div className="tag-icon-preview">
                  <img src={frag.image_url} alt="" className="faction-image-preview" />
                  <div className="tag-icon-actions">
                    <button className="tag-icon-replace" onClick={() => triggerImageUpload(frag.id)} disabled={uploadingImage === frag.id}>
                      Changer
                    </button>
                    <button className="icon-picker-clear" onClick={() => removeImage(frag.id)} disabled={uploadingImage === frag.id}>
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button className="tag-icon-btn" onClick={() => triggerImageUpload(frag.id)} disabled={uploadingImage === frag.id}>
                  {uploadingImage === frag.id ? 'Upload...' : '+ image'}
                </button>
              )}
            </div>

            {/* Lien */}
            <div className="faction-field">
              <label className="faction-field-label">Lien (URL collection)</label>
              <input
                type="text"
                value={frag.link_url ?? ''}
                onChange={e => updateFragment(frag.id, 'link_url', e.target.value)}
                placeholder="https://runesdechene.com/collections/..."
                className="fragment-word-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Collection + Bonus */}
            <div className="faction-bonus-row">
              <label className="faction-bonus-input">
                <span>Collection</span>
                <select
                  value={frag.collection ?? ''}
                  onChange={e => updateFragment(frag.id, 'collection', e.target.value || null)}
                  className="fragment-select"
                >
                  <option value="">Aucune</option>
                  {factions.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </label>
              <label className="faction-bonus-input">
                <span>Bonus</span>
                <select
                  value={frag.bonus_type ?? ''}
                  onChange={e => updateFragment(frag.id, 'bonus_type', e.target.value || null)}
                  className="fragment-select"
                >
                  {BONUS_TYPES.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </label>
              {frag.bonus_type && (
                <label className="faction-bonus-input">
                  <span>Valeur</span>
                  <input
                    type="number"
                    step={0.5}
                    value={frag.bonus_value}
                    onChange={e => updateFragment(frag.id, 'bonus_value', parseFloat(e.target.value) || 0)}
                  />
                </label>
              )}
            </div>

            {/* Termes */}
            <div className="faction-field" style={{ marginTop: 8 }}>
              <label className="faction-field-label">Termes debloques</label>
              {frag.words.length === 0 && (
                <p style={{ fontSize: '0.75rem', opacity: 0.4, margin: '4px 0' }}>Aucun terme</p>
              )}
              {frag.words.map(w => (
                <div key={w.id} className="fragment-word-row">
                  <input
                    type="text"
                    value={w.word}
                    onChange={e => updateWord(frag.id, w.id, 'word', e.target.value)}
                    onBlur={e => saveWordOnBlur(w.id, 'word', e.target.value)}
                    placeholder="terme..."
                    className="fragment-word-input"
                  />
                  <button
                    className="fragment-word-delete"
                    onClick={() => deleteWord(frag.id, w.id)}
                  >
                    &#10005;
                  </button>
                </div>
              ))}
              <button className="fragment-add-word-btn" onClick={() => addWord(frag.id, 'nom')}>+ Ajouter un terme</button>
            </div>

            {/* Joueurs possedant ce fragment */}
            {owners[frag.id] && owners[frag.id].length > 0 && (
              <div className="fragment-owners">
                <label className="faction-field-label">Possede par</label>
                <div className="fragment-owners-list">
                  {owners[frag.id].map(o => (
                    <span key={o.userId} className="fragment-owner-tag">
                      {o.name}
                      <button
                        className="fragment-owner-revoke"
                        onClick={async () => {
                          if (!window.confirm(`Revoquer le fragment pour ${o.name} ?`)) return
                          const { error } = await supabase.from('user_fragments').delete().eq('user_id', o.userId).eq('fragment_id', frag.id)
                          if (!error) {
                            setOwners(prev => ({
                              ...prev,
                              [frag.id]: (prev[frag.id] ?? []).filter(p => p.userId !== o.userId),
                            }))
                          }
                        }}
                        title="Revoquer"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="fragment-grant-btn"
                onClick={() => setGrantFragmentId(grantFragmentId === frag.id ? null : frag.id)}
              >
                Attribuer a un joueur
              </button>
              <label className="fragment-visible-toggle">
                <input type="checkbox" checked={frag.visible} onChange={() => updateFragment(frag.id, 'visible', !frag.visible)} />
                <span>Visible en jeu</span>
              </label>
              <button className="faction-delete-btn" onClick={() => handleDelete(frag.id)}>
                Supprimer
              </button>
            </div>

            {/* Panel attribution */}
            {grantFragmentId === frag.id && (
              <div className="fragment-grant-panel">
                <input
                  type="text"
                  placeholder="Chercher un joueur (nom ou email)..."
                  value={grantSearch}
                  onChange={e => searchPlayers(e.target.value)}
                  className="faction-create-input"
                  autoFocus
                />
                {grantResults.map(p => (
                  <button
                    key={p.id}
                    className="fragment-grant-result"
                    onClick={() => grantFragment(p.id)}
                    disabled={granting}
                  >
                    <strong>{p.first_name || '?'}</strong>
                    <span style={{ opacity: 0.5, marginLeft: 8 }}>{p.email_address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <SaveBar hasChanges={hasChanges} saving={saving} error={saveError} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}
