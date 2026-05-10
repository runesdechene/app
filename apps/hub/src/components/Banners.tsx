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
  overlay_color: string
  overlay_opacity: number
  tag_color: string
  title_color: string
  subtitle_color: string
}

/** Construit le gradient overlay à partir d'une couleur hex + opacity max.
 *  Doit rester aligné sur buildOverlayGradient() de explore-web/HomeBannerCard.tsx. */
function buildOverlayGradient(hexColor: string, opacity: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16) || 0
  const g = parseInt(hexColor.slice(3, 5), 16) || 0
  const b = parseInt(hexColor.slice(5, 7), 16) || 0
  const op = Math.max(0, Math.min(1, opacity))
  const left = op
  const mid = op * (0.5 / 0.85)
  const right = op * (0.2 / 0.85)
  return `linear-gradient(90deg, rgba(${r},${g},${b},${left}) 0%, rgba(${r},${g},${b},${mid}) 60%, rgba(${r},${g},${b},${right}) 100%)`
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

  function update(id: number, field: keyof HomeBanner, value: string | boolean | number | null) {
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
          overlay_color: b.overlay_color,
          overlay_opacity: b.overlay_opacity,
          tag_color: b.tag_color,
          title_color: b.title_color,
          subtitle_color: b.subtitle_color,
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

              {/* === Apparence === */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #ccc' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Apparence
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 10px', alignItems: 'center', fontSize: 13 }}>
                  <label htmlFor={`overlay-color-${b.id}`}>Overlay</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      id={`overlay-color-${b.id}`}
                      type="color"
                      value={b.overlay_color}
                      onChange={e => update(b.id, 'overlay_color', e.target.value)}
                      style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', cursor: 'pointer' }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={b.overlay_opacity}
                      onChange={e => update(b.id, 'overlay_opacity', Number(e.target.value))}
                      style={{ flex: 1 }}
                      title={`Opacity: ${b.overlay_opacity.toFixed(2)}`}
                    />
                    <span style={{ fontSize: 11, color: '#666', width: 32, textAlign: 'right' }}>
                      {b.overlay_opacity.toFixed(2)}
                    </span>
                  </div>

                  <label htmlFor={`tag-color-${b.id}`}>Tag</label>
                  <input
                    id={`tag-color-${b.id}`}
                    type="color"
                    value={b.tag_color}
                    onChange={e => update(b.id, 'tag_color', e.target.value)}
                    style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', cursor: 'pointer', justifySelf: 'start' }}
                  />

                  <label htmlFor={`title-color-${b.id}`}>Titre</label>
                  <input
                    id={`title-color-${b.id}`}
                    type="color"
                    value={b.title_color}
                    onChange={e => update(b.id, 'title_color', e.target.value)}
                    style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', cursor: 'pointer', justifySelf: 'start' }}
                  />

                  <label htmlFor={`sub-color-${b.id}`}>Sous-titre</label>
                  <input
                    id={`sub-color-${b.id}`}
                    type="color"
                    value={b.subtitle_color}
                    onChange={e => update(b.id, 'subtitle_color', e.target.value)}
                    style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', cursor: 'pointer', justifySelf: 'start' }}
                  />
                </div>
              </div>

              {/* === Aperçu live === */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #ccc' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Aperçu sur la home
                </div>
                <div style={{
                  width: '100%',
                  height: 110,
                  position: 'relative',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid #ddd',
                  boxShadow: '0 4px 14px rgba(74,55,40,0.18)',
                }}>
                  <img
                    src={b.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: buildOverlayGradient(b.overlay_color, b.overlay_opacity),
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    padding: '18px 20px', gap: 4, textAlign: 'left',
                  }}>
                    <span style={{
                      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em',
                      color: b.tag_color, fontWeight: 700,
                      fontFamily: "'Cabin Condensed', sans-serif",
                      textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                    }}>Boutique</span>
                    <span style={{
                      fontSize: 20, color: b.title_color,
                      fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase',
                      lineHeight: 1.15,
                      fontFamily: "'Bebas Neue', sans-serif",
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    }}>{b.title || '(titre vide)'}</span>
                    {b.subtitle && (
                      <span style={{
                        fontSize: 13, color: b.subtitle_color, lineHeight: 1.3,
                        fontStyle: 'italic',
                        fontFamily: "'Alegreya', 'Cabin', serif",
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      }}>{b.subtitle}</span>
                    )}
                  </div>
                </div>
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
