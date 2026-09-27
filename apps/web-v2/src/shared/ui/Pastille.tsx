/**
 * QUOI     — la pastille rouge de non-lus (onglet Messages, Murmures).
 * POURQUOI — rien à zéro : une pastille « 0 » attire l'œil pour rien. Au-delà de 9, « 9+ »
 *            garde la pastille ronde ; le vrai nombre reste lu par un lecteur d'écran.
 */
import styles from './Pastille.module.css'

export function Pastille({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className={styles.pastille} aria-label={`${String(count)} non lus`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
