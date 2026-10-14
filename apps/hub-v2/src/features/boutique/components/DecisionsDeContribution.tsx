/**
 * QUOI     — les décisions au bas d'une contribution : « Archiver » (en attente ou publiée) et, en attente
 *            ou archivée, « Couronnes offertes » + « Valider et publier ».
 * POURQUOI — les couronnes ne se versent qu'une fois : une contribution déjà récompensée n'a pas de champ,
 *            elle dit quand. La base décide et refuse ; son message reste sous les boutons.
 *            « Télécharger » et « Supprimer » (Task 8) s'ajoutent dans la même rangée.
 */
import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { dateCourte } from '@/shared/lib/dates'
import type { Contribution, StatutContribution } from '../api/contributions'
import styles from './Photos.module.css'

type Ecriture = UseMutationResult<void, Error, { id: string; statut: StatutContribution; couronnes?: number }>

const COURONNES_PAR_DEFAUT = '10'

export function DecisionsDeContribution({ contribution, ecriture, onDecide }: {
  contribution: Contribution; ecriture: Ecriture; onDecide: () => void
}) {
  const [couronnes, setCouronnes] = useState(COURONNES_PAR_DEFAUT)
  const { id, statut, recompensee_le: recompensee } = contribution

  function decider(nouveau: StatutContribution, nombre?: number) {
    ecriture.reset()
    ecriture.mutate(nombre === undefined ? { id, statut: nouveau } : { id, statut: nouveau, couronnes: nombre }, { onSuccess: onDecide })
  }

  return (
    <section className={styles.decisions}>
      {statut !== 'archived' && (
        <button type="button" className={styles.contour} disabled={ecriture.isPending} onClick={() => { decider('archived') }}>Archiver</button>
      )}
      {statut !== 'approved' && (
        <>
          {recompensee ? (
            <span className={styles.calme}>{`Déjà récompensée le ${dateCourte(recompensee)}`}</span>
          ) : (
            <label className={styles.couronnes}>
              Couronnes offertes
              <input type="number" min={0} step={1} value={couronnes} onChange={(e) => { setCouronnes(e.target.value) }} />
            </label>
          )}
          <button type="button" className={styles.plein} disabled={ecriture.isPending}
            onClick={() => { decider('approved', recompensee ? undefined : Math.max(0, Math.floor(Number(couronnes) || 0))) }}>
            Valider et publier
          </button>
        </>
      )}
      {ecriture.error && <p role="alert" className={styles.erreur}>{ecriture.error.message}</p>}
    </section>
  )
}
