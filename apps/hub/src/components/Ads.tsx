import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface AdScreen {
  id: number
  image_url: string
  product_url: string | null
  title: string | null
  active: boolean
}

interface AdTip {
  id: number
  title: string
  subtitle: string | null
  tag: 'astuce' | 'anecdote'
  active: boolean
}

export function Ads() {
  const [screens, setScreens] = useState<AdScreen[]>([])
  const [savedScreens, setSavedScreens] = useState<AdScreen[]>([])
  const [tips, setTips] = useState<AdTip[]>([])
  const [savedTips, setSavedTips] = useState<AdTip[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duration, setDuration] = useState('5')

  // Screens
  const [uploadingScreen, setUploadingScreen] = useState(false)
  const screenInputRef = useRef<HTMLInputElement>(null)

  // Tips
  const [newTitle, setNewTitle] = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [creatingTip, setCreatingTip] = useState(false)
  const [editingTip, setEditingTip] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSubtitle, setEditSubtitle] = useState('')

  const hasChanges = JSON.stringify(screens) !== JSON.stringify(savedScreens) ||
    JSON.stringify(tips) !== JSON.stringify(savedTips)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const [screensRes, tipsRes, durationRes] = await Promise.all([
        supabase.from('ad_screens').select('*').order('created_at', { ascending: false }),
        supabase.from('ad_tips').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'ad_screen_duration').single(),
      ])
      if (screensRes.data) {
        setScreens(screensRes.data as AdScreen[])
        setSavedScreens(screensRes.data as AdScreen[])
      }
      if (tipsRes.data) {
        setTips(tipsRes.data as AdTip[])
        setSavedTips(tipsRes.data as AdTip[])
      }
      if (durationRes.data) setDuration(durationRes.data.value)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }

  // --- Sauvegarder tout ---

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const promises = []

      // Screens modifies
      for (const s of screens) {
        const saved = savedScreens.find(ss => ss.id === s.id)
        if (!saved || JSON.stringify(s) === JSON.stringify(saved)) continue
        promises.push(supabase.from('ad_screens').update({
          title: s.title,
          product_url: s.product_url,
          active: s.active,
        }).eq('id', s.id).then(() => {}))
      }

      // Tips modifies
      for (const t of tips) {
        const saved = savedTips.find(st => st.id === t.id)
        if (!saved || JSON.stringify(t) === JSON.stringify(saved)) continue
        promises.push(supabase.from('ad_tips').update({
          title: t.title,
          subtitle: t.subtitle,
          active: t.active,
        }).eq('id', t.id).then(() => {}))
      }

      await Promise.all(promises)
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setScreens(JSON.parse(JSON.stringify(savedScreens)))
    setTips(JSON.parse(JSON.stringify(savedTips)))
    setSaveError(null)
    setEditingTip(null)
  }

  // --- Duration ---

  async function saveDuration(value: string) {
    setDuration(value)
    await supabase.from('app_settings').update({ value }).eq('key', 'ad_screen_duration')
  }

  // --- Screens ---

  async function handleScreenUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingScreen(true)

    const path = `screen-${Date.now()}.${file.name.split('.').pop() || 'webp'}`
    const { error: uploadErr } = await supabase.storage
      .from('app-ads')
      .upload(path, file, { contentType: file.type })

    if (uploadErr) {
      alert(`Erreur upload: ${uploadErr.message}`)
      setUploadingScreen(false)
      return
    }

    const { data: urlData } = supabase.storage.from('app-ads').getPublicUrl(path)
    const imageUrl = urlData.publicUrl

    const { data, error } = await supabase.from('ad_screens')
      .insert({ image_url: imageUrl })
      .select()
      .single()

    if (!error && data) {
      const newScreen = data as AdScreen
      setScreens(prev => [newScreen, ...prev])
      setSavedScreens(prev => [newScreen, ...prev])
    }
    setUploadingScreen(false)
  }

  function updateScreen(id: number, field: string, value: string | boolean | null) {
    setScreens(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function deleteScreen(id: number) {
    if (!window.confirm('Supprimer cet ecran ?')) return
    const screen = screens.find(s => s.id === id)
    if (screen) {
      const urlParts = screen.image_url.split('/')
      const fileName = urlParts[urlParts.length - 1].split('?')[0]
      await supabase.storage.from('app-ads').remove([fileName])
    }
    const { error } = await supabase.from('ad_screens').delete().eq('id', id)
    if (!error) {
      setScreens(prev => prev.filter(s => s.id !== id))
      setSavedScreens(prev => prev.filter(s => s.id !== id))
    }
  }

  // --- Tips ---

  async function createTip() {
    const title = newTitle.trim()
    if (!title) return
    setCreatingTip(true)

    try {
      const { data, error } = await supabase.from('ad_tips')
        .insert({ title, subtitle: newSubtitle.trim() || null, tag: 'astuce' })
        .select()
        .single()

      if (error) {
        alert(`Erreur: ${error.message}`)
      } else if (data) {
        const newTip = data as AdTip
        setTips(prev => [newTip, ...prev])
        setSavedTips(prev => [newTip, ...prev])
        setNewTitle('')
        setNewSubtitle('')
      }
    } catch {
    }
    setCreatingTip(false)
  }

  function updateTip(id: number, field: string, value: string | boolean | null) {
    setTips(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  function startEditTip(tip: AdTip) {
    setEditingTip(tip.id)
    setEditTitle(tip.title)
    setEditSubtitle(tip.subtitle ?? '')
  }

  function confirmEditTip(id: number) {
    updateTip(id, 'title', editTitle.trim())
    updateTip(id, 'subtitle', editSubtitle.trim() || null)
    setEditingTip(null)
  }

  async function deleteTip(id: number) {
    if (!window.confirm('Supprimer cette astuce ?')) return
    const { error } = await supabase.from('ad_tips').delete().eq('id', id)
    if (!error) {
      setTips(prev => prev.filter(t => t.id !== id))
      setSavedTips(prev => prev.filter(t => t.id !== id))
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Publicites</h1>
        <div className="page-header-actions">
          <label className="pub-duration-label">
            Duree (s)
            <input
              type="number"
              min={3}
              max={15}
              value={duration}
              onChange={e => saveDuration(e.target.value)}
              className="pub-duration-input"
            />
          </label>
        </div>
      </div>

      {/* ====== ECRANS ====== */}
      <div className="pub-section">
        <div className="pub-section-header">
          <h2>Ecrans ({screens.filter(s => s.active).length} actifs / {screens.length})</h2>
          <button
            className="faction-create-btn"
            onClick={() => screenInputRef.current?.click()}
            disabled={uploadingScreen}
          >
            {uploadingScreen ? 'Upload...' : '+ Ajouter une image'}
          </button>
          <input ref={screenInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScreenUpload} />
        </div>

        <div className="pub-screens-grid">
          {screens.map(s => (
            <div key={s.id} className={`pub-screen-card${s.active ? '' : ' inactive'}`}>
              <img src={s.image_url} alt="" className="pub-screen-img" />
              <div className="pub-screen-fields">
                <input
                  type="text"
                  placeholder="Titre produit (ex: Esprit du Hibou)"
                  value={s.title ?? ''}
                  onChange={e => updateScreen(s.id, 'title', e.target.value || null)}
                  className="pub-screen-field-input"
                />
                <input
                  type="text"
                  placeholder="Lien produit (URL)"
                  value={s.product_url ?? ''}
                  onChange={e => updateScreen(s.id, 'product_url', e.target.value || null)}
                  className="pub-screen-field-input"
                />
                <div className="pub-screen-actions">
                  <button
                    className={`pub-toggle-btn${s.active ? ' active' : ''}`}
                    onClick={() => updateScreen(s.id, 'active', !s.active)}
                  >
                    {s.active ? 'Actif' : 'Inactif'}
                  </button>
                  <button className="pub-delete-btn" onClick={() => deleteScreen(s.id)}>&#10005;</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ====== ASTUCES ====== */}
      <div className="pub-section">
        <div className="pub-section-header">
          <h2>Le Saviez-vous ? ({tips.filter(t => t.active).length} actives / {tips.length})</h2>
        </div>

        <div className="pub-tip-create">
          <input
            type="text"
            placeholder="Titre"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="pub-tip-create-title"
          />
          <input
            type="text"
            placeholder="Sous-titre (optionnel)"
            value={newSubtitle}
            onChange={e => setNewSubtitle(e.target.value)}
            className="pub-tip-create-subtitle"
            onKeyDown={e => e.key === 'Enter' && createTip()}
          />
          <button
            className="faction-create-btn"
            onClick={createTip}
            disabled={creatingTip || !newTitle.trim()}
          >
            {creatingTip ? '...' : '+ Ajouter'}
          </button>
        </div>

        <div className="pub-tips-list">
          {tips.map(tip => (
            <div key={tip.id} className={`pub-tip-row${tip.active ? '' : ' inactive'}`}>
              {editingTip === tip.id ? (
                <div className="pub-tip-edit">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="pub-tip-edit-input"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={e => setEditSubtitle(e.target.value)}
                    className="pub-tip-edit-input"
                    placeholder="Sous-titre..."
                    onKeyDown={e => e.key === 'Enter' && confirmEditTip(tip.id)}
                  />
                  <div className="pub-tip-edit-actions">
                    <button className="pub-tip-save-btn" onClick={() => confirmEditTip(tip.id)}>OK</button>
                    <button className="pub-tip-cancel-btn" onClick={() => setEditingTip(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pub-tip-content" onClick={() => startEditTip(tip)}>
                    <span className="pub-tip-tag">Le Saviez-vous ?</span>
                    <span className="pub-tip-title">{tip.title}</span>
                    {tip.subtitle && <span className="pub-tip-subtitle">{tip.subtitle}</span>}
                  </div>
                  <div className="pub-tip-actions">
                    <button
                      className={`pub-toggle-btn${tip.active ? ' active' : ''}`}
                      onClick={() => updateTip(tip.id, 'active', !tip.active)}
                    >
                      {tip.active ? 'Actif' : 'Inactif'}
                    </button>
                    <button className="pub-delete-btn" onClick={() => deleteTip(tip.id)}>&#10005;</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {tips.length === 0 && <p className="pub-empty">Aucune astuce. Ajoutez-en pour qu'elles apparaissent au chargement.</p>}
        </div>
      </div>

      <SaveBar hasChanges={hasChanges} saving={saving} error={saveError} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}
