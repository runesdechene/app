/**
 * QUOI     — les décisions au bas d'une contribution : « Archiver » (en attente ou publiée) et, en attente
 *            ou archivée, « Couronnes offertes » + « Valider et publier ».
 * POURQUOI — les couronnes ne se versent qu'une fois : une contribution déjà récompensée n'a pas de champ,
 *            elle dit quand. La base décide et refuse ; son message reste sous les boutons.
 *            « Télécharger » (les photos en archive) et « Supprimer » (confirmation en ligne) ferment la rangée :
 *            supprimer est refusé en bloc si Shopify ou le stockage refuse, la contribution reste entière.
 */
import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { dateCourte } from '@/shared/lib/dates'
import type { Contribution, StatutContribution } from '../api/contributions'
import { useTelechargement } from '../hooks/useTelechargement'
import { fichiersDeContributions } from '../lib/archive'
import { nettoyer } from '../lib/contribution'
import styles from './Photos.module.css'

type Ecriture = UseMutationResult<void, Error, { id: string; statut: StatutContribution; couronnes?: number }>
type Suppression = UseMutationResult<void, Error, Contribution>

const COURONNES_PAR_DEFAUT = '10'

export function DecisionsDeContribution({ contribution, ecriture, suppression, onDecide }: {
  contribution: Contribution; ecriture: Ecriture; suppression: Suppression; onDecide: () => void
}) {
  const [couronnes, setCouronnes] = useState(COURONNES_PAR_DEFAUT)
  const [confirme, setConfirme] = useState(false)
  const telechargement = useTelechargement()
  const { id, statut, recompensee_le: recompensee } = contribution

  function decider(nouveau: StatutContribution, nombre?: number) {
    ecriture.reset()
    ecriture.mutate(nombre === undefined ? { id, statut: nouveau } : { id, statut: nouveau, couronnes: nombre }, { onSuccess: onDecide })
  }

  function supprimer() {
    suppression.mutate(contribution, { onSuccess: onDecide })
  }

  const nombre = contribution.images.length
  return (
    <section className={styles.decisions}>
      <button type="button" className={styles.telechargerTout} disabled={telechargement.enCours}
        onClick={() => { void telechargement.telecharger(fichiersDeContributions([contribution]), `${nettoyer(contribution.nom)}.zip`) }}>
        {`↓ Télécharger ${nombre === 1 ? 'la photo' : `les ${String(nombre)} photos`}`}
      </button>
      {confirme ? (
        <span className={styles.rangee}>
          <span>{`Supprimer cette contribution et ses ${String(nombre)} photos ?`}</span>
          <button type="button" className={styles.plein} disabled={suppression.isPending} onClick={supprimer}>Confirmer</button>
          <button type="button" className={styles.contour} onClick={() => { setConfirme(false) }}>Annuler</button>
        </span>
      ) : (
        <button type="button" className={styles.supprimer} onClick={() => { suppression.reset(); setConfirme(true) }}>Supprimer</button>
      )}
      {statut !== 'archived' && (
        <button type="button" className={styles.contour} disabled={ecriture.isPending} onClick={() => { decider('archived') }}>Archiver</button>
      )}
      {statut !== 'approved' && (
        <>
          {recompensee ? (
            <span className={styles.petit}>{`Déjà récompensée le ${dateCourte(recompensee)}`}</span>
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
      {telechargement.message && <span className={styles.progres}>{telechargement.message}</span>}
      {ecriture.error && <p role="alert" className={styles.erreur}>{ecriture.error.message}</p>}
      {suppression.error && <p role="alert" className={styles.erreur}>{suppression.error.message}</p>}
      {telechargement.erreur && <p role="alert" className={styles.erreur}>{telechargement.erreur}</p>}
    </section>
  )
}
