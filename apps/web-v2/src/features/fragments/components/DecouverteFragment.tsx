/**
 * QUOI     — la découverte, par-dessus la fiche, en deux genres (maquettes Figma du 02/11 et du 03/11) :
 *            - un nouveau Fragment, au premier scan d'un motif : la carte monte de l'ombre, de dos (la
 *              rune d'or), se retourne dans un halo, un reflet la balaie ; « Nouveau Fragment ! », son
 *              nom, sa place dans sa collection, sa première anecdote ;
 *            - une nouvelle anecdote (celle du jour, ou une de plus en creusant) : la carte, déjà
 *              connue, monte sans se retourner ; l'anecdote se déplie dessous, teintée de sa rareté.
 *            Puis « Creuser encore », qui rejoue la révélation sur place (ou les félicitations quand
 *            tout est trouvé), et de quoi fermer sans rien coûter.
 * POURQUOI — chaque anecdote gagnée mérite son moment : c'est ce qui donne envie de creuser et de
 *            scanner. Toute la chorégraphie vit dans le CSS (transform, opacity) ; `prefers-reduced-motion`
 *            la coupe. Le <dialog> du navigateur garde le focus dedans, et Échap ferme.
 */
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import eclair from '@/assets/ui/eclair.svg'
import { aLaTaille } from '@/shared/lib/image'
import { Insigne } from '@/shared/ui/Insigne'
import type { Tirage } from '../api/lireTirage'
import styles from './DecouverteFragment.module.css'

function etiquette(tirage: Tirage, nouveauFragment: boolean): string {
  if (nouveauFragment) return '· ta première anecdote'
  if (tirage.restantes === 0) return '· ta dernière anecdote'
  return tirage.raison === 'creusee' ? '· trouvée en creusant' : '· ton anecdote du jour'
}

export function DecouverteFragment({
  nom,
  illustration,
  tirage,
  total,
  boutique,
  creuser,
  enCours,
  plusDEnergie,
  fermer,
}: {
  nom: string
  illustration: string | null
  tirage: Tirage
  total: number // le nombre d'anecdotes du motif
  boutique: string | null // null pour qui le porte déjà
  creuser: () => void
  enCours: boolean
  plusDEnergie: boolean
  fermer: () => void
}) {
  const fenetre = useRef<HTMLDialogElement>(null)
  const fiche = useRef<HTMLButtonElement>(null)

  // Le focus va sur « Voir sa fiche », pas sur « Creuser encore » qui coûte de l'énergie.
  useEffect(() => {
    if (fenetre.current?.open === false) fenetre.current.showModal()
    fiche.current?.focus()
  }, [])

  // Creuser après la découverte d'un Fragment rend aussi premiereDecouverte : c'est alors une anecdote.
  const nouveauFragment = tirage.premiereDecouverte && tirage.raison !== 'creusee'
  const { anecdote, collection } = tirage
  const rare = anecdote?.rarete === 'rare'
  const titre = nouveauFragment
    ? 'Nouveau Fragment !'
    : rare
      ? 'Anecdote rare !'
      : 'Nouvelle anecdote !'
  const trouvees = total - tirage.restantes

  return (
    <dialog
      ref={fenetre}
      className={styles.voile}
      data-genre={nouveauFragment ? 'fragment' : 'anecdote'}
      aria-labelledby="decouverte-titre"
      onCancel={(e) => {
        e.preventDefault()
        fermer()
      }}
    >
      <div className={styles.scene}>
        {(nouveauFragment || rare) && <span className={styles.rayons} aria-hidden="true" />}
        <span className={styles.halo} aria-hidden="true" />
        <div className={styles.carte} aria-hidden="true">
          {nouveauFragment && (
            <span className={styles.dos}>
              <span className={styles.rune} />
            </span>
          )}
          <span className={styles.face}>
            {illustration && <img src={aLaTaille(illustration, 176)} alt="" />}
            {nouveauFragment && <span className={styles.nouveau}>Nouveau</span>}
            <span className={styles.reflet} />
          </span>
        </div>
      </div>

      <h1 id="decouverte-titre" className={styles.titre}>
        {titre}
      </h1>
      <p className={styles.nom}>{nom}</p>
      {nouveauFragment && collection && (
        <>
          <p className={styles.collection}>de la collection {collection.nom}</p>
          <p className={styles.place}>
            {collection.connus} sur {collection.total} de {collection.nom}
          </p>
        </>
      )}
      {!nouveauFragment && total > 0 && (
        <p className={styles.place}>
          {trouvees} sur {total} anecdotes trouvées
        </p>
      )}

      {anecdote && (
        <div className={styles.anecdote} data-rarete={anecdote.rarete}>
          <span className={styles.insigne}>
            <Insigne rarete={anecdote.rarete} avecLibelle />
            <span className={styles.premiere}>{etiquette(tirage, nouveauFragment)}</span>
          </span>
          <p>{anecdote.texte}</p>
        </div>
      )}

      <div className={styles.gestes}>
        {tirage.restantes > 0 ? (
          <button
            type="button"
            className={styles.creuser}
            disabled={enCours || plusDEnergie}
            onClick={creuser}
          >
            {plusDEnergie ? 'Plus assez d’énergie' : 'Creuser encore'}
            <span className={styles.cout}>
              <img src={eclair} alt="" />2
            </span>
          </button>
        ) : (
          anecdote && (
            <p className={styles.bravo}>Félicitations, tu as découvert toutes ses anecdotes !</p>
          )
        )}
        {nouveauFragment ? (
          <>
            <Link className={styles.codex} to="/codex">
              Voir dans le Codex →
            </Link>
            <button ref={fiche} type="button" className={styles.fiche} onClick={fermer}>
              Voir sa fiche
            </button>
          </>
        ) : (
          <button ref={fiche} type="button" className={styles.codex} onClick={fermer}>
            Voir sa fiche →
          </button>
        )}
        {boutique && (
          <a className={styles.acquerir} href={boutique} target="_blank" rel="noreferrer">
            Acquérir ce Fragment pour ouvrir son histoire
          </a>
        )}
      </div>
    </dialog>
  )
}
