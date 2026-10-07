/**
 * QUOI     — la marque d'une culture : son icône (réglée dans le Hub), sinon un disque à sa couleur,
 *            sinon à l'encre.
 * POURQUOI — la même pastille que la feuille d'une énigme, sur la page « Les énigmes ».
 */
import { aLaTaille } from '@/shared/lib/image'
import styles from './PastilleCulture.module.css'

export function PastilleCulture({
  icone,
  couleur,
  taille,
}: {
  icone: string | null
  couleur: string | null
  taille: 'petite' | 'grande'
}) {
  return (
    <span
      className={styles.pastille}
      data-taille={taille}
      style={couleur ? { '--couleur-culture': couleur } : undefined}
      aria-hidden="true"
    >
      {icone ? <img src={aLaTaille(icone, 28)} alt="" /> : <span className={styles.disque} />}
    </span>
  )
}
