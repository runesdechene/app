/**
 * QUOI     — la bille d'un type de lieu : un rond dans la couleur du type, son icône en blanc
 *            dedans — comme les repères de la carte.
 * POURQUOI — Uriel, 29/09 : les lieux de l'Accueil (un ajout dans Sur les chemins, Près de toi)
 *            se reconnaissent à leur bille. Sans couleur, le rond prend l'ocre.
 */
import styles from './BilleType.module.css'

export function BilleType({ icone, couleur }: { icone: string; couleur: string | null }) {
  return (
    <span
      className={styles.bille}
      data-bille-type
      aria-hidden="true"
      style={couleur ? { '--type': couleur } : undefined}
    >
      <span className={styles.icone} style={{ '--icone': `url(${icone})` }} />
    </span>
  )
}
