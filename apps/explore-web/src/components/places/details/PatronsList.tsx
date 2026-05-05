import './PatronsList.css'
import type { Patron } from '../../../types/court'

interface PatronsListProps {
  patrons: Patron[]
  currentUserId?: string
}

export function PatronsList({ patrons, currentUserId }: PatronsListProps) {
  if (patrons.length === 0) {
    return (
      <div className="patrons-empty">
        Aucun mécène ne s'est encore distingué sur ce lieu.
      </div>
    )
  }

  return (
    <div className="patrons-list">
      <div className="patrons-title">Trône des Mécènes</div>
      {patrons.map((p, i) => {
        const isFirst = i === 0
        const isYou = currentUserId === p.userId
        return (
          <div key={p.userId} className={`patron-row${isFirst ? ' first' : ''}${isYou ? ' is-you' : ''}`}>
            <span className="patron-rank">#{i + 1}</span>
            <span className="patron-name">
              {p.displayName}
              {isFirst && <span className="patron-title"> · Mécène Principal</span>}
              {isYou && <span className="patron-you"> (vous)</span>}
            </span>
            <span className="patron-total">{p.total} 👑</span>
          </div>
        )
      })}
    </div>
  )
}
