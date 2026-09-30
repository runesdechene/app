/**
 * QUOI     — toutes les natures de lieux, en gélules fines, sur toute la largeur de l'écran ;
 *            elles défilent au doigt (maquette 325:315). Toucher une nature la choisit : la
 *            recherche montre ses lieux. La retoucher la retire.
 * POURQUOI — Uriel, 30/09 : un visiteur qui ne sait pas quoi taper voit d'un coup ce que la
 *            carte contient. Les icônes sont celles de l'app, en pochoir couleur d'encre.
 */
import type { NatureComptee } from '../api/lireVitrine'
import styles from './DefileNatures.module.css'

export function DefileNatures({
  natures,
  choisie,
  onChoisir,
}: {
  natures: NatureComptee[]
  choisie: string | null
  onChoisir: (id: string | null) => void
}) {
  return (
    <div className={styles.cadre}>
      <ul className={styles.rangee} aria-label="Les natures de lieux">
        {natures.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className={styles.nature}
              aria-pressed={n.id === choisie}
              onClick={() => {
                onChoisir(n.id === choisie ? null : n.id)
              }}
            >
              {n.icone && (
                <span
                  className={styles.icone}
                  style={{ '--icone': `url(${n.icone})` }}
                  aria-hidden="true"
                />
              )}
              {n.nom}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
