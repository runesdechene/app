/**
 * QUOI     — la marque d'une culture : son icône (réglée dans le Hub) peinte à sa couleur, sinon un
 *            disque à sa couleur, sinon à l'encre.
 * ATTENTION — l'icône sert de masque (`mask-image`) que la couleur remplit (Uriel, 07/10 : « que les
 *            icônes prennent la couleur ») : seule sa forme compte, ses propres couleurs s'effacent.
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
      {icone ? (
        <span className={styles.icone} style={{ '--icone': `url("${aLaTaille(icone, 28)}")` }} />
      ) : (
        <span className={styles.disque} />
      )}
    </span>
  )
}
