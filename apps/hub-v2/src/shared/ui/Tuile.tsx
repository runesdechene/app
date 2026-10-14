/**
 * QUOI     — un chiffre du pouls : libellé, valeur, et l'écart avec la période d'avant.
 * POURQUOI — sans écart (un chiffre qu'on ne peut pas comparer), la tuile ne ment pas : elle
 *            montre la valeur seule.
 */
import styles from './Tuile.module.css'

export type Ecart = { texte: string; sens: 'hausse' | 'baisse' | 'egal' }

export function Tuile({ libelle, valeur, ecart }: { libelle: string; valeur: string; ecart?: Ecart }) {
  return (
    <div className={styles.tuile}>
      <span className={styles.libelle}>{libelle}</span>
      <span className={styles.ligne}>
        <span className={styles.valeur}>{valeur}</span>
        {ecart && (
          <span className={styles.ecart} data-testid="ecart" data-sens={ecart.sens}>
            {ecart.texte}
          </span>
        )}
      </span>
    </div>
  )
}
