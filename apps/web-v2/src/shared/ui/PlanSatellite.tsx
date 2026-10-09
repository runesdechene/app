/**
 * QUOI     — le bouton Plan / Satellite, posé sur une carte où l'on place un point.
 * POURQUOI — maquettes « Pin GPS — 1 » et « 6a » : une pilule crème, le choix en encre.
 */
import type { VueCarte } from '@/shared/lib/styleSatellite'
import styles from './PlanSatellite.module.css'

const VUES: { vue: VueCarte; nom: string }[] = [
  { vue: 'plan', nom: 'Plan' },
  { vue: 'satellite', nom: 'Satellite' },
]

export function PlanSatellite({ vue, onChanger }: { vue: VueCarte; onChanger: (v: VueCarte) => void }) {
  return (
    <div className={styles.vues} role="group" aria-label="Vue de la carte">
      {VUES.map((v) => (
        <button
          key={v.vue}
          type="button"
          className={styles.vue}
          aria-pressed={vue === v.vue}
          onClick={() => {
            onChanger(v.vue)
          }}
        >
          {v.nom}
        </button>
      ))}
    </div>
  )
}
