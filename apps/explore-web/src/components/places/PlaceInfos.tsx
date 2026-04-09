import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useCalendarRef } from '../../hooks/useCalendarRef'
import { formatYear } from '../../lib/calendarUtils'
import { EraSelector } from './EraSelector'
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
  eraId: string | null
  eraName: string | null
  yearExact: number | null
  onRefresh: () => void
}

const INFO_CONFIG = {
  accessibility: { icon: '♿', label: 'Accessibilité', placeholder: 'Facile / Modéré / Difficile + détails...' },
  season: { icon: '🌿', label: 'Saison idéale', placeholder: 'Printemps, été, toute l\'année...' },
  warning: { icon: '⚠️', label: 'Information importante', placeholder: 'Danger, propriété privée, horaires...' },
} as const

export function PlaceInfos({ placeId, infos, eraId, eraName, yearExact, onRefresh }: PlaceInfosProps) {
  const userId = usePlayerStore(s => s.userId)
  const { calendarRef } = useCalendarRef()
  const [editingEra, setEditingEra] = useState(false)
  const [newEraId, setNewEraId] = useState<string | null>(null)
  const [newYearExact, setNewYearExact] = useState<number | null>(null)
  const [savingEra, setSavingEra] = useState(false)

  async function saveEra() {
    if (!newEraId || savingEra) return
    setSavingEra(true)
    const { error } = await supabase
      .from('places')
      .update({ era_id: newEraId, year_exact: newYearExact })
      .eq('id', placeId)
    if (!error) {
      setEditingEra(false)
      onRefresh()
    }
    setSavingEra(false)
  }

  return (
    <div className="place-infos">
      {/* Ligne Époque */}
      <div className="info-row">
        <div className="info-row-header">
          <span className="info-icon">🏛️</span>
          <span className="info-label">Époque</span>
          {!eraId && userId && !editingEra && (
            <button className="info-edit-btn" onClick={() => setEditingEra(true)}>
              Ajouter
            </button>
          )}
        </div>

        {editingEra ? (
          <div className="info-edit">
            <EraSelector
              eraId={newEraId}
              yearExact={newYearExact}
              onChange={(era, year) => { setNewEraId(era); setNewYearExact(year) }}
            />
            <div className="info-edit-actions">
              <button className="info-save-btn" onClick={saveEra} disabled={savingEra || !newEraId}>
                {savingEra ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button className="info-cancel-btn" onClick={() => setEditingEra(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : eraId && eraName ? (
          <div className="info-content">
            <p>
              {eraName}
              {yearExact !== null && (
                <span className="era-date-display"> — {formatYear(yearExact, calendarRef)}</span>
              )}
            </p>
          </div>
        ) : (
          <p className="info-empty">Aucune époque renseignée</p>
        )}
      </div>

      {/* InfoRows existants */}
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
