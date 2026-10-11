/**
 * QUOI     — le filtre de « Sur les chemins » : trois mots en petit, Lieux, Gens, Énigmes, qu'on
 *            allume ou éteint. Allumé, le mot est à l'encre, une bille ocre devant ; éteint, il pâlit.
 * POURQUOI — Uriel, 11/10 : pouvoir retirer les énigmes du fil quand elles prennent trop de place,
 *            avec un filtre discret — le fil reste le sujet, pas ses réglages.
 */
import { FAMILLES, type Famille } from '../lib/familles'
import styles from './FiltreDesChemins.module.css'

export function FiltreDesChemins({
  allumees,
  onBasculer,
}: {
  allumees: ReadonlySet<Famille>
  onBasculer: (f: Famille) => void
}) {
  return (
    <div className={styles.filtre} role="group" aria-label="Ce que montre le fil">
      {FAMILLES.map((f) => (
        <button
          key={f.id}
          type="button"
          className={styles.famille}
          aria-pressed={allumees.has(f.id)}
          onClick={() => {
            onBasculer(f.id)
          }}
        >
          {f.libelle}
        </button>
      ))}
    </div>
  )
}
