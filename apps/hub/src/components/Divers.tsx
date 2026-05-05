import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface BasculeRow {
  id: number
  place_id: string | null
  actor_id: string | null
  data: {
    placeTitle?: string
    actorName?: string
    oldExpeditionId?: string
    newExpeditionId?: string
  } | null
  created_at: string
}

export function Divers() {
  const [unknownIcon, setUnknownIcon] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [bascules, setBascules] = useState<BasculeRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSettings()
    fetchBascules()
  }, [])

  async function fetchBascules() {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data } = await supabase
      .from('activity_log')
      .select('id, place_id, actor_id, data, created_at')
      .eq('type', 'place_taken_remote')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)
    setBascules((data ?? []) as BasculeRow[])
  }

  async function fetchSettings() {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['unknown_place_icon'])

      if (data) {
        for (const row of data) {
          if (row.key === 'unknown_place_icon') setUnknownIcon(row.value)
        }
      }
    } finally {
      setLoading(false)
    }
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

      <div className="divers-card">
        <h3>La Cour — Bascules récentes (V0.7 phase 5)</h3>
        <p className="divers-description">
          Lieux qui ont basculé par influence dans les 30 derniers jours. Pour suivre l'usage
          du système et détecter d'éventuels abus.
        </p>
        {bascules.length === 0 ? (
          <p style={{ opacity: 0.7, fontStyle: 'italic' }}>Aucune bascule récente.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.15)' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Lieu</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Auteur</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Ancienne expé</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Nouvelle expé</th>
              </tr>
            </thead>
            <tbody>
              {bascules.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '6px 4px' }}>{new Date(b.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '6px 4px' }}>{b.data?.placeTitle ?? b.place_id ?? '—'}</td>
                  <td style={{ padding: '6px 4px' }}>{b.data?.actorName ?? b.actor_id ?? '—'}</td>
                  <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: 12 }}>{b.data?.oldExpeditionId?.slice(0, 8) ?? '—'}</td>
                  <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: 12 }}>{b.data?.newExpeditionId?.slice(0, 8) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
