/**
 * QUOI     — « Associer un Fragment » en haut à droite d'une contribution : une fenêtre s'ouvre sur le
 *            Fragment du produit porté (deviné d'après son nom), qu'on peut changer ; « Valider » le donne
 *            au compte du contributeur (Uriel, 16/10).
 * POURQUOI — sans compte dans l'appli, rien à quoi l'associer : le bouton le dit. La base refuse ce qui
 *            n'a pas lieu d'être (Fragment déjà possédé…) : son message s'affiche dans la fenêtre.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { associerAuCompte } from '../api/fragments'
import type { Contribution } from '../api/contributions'
import { useFragments } from '../hooks/useFragments'
import { fragmentDuProduit } from '../lib/fragmentDuProduit'
import styles from './Photos.module.css'

export function AssocierAuCompte({ contribution }: { contribution: Contribution }) {
  const [ouvert, setOuvert] = useState(false)
  const compte = contribution.compte
  return (
    <>
      <button type="button" className={styles.contour} disabled={compte === null}
        title={compte === null ? 'Pas de compte dans l’appli' : undefined} onClick={() => { setOuvert(true) }}>
        Associer un Fragment
      </button>
      {ouvert && compte !== null && (
        <Fenetre contribution={contribution} compte={compte} onFerme={() => { setOuvert(false) }} />
      )}
    </>
  )
}

function Fenetre({ contribution, compte, onFerme }: { contribution: Contribution; compte: string; onFerme: () => void }) {
  const { data: fragments = [] } = useFragments()
  const produit = contribution.produit ?? contribution.images.find((i) => i.produit_titre)?.produit_titre ?? null
  const devine = fragmentDuProduit(fragments, produit)
  const [choix, setChoix] = useState<number | null>(null)
  const choisi = fragments.find((f) => f.id === (choix ?? devine?.id))
  const client = useQueryClient()
  const associer = useMutation({
    mutationFn: (fragment: number) => associerAuCompte(compte, fragment),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-compte', compte] }),
  })

  return (
    <div className={styles.voile}>
      <section className={styles.fenetre} role="dialog" aria-modal="true" aria-label={`Associer un Fragment à ${contribution.nom}`}>
        <h3 className={styles.titreFenetre}>Associer un Fragment</h3>
        <p className={styles.petit}>{`À ${contribution.nom}${produit ? `, qui porte ${produit}` : ''}.`}</p>

        {associer.isSuccess && choisi ? (
          <p role="status" className={styles.reussi}>{`${choisi.name} est associé au compte de ${contribution.nom}.`}</p>
        ) : (
          <>
            {choisi && (choisi.illustration_url ?? choisi.image_url) && (
              <img className={styles.illustrationFragment} src={choisi.illustration_url ?? choisi.image_url ?? ''} alt="" />
            )}
            <select className={styles.choix} aria-label="Fragment" value={choisi?.id ?? ''}
              onChange={(e) => { associer.reset(); setChoix(Number(e.target.value)) }}>
              <option value="" disabled>Choisir un Fragment</option>
              {fragments.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </>
        )}
        {associer.error && <p role="alert" className={styles.erreur}>{associer.error.message}</p>}

        <div className={styles.boutonsFenetre}>
          {associer.isSuccess ? (
            <button type="button" className={styles.plein} onClick={onFerme}>Fermer</button>
          ) : (
            <>
              <button type="button" className={styles.contour} onClick={onFerme}>Annuler</button>
              <button type="button" className={styles.plein} disabled={!choisi || associer.isPending}
                onClick={() => { if (choisi) associer.mutate(choisi.id) }}>Valider</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
