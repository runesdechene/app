import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type LandingKey = 'landing_image_desktop_url' | 'landing_image_mobile_url' | 'landing_frame_url' | 'landing_logo_url'

interface ImageSlot {
  key: LandingKey
  storagePrefix: string
  title: string
  description: string
}

const SLOTS: ImageSlot[] = [
  {
    key: 'landing_logo_url',
    storagePrefix: 'landing-logo',
    title: 'Logo (au-dessus du titre)',
    description: 'Logo affiché en haut du contenu textuel, au-dessus de « BIENVENUE DANS ». Format PNG transparent recommandé.',
  },
  {
    key: 'landing_image_desktop_url',
    storagePrefix: 'landing-image-desktop',
    title: 'Image de fond — Desktop (paysage)',
    description: 'Image principale affichée sur la page d\'accueil de l\'application en mode desktop. Format paysage recommandé (16:10 ou plus large).',
  },
  {
    key: 'landing_image_mobile_url',
    storagePrefix: 'landing-image-mobile',
    title: 'Image de fond — Mobile (portrait)',
    description: 'Image affichée sur la page d\'accueil en mode mobile. Format portrait recommandé.',
  },
  {
    key: 'landing_frame_url',
    storagePrefix: 'landing-frame',
    title: 'Frame parchemin (PNG transparent)',
    description: 'PNG superposé à l\'image de fond, avec zones transparentes pour révéler la photo. Effet "fenêtre dans le parchemin".',
  },
]

export function LandingConfig() {
  const [urls, setUrls] = useState<Record<LandingKey, string>>({
    landing_image_desktop_url: '',
    landing_image_mobile_url: '',
    landing_frame_url: '',
    landing_logo_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<LandingKey | null>(null)
  const fileInputRefs = useRef<Record<LandingKey, HTMLInputElement | null>>({
    landing_image_desktop_url: null,
    landing_image_mobile_url: null,
    landing_frame_url: null,
    landing_logo_url: null,
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', SLOTS.map(s => s.key))

      if (data) {
        const next: Record<LandingKey, string> = {
          landing_image_desktop_url: '',
          landing_image_mobile_url: '',
          landing_frame_url: '',
          landing_logo_url: '',
        }
        for (const row of data) {
          if (row.key in next) {
            next[row.key as LandingKey] = row.value ?? ''
          }
        }
        setUrls(next)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(slot: ImageSlot, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(slot.key)

    // Supprimer les anciens fichiers de ce slot
    const { data: existing } = await supabase.storage.from('app-assets').list('', {
      search: slot.storagePrefix,
    })
    if (existing && existing.length > 0) {
      await supabase.storage
        .from('app-assets')
        .remove(existing.filter(f => f.name.startsWith(slot.storagePrefix)).map(f => f.name))
    }

    // Upload avec timestamp pour casser le cache
    const ext = file.name.split('.').pop()
    const path = `${slot.storagePrefix}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('app-assets')
      .upload(path, file)

    if (uploadError) {
      setUploading(null)
      return
    }

    // URL publique
    const { data: urlData } = supabase.storage
      .from('app-assets')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    // Sauvegarder dans app_settings
    await supabase
      .from('app_settings')
      .upsert({ key: slot.key, value: publicUrl, updated_at: new Date().toISOString() })

    setUrls(prev => ({ ...prev, [slot.key]: publicUrl }))
    setUploading(null)

    // Reset input
    const input = fileInputRefs.current[slot.key]
    if (input) input.value = ''
  }

  async function handleRemove(slot: ImageSlot) {
    await supabase
      .from('app_settings')
      .upsert({ key: slot.key, value: '', updated_at: new Date().toISOString() })

    setUrls(prev => ({ ...prev, [slot.key]: '' }))
  }

  if (loading) {
    return <div className="section"><p>Chargement...</p></div>
  }

  return (
    <div className="section">
      <h1>Page d'accueil de l'application</h1>
      <p style={{ marginBottom: '24px', opacity: 0.8 }}>
        Configure les 3 images affichées sur la page d'accueil de l'application web (app.runesdechene.com).
        Les changements sont visibles immédiatement après upload.
      </p>

      {SLOTS.map(slot => {
        const url = urls[slot.key]
        const isUploading = uploading === slot.key
        return (
          <div key={slot.key} className="divers-card" style={{ marginBottom: '24px' }}>
            <h3>{slot.title}</h3>
            <p className="divers-description">{slot.description}</p>

            {url && (
              <div className="divers-preview">
                <img src={url} alt={slot.title} />
              </div>
            )}

            <div className="divers-actions">
              <input
                ref={el => { fileInputRefs.current[slot.key] = el }}
                type="file"
                accept="image/*"
                onChange={e => handleUpload(slot, e)}
                style={{ display: 'none' }}
              />
              <button
                className="btn-primary"
                onClick={() => fileInputRefs.current[slot.key]?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Upload...' : url ? 'Changer l\'image' : 'Uploader une image'}
              </button>
              {url && (
                <button className="btn-danger" onClick={() => handleRemove(slot)}>
                  Supprimer
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
