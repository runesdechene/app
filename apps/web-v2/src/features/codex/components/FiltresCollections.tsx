/**
 * QUOI     — les filtres du Codex : « Toutes », puis une gélule par collection (son icône, son
 *            compte). La bande défile et s'efface en fondu à droite.
 * POURQUOI — maquette F (02/11) : toutes les collections d'un coup d'œil, et l'une seule au choix.
 */
import type { Collection } from '../api/lireCodex'
import styles from './FiltresCollections.module.css'

export function FiltresCollections({
  collections,
  choisie,
  choisir,
}: {
  collections: Collection[]
  choisie: string | null
  choisir: (nom: string | null) => void
}) {
  return (
    <div className={styles.cadre}>
      <div className={styles.bande} role="group" aria-label="Trier par collection">
        <button
          type="button"
          className={styles.filtre}
          aria-pressed={choisie === null}
          onClick={() => {
            choisir(null)
          }}
        >
          Toutes
        </button>
        {collections.map((c) => (
          <button
            key={c.nom}
            type="button"
            className={styles.filtre}
            aria-pressed={choisie === c.nom}
            onClick={() => {
              choisir(c.nom)
            }}
          >
            {c.icone && <img className={styles.icone} src={c.icone} alt="" />}
            {c.nom}
            <span className={styles.compte}>
              {c.portes}/{c.total}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
