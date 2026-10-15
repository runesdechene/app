/**
 * QUOI     — le bloc « Ses Fragments » de la fiche d'un compte : les Fragments qu'il a, chacun avec « Retirer »
 *            (confirmation en ligne), et « Associer un Fragment » parmi ceux qu'il n'a pas.
 * POURQUOI — l'association à la main est le geste de l'équipe au stand ou après un achat hors boutique ; la
 *            base refuse un compte ou un Fragment inconnu, son message s'affiche sous le bloc.
 */
import { useState } from 'react'
import { dateCourte } from '@/shared/lib/dates'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { FicheDeCompte } from '../api/comptes'
import { useEcritureFragmentsDuCompte, useFragmentsAssociables } from '../hooks/useFragmentsDuCompte'
import styles from './Communaute.module.css'

type Fragment = FicheDeCompte['fragments'][number]

function LigneDeFragment({ fragment, enCours, onRetirer }: { fragment: Fragment; enCours: boolean; onRetirer: () => void }) {
  const [confirmer, setConfirmer] = useState(false)
  const nom = fragment.nom ?? 'Fragment'
  return (
    <div className={styles.ligneFiche}>
      {fragment.image ? <img className={styles.vignette} src={fragment.image} alt="" /> : <span className={styles.vignette} />}
      <span>{nom}</span>
      <span className={styles.detail}>
        {fragment.source === 'shopify' ? 'débloqué par une commande' : fragment.source === 'manual' ? 'associé à la main' : ''}
        {fragment.quand ? ` ${dateCourte(fragment.quand)}` : ''}
      </span>
      <span className={styles.air} />
      {confirmer ? (
        <span>
          Retirer {nom} ?{' '}
          <button type="button" className={styles.boutonContour} disabled={enCours}
            onClick={() => { setConfirmer(false); onRetirer() }}>Confirmer</button>{' '}
          <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(false) }}>Annuler</button>
        </span>
      ) : (
        <button type="button" className={styles.boutonContour} disabled={enCours} onClick={() => { setConfirmer(true) }}>Retirer</button>
      )}
    </div>
  )
}

export function AssocierFragment({ compte, fragments }: { compte: string; fragments: Fragment[] }) {
  const { data: tous = [] } = useFragmentsAssociables()
  const { associer, retirer } = useEcritureFragmentsDuCompte(compte)
  const [choisi, setChoisi] = useState('')
  const possedes = new Set(fragments.map((f) => f.id))
  const enCours = associer.isPending || retirer.isPending
  const erreur = associer.error ?? retirer.error

  return (
    <>
      <TitreDeSection titre="Ses Fragments" />
      <Bloc>
        {fragments.length === 0 && <p className={styles.calme}>Aucun Fragment.</p>}
        {fragments.map((f) => (
          <LigneDeFragment key={f.id} fragment={f} enCours={enCours}
            onRetirer={() => { associer.reset(); retirer.mutate(f.id) }} />
        ))}
      </Bloc>

      <TitreDeSection titre="Associer un Fragment" />
      <Bloc>
        <div className={styles.ligneFiche}>
          <select className={styles.choix} aria-label="Fragment à associer" value={choisi} disabled={enCours}
            onChange={(e) => { setChoisi(e.target.value) }}>
            <option value="">Choisir un Fragment</option>
            {tous.filter((f) => !possedes.has(f.id)).map((f) => <option key={f.id} value={String(f.id)}>{f.nom}</option>)}
          </select>
          <button type="button" className={styles.boutonContour} disabled={choisi === '' || enCours}
            onClick={() => { retirer.reset(); associer.mutate(Number(choisi), { onSuccess: () => { setChoisi('') } }) }}>Associer</button>
        </div>
        {erreur && <p role="alert" className={styles.ligneFiche}>{erreur.message}</p>}
      </Bloc>
    </>
  )
}
