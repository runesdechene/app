/**
 * QUOI     — les Fragments en grandes tuiles à toucher (maquette 631:1524) : choisis ou non.
 * POURQUOI — au stand, sur tablette : un doigt, pas une liste déroulante. Retirer un Fragment déjà
 *            activé demande un second toucher (« Retirer ? »), pour qu'un geste maladroit n'efface rien.
 */
import type { FragmentAssociable } from '../api/fragmentsDuCompte'
import styles from './AssocierUnFragment.module.css'

export function GrilleDeFragments({ fragments, choisis, aConfirmer, mots, enCours, onToucher }: {
  fragments: FragmentAssociable[]
  choisis: Set<number>
  aConfirmer?: number | null
  mots: { oui: string; non: string }
  enCours: boolean
  onToucher: (id: number) => void
}) {
  return (
    <div className={styles.grille}>
      {fragments.map((f) => {
        const choisi = choisis.has(f.id)
        return (
          <button key={f.id} type="button" className={styles.tuile} aria-pressed={choisi} disabled={enCours}
            onClick={() => { onToucher(f.id) }}>
            {f.image ? <img className={styles.illustration} src={f.image} alt="" loading="lazy" /> : <span className={styles.illustration} />}
            <span className={styles.nomFragment}>{f.nom}</span>
            <span className={styles.etat}>{aConfirmer === f.id ? 'Retirer ?' : choisi ? `✓ ${mots.oui}` : mots.non}</span>
          </button>
        )
      })}
    </div>
  )
}
