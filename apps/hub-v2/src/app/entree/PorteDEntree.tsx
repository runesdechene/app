/**
 * QUOI     — la porte du Hub : rien ne s'affiche avant qu'un admin soit connecté.
 * POURQUOI — applique decideEntree ; un joueur connecté apprend que le Hub est réservé et peut
 *            se déconnecter, au lieu d'un écran vide.
 */
import type { ReactNode } from 'react'
import { decideEntree } from './decideEntree'
import { EcranCode } from './EcranCode'
import { sortir } from './entree'
import { useEntree } from './useEntree'
import styles from './PorteDEntree.module.css'

export function PorteDEntree({ children }: { children: ReactNode }) {
  const { etat, relire } = useEntree()
  switch (decideEntree(etat)) {
    case 'attendre':
      return <main className={styles.ecran} aria-busy="true" />
    case 'code':
      return <EcranCode />
    case 'ouvrir':
      return children
    case 'refuse':
      return (
        <main className={styles.ecran}>
          <p className={styles.message}>Ce Hub est réservé à l’équipe.</p>
          <button className={styles.bouton} type="button" onClick={() => void sortir()}>
            Se déconnecter
          </button>
        </main>
      )
    case 'reessayer':
      return (
        <main className={styles.ecran}>
          <p className={styles.message}>La base ne répond pas.</p>
          <button className={styles.bouton} type="button" onClick={relire}>
            Réessayer
          </button>
        </main>
      )
  }
}
