/**
 * QUOI     — « Sur les chemins » (maquette 27:2) : le fil de la communauté — qui a visité, ajouté
 *            un lieu, rejoint les Explorateurs — et son seul geste, Saluer (le cœur).
 * POURQUOI — spec V2 §5 : pas de commentaires, pas d'émojis ; un salut et son compteur. On ne
 *            salue pas sa propre ligne : le compteur s'y lit sans bouton. Un nom ouvre le profil,
 *            un lieu sa fiche — dans l'Accueil, qui reste derrière. Cinq lignes d'abord, le reste
 *            sur demande ; sans salut, le cœur est seul (un « 0 » découragerait). Le cœur plutôt
 *            que la feuille de chêne : compris de tous (Uriel, 28/09). On salue à volonté : chaque
 *            toucher fait s'envoler un petit cœur, pour qu'une rafale devienne une armée.
 */
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import cheminVisite from '@/assets/ui/chemin-visite.svg'
import lieuIcone from '@/assets/ui/lieu.svg'
import sectionChemins from '@/assets/ui/section-chemins.svg'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { Avatar } from '@/shared/ui/Avatar'
import type { Chemin } from '../api/lireAccueil'
import { useChemins } from '../hooks/useAccueil'
import { useSaluer } from '../hooks/useSaluer'
import { ilYA } from '@/shared/lib/ilYA'
import { BilleType } from './BilleType'
import styles from './SurLesChemins.module.css'

const ICONES = { visite: cheminVisite, ajout: lieuIcone, arrivee: cheminArrivee }
const VERBES = { visite: 'a visité', ajout: 'a ajouté', arrivee: 'a rejoint les Explorateurs' }
const D_ABORD = 5

export function SurLesChemins() {
  const { chemins } = useChemins()
  const saluer = useSaluer()
  const [tout, setTout] = useState(false)
  if (!chemins || chemins.length === 0) return null
  const visibles = tout ? chemins : chemins.slice(0, D_ABORD)
  return (
    <section className={styles.chemins} aria-label="Sur les chemins">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionChemins} alt="" />
        Sur les chemins
      </h2>
      <ul className={styles.fil} aria-label="Sur les chemins">
        {visibles.map((c) => (
          <Ligne key={c.id} chemin={c} onSaluer={saluer} />
        ))}
      </ul>
      {visibles.length < chemins.length && (
        <button
          type="button"
          className={styles.plus}
          onClick={() => {
            setTout(true)
          }}
        >
          Afficher plus
        </button>
      )}
    </section>
  )
}

function Ligne({ chemin, onSaluer }: { chemin: Chemin; onSaluer: (id: string) => void }) {
  const { qui, lieu } = chemin
  const ou = [lieu?.region, ilYA(chemin.quand)].filter(Boolean).join(', ')
  // Les cœurs en vol : chacun disparaît à la fin de son envol.
  const [envols, setEnvols] = useState<number[]>([])
  const prochain = useRef(0)
  return (
    <li className={styles.ligne}>
      {chemin.type === 'ajout' && lieu?.type ? (
        // Un lieu ajouté : la bille de son type (Uriel, 29/09).
        <span className={styles.bille}>
          <BilleType icone={lieu.type.icone} couleur={lieu.type.couleur} />
        </span>
      ) : (
        <img className={styles.type} src={ICONES[chemin.type]} alt="" />
      )}
      <Avatar url={qui.avatar} nom={qui.nom} taille="mini" />
      <p className={styles.texte}>
        <Link className={styles.qui} to={`/accueil/explorateur/${qui.id}`} state={VENU_D_UN_ECRAN}>
          {qui.nom}
        </Link>{' '}
        {VERBES[chemin.type]}
        {lieu && (
          <>
            {' '}
            <Link className={styles.lieu} to={`/accueil/lieu/${lieu.id}`} state={VENU_D_UN_ECRAN}>
              {lieu.nom}
            </Link>
          </>
        )}
        <span className={styles.ou}>{ou}</span>
      </p>
      {chemin.moi ? (
        chemin.saluts > 0 && (
          <span className={styles.salut}>
            <span className={styles.coeur} aria-hidden="true" />
            {chemin.saluts}
          </span>
        )
      ) : (
        <button
          type="button"
          className={styles.salut}
          aria-pressed={chemin.salue}
          aria-label={`Saluer ${qui.nom} (${String(chemin.saluts)})`}
          onClick={() => {
            onSaluer(chemin.id)
            const n = prochain.current++
            setEnvols((avant) => [...avant, n])
          }}
        >
          <span className={styles.coeur} aria-hidden="true" />
          {chemin.saluts > 0 && chemin.saluts}
          {envols.map((n) => (
            <span
              key={n}
              className={styles.envol}
              data-envol
              aria-hidden="true"
              onAnimationEnd={() => {
                setEnvols((avant) => avant.filter((e) => e !== n))
              }}
            />
          ))}
        </button>
      )}
    </li>
  )
}
