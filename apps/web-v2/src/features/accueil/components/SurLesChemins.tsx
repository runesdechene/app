/**
 * QUOI     — « Sur les chemins » (maquette 27:2) : le fil de la communauté — qui a visité, ajouté,
 *            revendiqué, enrichi un lieu, rejoint EXPLORE, vient de se connecter — et son seul
 *            geste, Saluer (le cœur).
 * POURQUOI — spec V2 §5 : pas de commentaires, pas d'émojis ; un salut et son compteur. On ne
 *            salue pas sa propre ligne : le compteur s'y lit sans bouton. Un nom ouvre le profil,
 *            un lieu sa fiche — dans l'Accueil, qui reste derrière. Cinq lignes ; « Voir toute
 *            l'activité » ouvre le fil entier dans le tiroir (Uriel, 29/09) ; sans salut, le cœur est seul (un « 0 » découragerait). Le cœur plutôt
 *            que la feuille de chêne : compris de tous (Uriel, 28/09). On salue à volonté : chaque
 *            toucher fait s'envoler un petit cœur, pour qu'une rafale devienne une armée.
 */
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import cheminVisite from '@/assets/ui/chemin-visite.svg'
import drapeau from '@/assets/ui/drapeau.svg'
import pas from '@/assets/ui/pas.svg'
import plume from '@/assets/ui/plume.svg'
import lieuIcone from '@/assets/ui/lieu.svg'
import sectionChemins from '@/assets/ui/section-chemins.svg'
import { Avatar } from '@/shared/ui/Avatar'
import type { Chemin } from '../api/lireAccueil'
import { useChemins } from '../hooks/useAccueil'
import { useSaluer } from '../hooks/useSaluer'
import { ilYA } from '@/shared/lib/ilYA'
import { BilleType } from '@/shared/ui/BilleType'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Envols } from '@/shared/ui/Envols'
import styles from './SurLesChemins.module.css'

const ICONES = {
  visite: cheminVisite,
  ajout: lieuIcone,
  arrivee: cheminArrivee,
  connexion: pas,
  revendication: drapeau,
  enrichi: plume,
}
// Les phrases d'Uriel (01/10) : une arrivée appelle la bienvenue.
const VERBES = {
  visite: 'a visité',
  ajout: 'a ajouté',
  arrivee: 'a rejoint EXPLORE ! Souhaite-lui la bienvenue !',
  connexion: 'vient de se connecter',
  revendication: 'vient de revendiquer',
  enrichi: 'a enrichi',
}
const D_ABORD = 5

export function SurLesChemins() {
  const { chemins } = useChemins()
  if (!chemins || chemins.length === 0) return null
  return (
    <section className={styles.chemins} aria-label="Sur les chemins">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionChemins} alt="" />
        Sur les chemins
      </h2>
      <FilDesChemins chemins={chemins.slice(0, D_ABORD)} />
      {chemins.length > D_ABORD && (
        <Link className={styles.tout} to="/accueil/chemins">
          Voir toute l’activité
        </Link>
      )}
    </section>
  )
}

// Le fil lui-même, sur l'Accueil (cinq lignes) comme dans sa page (toutes).
export function FilDesChemins({ chemins }: { chemins: Chemin[] }) {
  const saluer = useSaluer()
  return (
    <ul className={styles.fil} aria-label="Sur les chemins">
      {chemins.map((c) => (
        <Ligne key={c.id} chemin={c} onSaluer={saluer} />
      ))}
    </ul>
  )
}

function Ligne({ chemin, onSaluer }: { chemin: Chemin; onSaluer: (id: string) => void }) {
  const { qui, lieu } = chemin
  const ou = [lieu?.region, ilYA(chemin.quand)].filter(Boolean).join(', ')
  const { envols, lancer, finir } = useEnvols()
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
        <Link className={styles.qui} to={`/accueil/explorateur/${qui.id}`}>
          {qui.nom}
        </Link>{' '}
        {VERBES[chemin.type]}
        {lieu && (
          <>
            {' '}
            <Link className={styles.lieu} to={`/accueil/lieu/${lieu.id}`}>
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
            lancer()
          }}
        >
          <span className={styles.coeur} aria-hidden="true" />
          {chemin.saluts > 0 && chemin.saluts}
          <Envols envols={envols} onFin={finir} />
        </button>
      )}
    </li>
  )
}
