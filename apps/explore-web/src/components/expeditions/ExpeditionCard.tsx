import type { ExpeditionListItem } from '../../types/expedition'
import { usePlayerStore } from '../../stores/playerStore'
import { formatRelativeRdv } from '../../lib/expeditionDateFormat'

interface Props {
  item: ExpeditionListItem
  onClick: () => void
}

export function ExpeditionCard({ item, onClick }: Props) {
  const myUserId = usePlayerStore((s) => s.userId)
  const isChief = item.chief.user_id === myUserId

  const slotsLabel = item.slots_open
    ? `${item.validated_count + 1} inscrits` // chef + validés
    : `${item.validated_count + 1}/${item.slots_max}`

  const isFull = !item.slots_open
    && item.slots_max != null
    && (item.validated_count + 1) >= item.slots_max

  const initials = (item.chief.display_name || '?').slice(0, 2).toUpperCase()
  const factionStyle = item.chief.faction_color
    ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 4px ${item.chief.faction_color}` }
    : undefined

  return (
    <li className="expedition-card" onClick={onClick}>
      <span className="expedition-card-pill">
        <span className="expedition-card-pill-icon">🚩</span>Expédition
      </span>

      <div className="expedition-card-body">
        <div className={`expedition-card-when${item.status !== 'published' ? ' is-muted' : ''}`}>
          {formatRelativeRdv(item.rdv_at)}
        </div>
        <div className="expedition-card-title">{item.name}</div>
        {item.call_text && (
          <div className="expedition-card-call">« {item.call_text} »</div>
        )}
        <div className="expedition-card-meta">
          <span
            className="expedition-card-avatar"
            style={factionStyle}
            aria-label={`Avatar de ${item.chief.display_name}`}
          >
            {item.chief.avatar_url ? (
              <img src={item.chief.avatar_url} alt="" />
            ) : (
              initials
            )}
          </span>
          <span>{item.chief.display_name}</span>
          {item.chief.faction_title && item.chief.faction_color && (
            <span
              className="expedition-card-heritage-tag"
              style={{
                background: `${item.chief.faction_color}22`,
                color: item.chief.faction_color,
              }}
            >
              <span
                className="expedition-card-heritage-dot"
                style={{ background: item.chief.faction_color }}
              />
              {item.chief.faction_title}
            </span>
          )}
          {item.rdv_label && (
            <>
              <span className="expedition-card-dot">·</span>
              <span className="expedition-card-place">{item.rdv_label}</span>
            </>
          )}
          {isChief && <span className="expedition-card-badge is-chief">Toi · chef</span>}
        </div>
      </div>

      <div className="expedition-card-slots">
        <span className={`expedition-card-slots-num${isFull ? ' is-full' : ''}`}>
          {item.slots_open ? '∞' : slotsLabel.split('/')[0]}
          {!item.slots_open && (
            <span className="expedition-card-slots-mute">/{item.slots_max}</span>
          )}
        </span>
        <span className="expedition-card-slots-label">
          {isFull ? 'complet' : item.slots_open ? 'ouvert' : 'places'}
        </span>
      </div>
    </li>
  )
}
