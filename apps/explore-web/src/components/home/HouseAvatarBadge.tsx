import { usePlayerStore } from '../../stores/playerStore'
import './HouseAvatarBadge.css'

interface Props {
  size?: number
}

/**
 * Badge "Maison / Héritage" superposé sur l'avatar du joueur.
 * En pratique : l'icône de la faction (Héritage) du joueur.
 * Pas cliquable séparément — l'avatar gère le click.
 */
export function HouseAvatarBadge({ size = 22 }: Props) {
  const factionPattern = usePlayerStore((s) => s.userFactionPattern)
  const factionColor = usePlayerStore((s) => s.userFactionColor)

  if (!factionPattern && !factionColor) return null

  return (
    <span
      className="house-avatar-badge"
      style={{
        width: size,
        height: size,
        backgroundColor: factionColor ?? '#2c2418',
      }}
      aria-label="Mon Héritage"
    >
      {factionPattern && (
        <img src={factionPattern} alt="" className="house-avatar-badge-img" />
      )}
    </span>
  )
}
