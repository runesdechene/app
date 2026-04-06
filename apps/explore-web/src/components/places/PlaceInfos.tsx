import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './PlaceInfos.css'

interface InfoField {
  type: 'accessibility' | 'season' | 'warning'
  content: string | null
  userName: string | null
  updatedAt: string | null
}

interface PlaceInfosProps {
  placeId: string
  infos: InfoField[]
  onRefresh: () => void
}

const INFO_CONFIG = {
  accessibility: { icon: '♿', label: 'Accessibilité', placeholder: 'Facile / Modéré / Difficile + détails...' },
  season: { icon: '🌿', label: 'Saison idéale', placeholder: 'Printemps, été, toute l\'année...' },
  warning: { icon: '⚠️', label: 'Information importante', placeholder: 'Danger, propriété privée, horaires...' },
} as const

export function PlaceInfos({ placeId, infos, onRefresh }: PlaceInfosProps) {
  const userId = usePlayerStore(s => s.userId)

  return (
    <div className="place-infos">
      {(['accessibility', 'season', 'warning'] as const).map(type => {
        const config = INFO_CONFIG[type]
        const existing = infos.find(i => i.type === type)
        return (
          <InfoRow
            key={type}
            placeId={placeId}
            type={type}
            icon={config.icon}
            label={config.label}
            placeholder={config.placeholder}
            content={existing?.content ?? null}
            userName={existing?.userName ?? null}
            updatedAt={existing?.updatedAt ?? null}
            canEdit={!!userId}
            onSaved={onRefresh}
          />
        )
      })}
    </div>
  )
}

function InfoRow({ placeId, type, icon, label, placeholder, content, userName, updatedAt, canEdit, onSaved }: {
  placeId: string
  type: string
  icon: string
  label: string
  placeholder: string
  content: string | null
  userName: string | null
  updatedAt: string | null
  canEdit: boolean
  onSaved: () => void
}) {
  const userId = usePlayerStore(s => s.userId)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!userId || !value.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.rpc('contribute_to_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_type: type,
      p_content: value.trim(),
    })
    if (!error) {
      setEditing(false)
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="info-row">
      <div className="info-row-header">
        <span className="info-icon">{icon}</span>
        <span className="info-label">{label}</span>
        {canEdit && !editing && (
          <button className="info-edit-btn" onClick={() => setEditing(true)}>
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="info-edit">
          <textarea
            className="info-textarea"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            rows={2}
          />
          <div className="info-edit-actions">
            <button className="info-save-btn" onClick={save} disabled={saving || !value.trim()}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button className="info-cancel-btn" onClick={() => { setEditing(false); setValue(content ?? '') }}>
              Annuler
            </button>
          </div>
        </div>
      ) : content ? (
        <div className="info-content">
          <p>{content}</p>
          {userName && updatedAt && (
            <span className="info-meta">Modifié par {userName} · {getTimeAgo(updatedAt)}</span>
          )}
        </div>
      ) : (
        <p className="info-empty">Aucune information renseignée</p>
      )}
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days}j`
  return `il y a ${Math.floor(days / 7)} sem.`
}
