/**
 * QUOI     — « Ses anecdotes » : après un scan, la nouvelle en tête et « Creuser encore » (2 énergies) ;
 *            puis celles trouvées, chacune avec son insigne ; ce qui reste à découvrir ; depuis le
 *            Codex, « Scanner ce motif ».
 * POURQUOI — spec du Codex (02/11) : une anecdote gratuite par motif et par jour, une de plus pour 2
 *            énergies, sur place seulement. Le Porteur les gagne aussi en scannant.
 */
import { Link } from 'react-router'
import eclair from '@/assets/ui/eclair.svg'
import scanner from '@/assets/ui/scanner.svg'
import { Insigne } from '@/shared/ui/Insigne'
import type { AnecdoteTrouvee } from '../api/lireMonFragment'
import type { Tirage } from '../api/lireTirage'
import styles from './Anecdotes.module.css'

function Carte({ anecdote, nouvelle = false }: { anecdote: AnecdoteTrouvee; nouvelle?: boolean }) {
  return (
    <li
      className={styles.anecdote}
      data-rarete={anecdote.rarete}
      data-nouvelle={nouvelle || undefined}
    >
      <span className={styles.tete}>
        <Insigne rarete={anecdote.rarete} avecLibelle />
        {nouvelle && <span className={styles.neuve}>· ta nouvelle anecdote</span>}
      </span>
      <p className={styles.texte}>{anecdote.texte}</p>
    </li>
  )
}

function phraseDuReste(restantes: number, raresRestantes: number): string {
  if (restantes === 0) return 'Tu connais toutes ses anecdotes.'
  const rares =
    raresRestantes > 0
      ? `, dont ${String(raresRestantes)} rare${raresRestantes > 1 ? 's' : ''}`
      : ''
  return `${String(restantes)} anecdote${restantes > 1 ? 's' : ''} à découvrir${rares}.`
}

export function Anecdotes({
  anecdotes,
  restantes,
  raresRestantes,
  tirage,
  creuser,
  enCours,
  plusDEnergie,
}: {
  anecdotes: AnecdoteTrouvee[]
  restantes: number
  raresRestantes: number
  tirage: Tirage | null // le tirage de ce scan ; null depuis le Codex
  creuser: () => void
  enCours: boolean
  plusDEnergie: boolean
}) {
  const nouvelle = tirage?.anecdote ?? null
  // La nouvelle est en tête : on ne la répète pas dans la liste.
  const autres = nouvelle ? anecdotes.filter((a) => a.texte !== nouvelle.texte) : anecdotes
  const reste = tirage ? tirage.restantes : restantes
  const raresReste = tirage ? tirage.raresRestantes : raresRestantes
  return (
    <section className={styles.anecdotes} aria-labelledby="anecdotes">
      <h2 id="anecdotes" className={styles.titre}>
        Ses anecdotes
      </h2>
      {tirage?.raison === 'deja_aujourdhui' && (
        <p className={styles.aide}>
          Ton anecdote gratuite du jour est déjà trouvée : creuse encore, ou reviens demain.
        </p>
      )}
      <ul className={styles.liste}>
        {nouvelle && <Carte anecdote={nouvelle} nouvelle />}
        {autres.map((a) => (
          <Carte key={a.texte} anecdote={a} />
        ))}
      </ul>
      {tirage && reste > 0 && (
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
      )}
      {!tirage && reste > 0 && (
        <Link className={styles.creuser} to="/scan">
          <img src={scanner} alt="" />
          Scanner ce motif
        </Link>
      )}
      <p className={styles.reste}>
        {phraseDuReste(reste, raresReste)}
        {reste > 0 &&
          !tirage &&
          ' Ta prochaine anecdote gratuite : à ton prochain scan, une par jour.'}
      </p>
    </section>
  )
}
