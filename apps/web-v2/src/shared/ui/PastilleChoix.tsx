/**
 * QUOI     — une pastille arrondie : un titre porté, un choix parmi d'autres.
 * POURQUOI — la même forme sert en lecture (titres sur le profil) et en choix (Modifier mon
 *            profil). Choisie, elle prend le bord rouge et la coche de la maquette. Une
 *            `marque` (✦ pour un haut fait) précède le libellé ; toutes les pastilles ont la
 *            même hauteur, marque ou non (décision d'Uriel, 27/09).
 */
import styles from './PastilleChoix.module.css'

export function PastilleChoix({
  libelle,
  choisie = false,
  marque,
  onClick,
}: {
  libelle: string
  choisie?: boolean
  marque?: string
  onClick?: () => void
}) {
  const className = [styles.pastille, choisie && styles.choisie].filter(Boolean).join(' ')
  const contenu = (
    <>
      {choisie && onClick ? (
        <span className={styles.coche} aria-hidden="true">
          ✓
        </span>
      ) : (
        marque && (
          <span className={styles.marque} aria-hidden="true">
            {marque}
          </span>
        )
      )}
      {libelle}
    </>
  )
  if (!onClick) return <span className={className}>{contenu}</span>
  return (
    <button type="button" className={className} aria-pressed={choisie} onClick={onClick}>
      {contenu}
    </button>
  )
}
