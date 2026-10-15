/**
 * QUOI     — les étiquettes d'une contribution : les poser (parmi les existantes), les retirer, en créer une.
 * POURQUOI — une étiquette créée ici est posée aussitôt sur la contribution. Chaque nouveau geste
 *            efface l'erreur du précédent ; elle s'affiche sous le bloc, avec le message de la base.
 */
import { useState } from 'react'
import { Balise } from '@/shared/ui/Balise'
import type { Contribution } from '../api/contributions'
import { useEcritureContribution, useEtiquettesDePhoto } from '../hooks/useContributions'
import styles from './Photos.module.css'

export function EtiquettesDeContribution({ contribution, ecriture }: {
  contribution: Contribution; ecriture: ReturnType<typeof useEcritureContribution>
}) {
  const { ajouter, retirer, creer } = ecriture
  const toutes = useEtiquettesDePhoto()
  const [choix, setChoix] = useState('')
  const [nouvelle, setNouvelle] = useState<string | null>(null)
  const posees = new Set(contribution.etiquettes.map((e) => e.id))
  const absentes = (toutes.data ?? []).filter((e) => !posees.has(e.id))
  const erreur = ajouter.error ?? retirer.error ?? creer.error

  function effacer() {
    ajouter.reset()
    retirer.reset()
    creer.reset()
  }

  return (
    <section className={styles.etiquettes}>
      <div className={styles.rangee}>
        {contribution.etiquettes.map((e) => (
          <span key={e.id} className={styles.etiquette}>
            <Balise texte={`#${e.nom}`} teinte="photo" />
            <button type="button" className={styles.lien} aria-label={`Retirer #${e.nom}`} disabled={retirer.isPending}
              onClick={() => { effacer(); retirer.mutate({ id: contribution.id, etiquette: e.id }) }}>Retirer</button>
          </span>
        ))}
      </div>
      <div className={styles.rangee}>
        <select aria-label="Ajouter une étiquette" value={choix} onChange={(e) => { setChoix(e.target.value) }}>
          <option value="">Choisir…</option>
          {absentes.map((e) => <option key={e.id} value={e.id}>{`#${e.nom}`}</option>)}
        </select>
        <button type="button" className={styles.contour} disabled={choix === '' || ajouter.isPending}
          onClick={() => { effacer(); ajouter.mutate({ id: contribution.id, etiquette: choix }, { onSuccess: () => { setChoix('') } }) }}>Ajouter</button>
        {nouvelle === null && (
          <button type="button" className={styles.lien} onClick={() => { effacer(); setNouvelle('') }}>+ Nouvelle étiquette</button>
        )}
      </div>
      {nouvelle !== null && (
        <div className={styles.rangee}>
          <input type="text" aria-label="Nouvelle étiquette" value={nouvelle} onChange={(e) => { setNouvelle(e.target.value) }} />
          <button type="button" className={styles.contour} disabled={nouvelle.trim() === '' || creer.isPending}
            onClick={() => { effacer(); creer.mutate({ id: contribution.id, nom: nouvelle.trim() }, { onSuccess: () => { setNouvelle(null) } }) }}>Créer</button>
          <button type="button" className={styles.lien} onClick={() => { setNouvelle(null) }}>Annuler</button>
        </div>
      )}
      {toutes.isError && <p role="alert">{toutes.error.message}</p>}
      {erreur && <p role="alert">{erreur.message}</p>}
    </section>
  )
}
