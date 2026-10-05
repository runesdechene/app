import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCalendarRef } from '../../../hooks/useCalendarRef'
import { formatYear } from '../../../lib/calendarUtils'
import { EraSelector } from '../modals/EraSelector'
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
  accessibility: { icon: '♿', label: 'Accessibilité' },
  season: { icon: '🌿', label: 'Saison idéale' },
  warning: { icon: '⚠️', label: 'Information importante' },
} as const

export function PlaceInfos({ placeId, infos, eraId, eraName, yearExact, onRefresh }: PlaceInfosProps) {
  const userId = usePlayerStore(s => s.userId)
  const { calendarRef } = useCalendarRef()
  const [editingEra, setEditingEra] = useState(false)
  const [newEraId, setNewEraId] = useState<string | null>(null)
  const [newYearExact, setNewYearExact] = useState<number | null>(null)
  const [savingEra, setSavingEra] = useState(false)

  async function saveEra() {
    if (!newEraId || savingEra || !userId) return
    if (!window.confirm('Cette information est importante pour le patrimoine et les futurs visiteurs. Confirmez-vous qu\'elle est fiable ?')) return
    setSavingEra(true)
    const { data, error } = await supabase.rpc('contribute_to_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_type: 'epoch',
      p_content: null,
      p_image_url: null,
      p_era_id: newEraId,
      p_year_exact: newYearExact,
    })
    if (!error && data?.success) {
      setEditingEra(false)
      // V067 — décision Uriel 2026-05-03 : ces contributions (epoch /
      // accessibility / season / warning) sont des INFOS communautaires
      // qui n'attribuent PAS de points (ni en DB ni en UI).
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
        ) : eraId && eraId !== 'unknown' && eraName ? (
          <div className="info-content">
            <p>
              {eraName}
              {yearExact !== null && (
                <span className="era-date-display"> — {formatYear(yearExact, calendarRef)}</span>
              )}
            </p>
          </div>
        ) : userId ? (
          <button className="info-empty-action" onClick={() => setEditingEra(true)}>
            Ajouter une époque
          </button>
        ) : (
          <p className="info-empty">Aucune époque renseignée</p>
        )}
      </div>

      {/* InfoRows existants — en lecture seule depuis le 05/10/2026 : on les enrichit dans la V2. */}
      {(['accessibility', 'season', 'warning'] as const).map(type => {
        const config = INFO_CONFIG[type]
        const existing = infos.find(i => i.type === type)
        return (
          <InfoRow
            key={type}
            icon={config.icon}
            label={config.label}
            content={existing?.content ?? null}
            userName={existing?.userName ?? null}
            updatedAt={existing?.updatedAt ?? null}
          />
        )
      })}
      {userId && (
        <a className="info-empty-action" href={`/v2/carte/lieu/${placeId}/modifier`}>
          ✎ Enrichir dans la nouvelle appli
        </a>
      )}

    </div>
  )
}

// Lecture seule depuis le 05/10/2026 : accès, saison et infos s'enrichissent dans la V2.
function InfoRow({ icon, label, content, userName, updatedAt }: {
  icon: string
  label: string
  content: string | null
  userName: string | null
  updatedAt: string | null
}) {
  return (
    <div className="info-row">
      <div className="info-row-header">
        <span className="info-icon">{icon}</span>
        <span className="info-label">{label}</span>
      </div>

      {content ? (
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
