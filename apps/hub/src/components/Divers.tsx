import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Divers() {
  const [unknownIcon, setUnknownIcon] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['unknown_place_icon'])

    if (data) {
      for (const row of data) {
        if (row.key === 'unknown_place_icon') setUnknownIcon(row.value)
      }
    }
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    // Supprimer TOUS les anciens fichiers unknown-place-icon.*
    const { data: existing } = await supabase.storage.from('app-assets').list('', {
      search: 'unknown-place-icon',
    })
    if (existing && existing.length > 0) {
      await supabase.storage.from('app-assets').remove(existing.map(f => f.name))
    }

    // Upload avec un timestamp pour casser le cache
    const ext = file.name.split('.').pop()
    const path = `unknown-place-icon-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('app-assets')
      .upload(path, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(false)
      return
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('app-assets')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    // Sauvegarder dans app_settings
    await supabase
      .from('app_settings')
      .upsert({ key: 'unknown_place_icon', value: publicUrl, updated_at: new Date().toISOString() })

    setUnknownIcon(publicUrl)
    setUploading(false)

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRemove() {
    await supabase
      .from('app_settings')
      .upsert({ key: 'unknown_place_icon', value: '', updated_at: new Date().toISOString() })

    setUnknownIcon('')
  }

  if (loading) {
    return <div className="section"><p>Chargement...</p></div>
  }

  return (
    <div className="section">
      <h1>Divers</h1>

      <div className="divers-card">
        <h3>Icone des lieux non decouverts</h3>
        <p className="divers-description">
          Image affichee sur la carte pour les lieux que l'utilisateur n'a pas encore explores.
        </p>

        {unknownIcon && (
          <div className="divers-preview">
            <img src={unknownIcon} alt="Icone lieu inconnu" />
          </div>
        )}

        <div className="divers-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Upload...' : unknownIcon ? 'Changer l\'image' : 'Uploader une image'}
          </button>
          {unknownIcon && (
            <button className="btn-danger" onClick={handleRemove}>
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
