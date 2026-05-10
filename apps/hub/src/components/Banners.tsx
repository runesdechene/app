import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface HomeBanner {
  id: number
  image_url: string
  title: string
  subtitle: string | null
  link_url: string
  active: boolean
}

export function Banners() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [savedBanners, setSavedBanners] = useState<HomeBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasChanges = JSON.stringify(banners) !== JSON.stringify(savedBanners)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = (data ?? []) as HomeBanner[]
      setBanners(JSON.parse(JSON.stringify(list)))
      setSavedBanners(JSON.parse(JSON.stringify(list)))
    } catch (err) {
      console.error('[Banners] fetchAll failed', err)
      setSaveError(err instanceof Error ? err.message : `${err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)

    const ext = file.name.split('.').pop() || 'webp'
    const path = `banner-${Date.now()}.${ext}`

    try {
      const { error: upErr } = await supabase.storage
        .from('home-banners')
        .upload(path, file, { contentType: file.type })
      if (upErr) {
        alert(`Erreur upload: ${upErr.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from('home-banners').getPublicUrl(path)
      const imageUrl = urlData.publicUrl

      const { data, error } = await supabase
        .from('home_banners')
        .insert({ image_url: imageUrl, title: '', link_url: '' })
        .select()
        .single()

      if (error || !data) {
        console.error('[Banners] insert failed', error)
        alert(`Erreur création bannière : ${error?.message ?? 'aucune ligne retournée'}`)
        // Cleanup du fichier orphelin pour pas encrasser le bucket
        await supabase.storage.from('home-banners').remove([path])
        return
      }

      const newRow = data as HomeBanner
      setBanners(prev => [newRow, ...prev])
      setSavedBanners(prev => [JSON.parse(JSON.stringify(newRow)), ...prev])
    } catch (err) {
      console.error('[Banners] upload threw', err)
      alert(`Erreur upload: ${err instanceof Error ? err.message : err}`)
    } finally {
      setUploading(false)
    }
  }

  function update(id: number, field: keyof HomeBanner, value: string | boolean | null) {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      for (const b of banners) {
        const saved = savedBanners.find(s => s.id === b.id)
        if (!saved || JSON.stringify(b) === JSON.stringify(saved)) continue
        const { error } = await supabase.from('home_banners').update({
          title: b.title,
          subtitle: b.subtitle,
          link_url: b.link_url,
          active: b.active,
        }).eq('id', b.id)
        if (error) {
          setSaveError(error.message)
          return
        }
      }
      await fetchAll()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : `${err}`)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setBanners(JSON.parse(JSON.stringify(savedBanners)))
    setSaveError(null)
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer cette bannière ?')) return
    try {
      const banner = banners.find(b => b.id === id)
      if (banner) {
        const fileName = banner.image_url.split('/').pop()?.split('?')[0]
        if (fileName) {
          await supabase.storage.from('home-banners').remove([fileName])
        }
      }
      const { error } = await supabase.from('home_banners').delete().eq('id', id)
      if (error) {
        alert(`Erreur suppression: ${error.message}`)
        return
      }
      setBanners(prev => prev.filter(b => b.id !== id))
      setSavedBanners(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.error('[Banners] delete threw', err)
      alert(`Erreur suppression: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  const activeCount = banners.filter(b => b.active).length

  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Bannières Collection</h1>
        <button
          className="faction-create-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Upload...' : '+ Ajouter une bannière'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      <p style={{ color: '#666', marginBottom: 16 }}>
        {activeCount} active{activeCount > 1 ? 's' : ''} / {banners.length} total — rotation aléatoire sur la home explore-web.
      </p>

      <div className="pub-screens-grid">
        {banners.map(b => (
          <div key={b.id} className={`pub-screen-card${b.active ? '' : ' inactive'}`}>
            <img src={b.image_url} alt="" className="pub-screen-img" />
            <div className="pub-screen-fields">
              <input
                type="text"
                placeholder="Titre (ex: Collection Equinoxe)"
                value={b.title}
                onChange={e => update(b.id, 'title', e.target.value)}
                className="pub-screen-field-input"
              />
              <input
                type="text"
                placeholder="Sous-titre (optionnel)"
                value={b.subtitle ?? ''}
                onChange={e => update(b.id, 'subtitle', e.target.value || null)}
                className="pub-screen-field-input"
              />
              <input
                type="text"
                placeholder="Lien collection (URL)"
                value={b.link_url}
                onChange={e => update(b.id, 'link_url', e.target.value)}
                className="pub-screen-field-input"
              />
              <div className="pub-screen-actions">
                <button
                  className={`pub-toggle-btn${b.active ? ' active' : ''}`}
                  onClick={() => update(b.id, 'active', !b.active)}
                >
                  {b.active ? 'Active' : 'Inactive'}
                </button>
                <button className="pub-delete-btn" onClick={() => handleDelete(b.id)}>&#10005;</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <p style={{ color: '#666', marginTop: 24 }}>
          Aucune bannière. Clique "+ Ajouter une bannière" pour démarrer.
        </p>
      )}

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
