/**
 * QUOI     — le filtre de « Sur les chemins » : trois pastilles, Lieux · Gens · Énigmes, qu'on
 *            allume ou éteint.
 * POURQUOI — Uriel, 11/10 : pouvoir retirer les énigmes du fil quand elles prennent trop de place.
 *            Les pastilles de choix de l'appli (`PastilleChoix`) : la coche dit ce qui est allumé.
 */
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
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
        <PastilleChoix
          key={f.id}
          libelle={f.libelle}
          choisie={allumees.has(f.id)}
          onClick={() => {
            onBasculer(f.id)
          }}
        />
      ))}
    </div>
  )
}
