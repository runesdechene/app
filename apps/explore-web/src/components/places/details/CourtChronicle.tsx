import './CourtChronicle.css'
import type { ChronicleEntry } from '../../../types/court'
import { formatFrenchLongDate } from '../../../lib/dateFormat'

interface CourtChronicleProps {
  entries: ChronicleEntry[]
}

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return "à l'instant"
  if (min < 60) return `il y a ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)    return `il y a ${d}j`
  return formatFrenchLongDate(ts)
}

export function CourtChronicle({ entries }: CourtChronicleProps) {
  if (entries.length === 0) {
    return (
      <div className="chronicle-empty">
        Le lieu est encore silencieux. Aucune action diplomatique récente.
      </div>
    )
  }

  return (
    <div className="chronicle-list">
      <div className="chronicle-title">Chronique</div>
      {entries.map((e, i) => (
        <div key={i} className={`chronicle-row ${e.side}`}>
          <span className="chronicle-actor">{e.actorName}</span>
          {' '}
          <span className="chronicle-verb">
            {e.side === 'defense' ? 'a renforcé' : 'a investi pour'}
          </span>
          {' '}
          <span className="chronicle-target">{e.expeditionName}</span>
          {' — '}
          <span className="chronicle-amount">{e.amount} 👑</span>
          {' · '}
          <span className="chronicle-time">{formatRelative(e.ts)}</span>
        </div>
      ))}
    </div>
  )
}
