/**
 * QUOI     — une rangée de pastilles à choix unique, et la pastille : les tailles (étape 2), le type
 *            de vêtement (« Ton histoire », « Ton avis »).
 * POURQUOI — le même bouton à deux endroits : un seul composant. `aria-pressed` dit la pastille
 *            choisie, aux lecteurs d'écran comme au style.
 */
import type { ReactNode } from 'react'
import styles from './Pastille.module.css'

export function Pastilles({ nom, aGauche = false, children }: { nom: string; aGauche?: boolean; children: ReactNode }) {
  return (
    <div className={styles.rangee} role="group" aria-label={nom} data-alignement={aGauche ? 'debut' : undefined}>
      {children}
    </div>
  )
}

export function Pastille({ choisie, choisir, children }: { choisie: boolean; choisir: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.pastille} aria-pressed={choisie} onClick={choisir}>
      {children}
    </button>
  )
}
