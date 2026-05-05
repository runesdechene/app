import './PatronsList.css'
import { useMapStore } from '../../../stores/mapStore'
import type { Patron } from '../../../types/court'

interface PatronsListProps {
  patrons: Patron[]
  currentUserId?: string
}

export function PatronsList({ patrons, currentUserId }: PatronsListProps) {
  if (patrons.length === 0) return null

  const openProfile = (userId: string) => {
    useMapStore.getState().setSelectedPlayerId(userId)
  }

  return (
    <div className="patrons-list">
      {patrons.map((p, i) => {
        const isFirst = i === 0
        const isYou = currentUserId === p.userId
        return (
          <div key={p.userId} className={`patron-row${isFirst ? ' first' : ''}${isYou ? ' is-you' : ''}`}>
            <span className="patron-rank">#{i + 1}</span>
            <button
              type="button"
              className="patron-name"
              onClick={() => openProfile(p.userId)}
              title={`Voir le profil de ${p.displayName}`}
            >
              {p.displayName}
              {p.factionPattern && p.factionColor && (
                <span
                  className="patron-faction-icon"
                  style={{
                    backgroundColor: p.factionColor,
                    WebkitMaskImage: `url(${p.factionPattern})`,
                    maskImage: `url(${p.factionPattern})`,
                  }}
                  aria-hidden
                />
              )}
              {isFirst && <span className="patron-title">Mécène Principal</span>}
              {isYou && <span className="patron-you">(vous)</span>}
            </button>
            <span className="patron-breakdown">
              {p.defenseTotal > 0 && (
                <span className="patron-side patron-side-support" title="Soutien">🛡 {p.defenseTotal}</span>
              )}
              {p.attackTotal > 0 && (
                <span className="patron-side patron-side-influence" title="Influence">⚔ {p.attackTotal}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
