/**
 * QUOI     — la petite carte d'un pin (maquette « Pin GPS — 4 ») : son lieu-dit, sa date, ses jours,
 *            « Compléter le lieu », « Voir sur la carte », « Supprimer ce pin ».
 * POURQUOI — même carte depuis la feuille du « + » et depuis la carte. Supprimer demande
 *            confirmation dans la carte elle-même (jamais de boîte du navigateur).
 * ATTENTION — un pin encore dans le téléphone (en attente, ou refusé) ne se complète pas et ne
 *            se voit pas sur la carte : le serveur ne le connaît pas. Il ne peut que se supprimer.
 */
import { useState } from 'react'
import pinGps from '@/assets/ui/pin-gps.svg'
import { dureeRestante } from '@/shared/lib/validitePin'
import { Feuille } from '@/shared/ui/Feuille'
import { useMesPins, useSupprimerPin } from '../hooks/usePins'
import styles from './FichePin.module.css'

type Props = {
  id: string
  onFermer: () => void
  onCompleter: () => void
  onVoirSurLaCarte: () => void
}

export function FichePin({ id, onFermer, onCompleter, onVoirSurLaCarte }: Props) {
  const pin = useMesPins().find((p) => p.id === id)
  const supprimer = useSupprimerPin()
  const [confirmer, setConfirmer] = useState(false)
  if (!pin) return null
  const pose = pin.poseLe.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return (
    <Feuille titre="Ton pin" onFermer={onFermer}>
      <div className={styles.haut}>
        <span className={styles.vignette}>
          <img src={pinGps} alt="" />
        </span>
        <span>
          <h2 className={styles.nom}>{pin.lieuDit ?? 'Ton pin'}</h2>
          <p className={styles.date}>Posé le {pose}</p>
        </span>
      </div>
      <p className={styles.jours}>
        {pin.jours > 0
          ? `⏳ ${dureeRestante(pin.jours)} pour le garder « sur place »`
          : 'Plus de 15 jours : il sera ajouté à distance'}
      </p>
      {!pin.enAttente && (
        <button type="button" className={styles.principal} onClick={onCompleter}>
          Compléter le lieu
        </button>
      )}
      {!pin.enAttente && (
        <button type="button" className={styles.secondaire} onClick={onVoirSurLaCarte}>
          Voir sur la carte
        </button>
      )}
      {confirmer ? (
        <div className={styles.confirmer}>
          <span>Supprimer ce pin ?</span>
          <button
            type="button"
            className={styles.oui}
            disabled={supprimer.isPending}
            onClick={() => {
              supprimer.mutate(pin, { onSuccess: onFermer })
            }}
          >
            Supprimer
          </button>
          <button
            type="button"
            className={styles.non}
            onClick={() => {
              setConfirmer(false)
            }}
          >
            Garder
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.supprimer}
          onClick={() => {
            setConfirmer(true)
          }}
        >
          Supprimer ce pin
        </button>
      )}
      {supprimer.isError && (
        <p className={styles.erreur} role="alert">
          Le pin n’a pas pu être supprimé. Réessaie.
        </p>
      )}
    </Feuille>
  )
}
