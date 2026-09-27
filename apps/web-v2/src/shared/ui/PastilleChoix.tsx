/**
 * QUOI     — une pastille arrondie : un titre porté, un choix parmi d'autres.
 * POURQUOI — la même forme sert en lecture (titres sur le profil) et en choix (Modifier mon
 *            profil). Choisie, elle prend le bord rouge et la coche de la maquette.
 */
import styles from './PastilleChoix.module.css'

export function PastilleChoix({
  libelle,
  choisie = false,
  onClick,
}: {
  libelle: string
  choisie?: boolean
  onClick?: () => void
}) {
  const className = [styles.pastille, choisie && styles.choisie].filter(Boolean).join(' ')
  if (!onClick) return <span className={className}>{libelle}</span>
  return (
    <button type="button" className={className} aria-pressed={choisie} onClick={onClick}>
      {choisie && (
        <span className={styles.coche} aria-hidden="true">
          ✓
        </span>
      )}
      {libelle}
    </button>
  )
}
