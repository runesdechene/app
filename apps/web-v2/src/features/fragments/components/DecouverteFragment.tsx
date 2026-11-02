/**
 * QUOI     — la découverte d'un nouveau Fragment, par-dessus sa fiche (maquette « Scan — un nouveau
 *            Fragment sort de l'ombre », 02/11) : la carte monte de l'ombre, de dos (la rune d'or),
 *            se retourne dans un halo, un reflet la balaie ; « Nouveau Fragment ! », son nom, sa place
 *            dans sa collection, sa première anecdote ; puis « Creuser encore » et « Voir dans le
 *            Codex ».
 * POURQUOI — le premier scan d'un motif est le moment qui donne envie de scanner les autres. Toute
 *            la chorégraphie vit dans le CSS (transform, opacity) ; `prefers-reduced-motion` la coupe.
 */
import { Link } from 'react-router'
import eclair from '@/assets/ui/eclair.svg'
import { aLaTaille } from '@/shared/lib/image'
import { Insigne } from '@/shared/ui/Insigne'
import type { AnecdoteTrouvee } from '../api/lireMonFragment'
import type { Tirage } from '../api/lireTirage'
import styles from './DecouverteFragment.module.css'

export function DecouverteFragment({
  nom,
  illustration,
  collection,
  anecdote,
  boutique,
  creuser,
  fermer,
}: {
  nom: string
  illustration: string | null
  collection: Tirage['collection']
  anecdote: AnecdoteTrouvee | null
  boutique: string | null
  creuser: () => void
  fermer: () => void
}) {
  return (
    <div
      className={styles.voile}
      role="dialog"
      aria-modal="true"
      aria-labelledby="decouverte-titre"
    >
      <div className={styles.scene}>
        <span className={styles.rayons} aria-hidden="true" />
        <span className={styles.halo} aria-hidden="true" />
        <div className={styles.carte} aria-hidden="true">
          <span className={styles.dos}>
            <span className={styles.rune} />
          </span>
          <span className={styles.face}>
            {illustration && <img src={aLaTaille(illustration, 176)} alt="" />}
            <span className={styles.nouveau}>Nouveau</span>
            <span className={styles.reflet} />
          </span>
        </div>
      </div>

      <h1 id="decouverte-titre" className={styles.titre}>
        Nouveau Fragment !
      </h1>
      <p className={styles.nom}>{nom}</p>
      {collection && (
        <>
          <p className={styles.collection}>de la collection {collection.nom}</p>
          <p className={styles.place}>
            {collection.connus} sur {collection.total} de {collection.nom}
          </p>
        </>
      )}

      {anecdote && (
        <div className={styles.anecdote} data-rarete={anecdote.rarete}>
          <span className={styles.insigne}>
            <Insigne rarete={anecdote.rarete} avecLibelle />
            <span className={styles.premiere}>· ta première anecdote</span>
          </span>
          <p>{anecdote.texte}</p>
        </div>
      )}

      <div className={styles.gestes}>
        <button
          type="button"
          className={styles.creuser}
          onClick={() => {
            creuser()
            fermer()
          }}
        >
          Creuser encore
          <span className={styles.cout}>
            <img src={eclair} alt="" />2
          </span>
        </button>
        <Link className={styles.codex} to="/codex">
          Voir dans le Codex →
        </Link>
        {boutique && (
          <a className={styles.acquerir} href={boutique} target="_blank" rel="noreferrer">
            Acquérir ce Fragment pour ouvrir son histoire
          </a>
        )}
      </div>
    </div>
  )
}
