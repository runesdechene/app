/**
 * QUOI     — la pastille de non-lus. Rouge avec le nombre (les Murmures) ; `discrete` : un petit
 *            point brun foncé, sans nombre (les messages ratés de la communauté).
 * POURQUOI — rien à zéro : une pastille « 0 » attire l'œil pour rien. Au-delà de 9, « 9+ »
 *            garde la pastille ronde ; le vrai nombre reste lu par un lecteur d'écran. Le rouge
 *            est réservé aux Murmures (Uriel, 30/09) : le Registre est public et vivant, un point
 *            dit « il s'est passé quelque chose » sans presser.
 * ATTENTION — role="img" : sans rôle, un span ignore son aria-label, et un lecteur d'écran
 *            entendait « Messages3 » au lieu de « Messages, 3 non lus ».
 */
import styles from './Pastille.module.css'

export function Pastille({ count, discrete = false }: { count: number; discrete?: boolean }) {
  if (count <= 0) return null
  if (discrete) {
    return <span className={styles.point} role="img" aria-label="Nouveaux messages" />
  }
  return (
    <span className={styles.pastille} role="img" aria-label={`${String(count)} non lus`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
