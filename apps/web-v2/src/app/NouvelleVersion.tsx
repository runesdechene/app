/**
 * QUOI     — la fenêtre « Une nouvelle version d'Explore est arrivée » : Recharger, ou plus tard.
 * POURQUOI — Uriel, 07/10 : la V1 la montrait, la V2 rechargeait en silence — au risque de
 *            perdre une saisie en cours. L'état vient de miseAJour.ts.
 * ATTENTION — « Plus tard » ferme la fenêtre ; l'app se rechargera d'elle-même quand
 *            l'Explorateur la quittera (miseAJour.ts).
 */
import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { nouvelleVersion, recharger } from './miseAJour'
import styles from './NouvelleVersion.module.css'

export function NouvelleVersion() {
  const degre = useSyncExternalStore(nouvelleVersion.suivre, nouvelleVersion.lire)
  const [plusTard, setPlusTard] = useState(false)
  if (!degre || plusTard) return null

  const fermer = () => {
    setPlusTard(true)
  }
  return (
    <Feuille titre="Une nouvelle version d’Explore est arrivée" onFermer={fermer}>
      <p className={styles.titre}>Une nouvelle version d’Explore est arrivée</p>
      <p className={styles.explication}>Recharge pour en profiter : ça ne prend qu’un instant.</p>
      <div className={styles.choix}>
        <Button
          onClick={() => {
            void recharger()
          }}
        >
          Recharger
        </Button>
        <Button kind="secondaire" onClick={fermer}>
          Plus tard
        </Button>
      </div>
    </Feuille>
  )
}
