import type { ExpeditionListItem } from '../../types/expedition'
import { formatRelativeRdv } from '../../lib/expeditionDateFormat'

interface Props {
  item: ExpeditionListItem
  onClick: () => void
}

/**
 * Card minimaliste sur 1 ligne :
 * [avatar] 🚩 [titre …]   [date]   [slots]
 *
 * Faction, badge chef, l'appel, lieu, etc. ne sont PAS affichés ici —
 * tout est dans la modale détail. La card sert juste à signaler qu'une
 * expédition est sur la carte, avec son auteur et son urgence.
 */
export function ExpeditionCard({ item, onClick }: Props) {
  const initials = (item.chief.display_name || '?').slice(0, 2).toUpperCase()
  const factionStyle = item.chief.faction_color
    ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 3px ${item.chief.faction_color}` }
    : undefined

  const slots = item.slots_open
    ? `∞ · ${item.validated_count + 1}`
    : `${item.validated_count + 1}/${item.slots_max}`

  return (
    <li className="expedition-card" onClick={onClick}>
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
      <span className="expedition-card-flag" aria-hidden>🚩</span>
      <span className="expedition-card-title">{item.name}</span>
      <span className="expedition-card-when">{formatRelativeRdv(item.rdv_at)}</span>
      <span className="expedition-card-slots">{slots}</span>
    </li>
  )
}
