/**
 * QUOI     — « Mises à jour » : les notes de version que les joueurs lisent dans « Nouveautés » d'Explore, de la plus
 *            récente à la plus ancienne (titre, date, version, cœurs et mots des joueurs) ; « + Nouvelle mise à jour »
 *            et chaque ligne ouvrent l'éditeur par-dessus (route enfant).
 * POURQUOI — écrites pour les joueurs : jamais de détail technique. La ligne garde la recherche de la liste dans
 *            son lien (le tiroir revient à la liste telle qu'on l'a quittée).
 */
import { Link, Outlet, useLocation } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { pluriel } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { MiseAJour } from '../api/misesAJour'
import { useMisesAJour } from '../hooks/useMisesAJour'
import styles from './Joueurs.module.css'

function LigneDeMiseAJour({ note }: { note: MiseAJour }) {
  const { search } = useLocation()
  return (
    <Link className={styles.ligne} to={{ pathname: String(note.id), search }}>
      <span className={styles.titreDeLigne}>{note.titre}</span>
      <span className={styles.etiquettes}>
        {note.version && <Balise texte={note.version} teinte="nouveau" />}
        <span>{dateCourte(note.quand)}</span>
        <span>{note.coeurs} {pluriel(note.coeurs, 'cœur')} · {note.mots} {pluriel(note.mots, 'mot')}</span>
      </span>
    </Link>
  )
}

export function MisesAJour() {
  const { data, error } = useMisesAJour()
  const { search } = useLocation()
  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Parler aux joueurs"
        titre="Mises à jour"
        phrase="Les notes de version que les joueurs lisent dans « Nouveautés » d’Explore."
        aDroite={<Link className={styles.boutonContour} to={{ pathname: 'nouvelle', search }}>+ Nouvelle mise à jour</Link>}
      />
      <TitreDeSection titre="Déjà publiées" />
      {error && <p role="alert" className={styles.erreur}>Les mises à jour n’ont pas pu se charger : {error.message}</p>}
      {data?.length === 0 && <p className={styles.calme}>Aucune mise à jour publiée.</p>}
      {data && data.length > 0 && <Bloc>{data.map((m) => <LigneDeMiseAJour key={m.id} note={m} />)}</Bloc>}
      <Outlet />
    </div>
  )
}
