/**
 * QUOI     — la fenêtre « Une nouvelle version d'Explore est arrivée » : Recharger, ou plus tard.
 * POURQUOI — Uriel, 07/10 : la V1 la montrait, la V2 rechargeait en silence — au risque de
 *            perdre une saisie en cours. L'état vient de miseAJour.ts.
 * ATTENTION — « Plus tard » ferme la fenêtre ; l'app se rechargera d'elle-même quand
 *            l'Explorateur la quittera (miseAJour.ts).
 */
import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/shared/ui/Button'
import { Question } from '@/shared/ui/Question'
import { nouvelleVersion, recharger } from './miseAJour'

export function NouvelleVersion() {
  const degre = useSyncExternalStore(nouvelleVersion.suivre, nouvelleVersion.lire)
  const [plusTard, setPlusTard] = useState(false)
  // Vider les caches et reprendre la dernière version prend quelques secondes (Uriel, 31/10).
  const [enCours, setEnCours] = useState(false)
  if (!degre || plusTard) return null

  const fermer = () => {
    setPlusTard(true)
  }
  return (
    <Question
      titre="Une nouvelle version d’Explore est arrivée"
      explication="Recharge pour en profiter : ça ne prend qu’un instant."
      onFermer={fermer}
    >
      <Button
        enCours={enCours}
        onClick={() => {
          setEnCours(true)
          void recharger()
        }}
      >
        {enCours ? 'Mise à jour…' : 'Recharger'}
      </Button>
      <Button kind="secondaire" onClick={fermer}>
        Plus tard
      </Button>
    </Question>
  )
}
