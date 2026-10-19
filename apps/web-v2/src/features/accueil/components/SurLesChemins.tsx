/**
 * QUOI     — « Sur les chemins » (maquette 27:2) : le fil des lieux — qui a visité, ajouté,
 *            revendiqué, enrichi un lieu —, qui a fondé ou rejoint une Compagnie (mig 425), qui a rejoint EXPLORE (un moment de bienvenue, Uriel
 *            05/10), et son seul geste, Saluer (le cœur).
 * POURQUOI — spec V2 §5 : pas de commentaires, pas d'émojis ; un salut et son compteur. On ne
 *            salue pas sa propre ligne : le compteur s'y lit sans bouton. Un nom ouvre le profil,
 *            un lieu sa fiche — dans l'Accueil, qui reste derrière. Cinq lignes ; « Voir toute
 *            l'activité » ouvre le fil entier dans le tiroir (Uriel, 29/09) ; sans salut, le cœur est seul (un « 0 » découragerait). Le cœur plutôt
 *            que la feuille de chêne : compris de tous (Uriel, 28/09). On salue à volonté : chaque
 *            toucher fait s'envoler un petit cœur, pour qu'une rafale devienne une armée. Sous le
 *            titre, le filtre Lieux · Gens · Énigmes (Uriel, 11/10). Les souvenirs (« J'y suis
 *            allé », mig 531) : « Marie ajoute 12 souvenirs », avec leurs photos (maquette 649:2092).
 */
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import cheminVisite from '@/assets/ui/chemin-visite.svg'
import drapeau from '@/assets/ui/drapeau.svg'
import plume from '@/assets/ui/plume.svg'
import lieuIcone from '@/assets/ui/lieu.svg'
import compagnieIcone from '@/assets/ui/onglet-compagnies.svg'
import enigmeIcone from '@/assets/ui/menu-enigmes.svg'
import sectionChemins from '@/assets/ui/section-chemins.svg'
import { Avatar } from '@/shared/ui/Avatar'
import type { Chemin } from '../api/lireAccueil'
import { useChemins } from '../hooks/useAccueil'
import { useFamilles } from '../hooks/useFamilles'
import { useSaluer } from '../hooks/useSaluer'
import { filtrerChemins } from '../lib/familles'
import { FiltreDesChemins } from './FiltreDesChemins'
import { ilYA } from '@/shared/lib/ilYA'
import { aLaTaille } from '@/shared/lib/image'
import { BilleType } from '@/shared/ui/BilleType'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Envols } from '@/shared/ui/Envols'
import styles from './SurLesChemins.module.css'

const ICONES = {
  visite: cheminVisite,
  ajout: lieuIcone,
  arrivee: cheminArrivee,
  revendication: drapeau,
  enrichi: plume,
  modifie: plume,
  fondation: compagnieIcone,
  adhesion: compagnieIcone,
  enigme: enigmeIcone,
  souvenir: cheminVisite,
}
// Les phrases d'Uriel (01/10).
const VERBES = {
  visite: 'a visité',
  ajout: 'a ajouté',
  arrivee: 'a rejoint EXPLORE !',
  revendication: 'vient de revendiquer',
  enrichi: 'a enrichi',
  modifie: 'a modifié', // le nom, la nature ou l'époque (mig 415)
  fondation: 'a fondé',
  adhesion: 'a rejoint',
  enigme: 'a percé une énigme',
  souvenir: 'ajoute 1 souvenir',
}

// Une ligne de souvenirs (531) dit combien ; le lieu ne se nomme que s'il est seul (Uriel, 19/10).
function verbe(chemin: Chemin): string {
  if (chemin.type === 'enigme' && chemin.nombre > 1)
    return `a percé ${String(chemin.nombre)} énigmes`
  if (chemin.type === 'souvenir' && chemin.nombre > 1)
    return `ajoute ${String(chemin.nombre)} souvenirs`
  return VERBES[chemin.type]
}
const D_ABORD = 5

export function SurLesChemins() {
  const { chemins } = useChemins()
  const { allumees, basculer } = useFamilles()
  if (!chemins || chemins.length === 0) return null
  const montres = filtrerChemins(chemins, allumees)
  return (
    <section className={styles.chemins} aria-label="Sur les chemins">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionChemins} alt="" />
        Sur les chemins
      </h2>
      <FiltreDesChemins allumees={allumees} onBasculer={basculer} />
      <FilDesChemins chemins={montres.slice(0, D_ABORD)} />
      {montres.length > D_ABORD && (
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
  const { qui, compagnie, culture } = chemin
  const souvenirs = chemin.type === 'souvenir'
  // Des souvenirs : un seul se nomme dessous, plusieurs se montrent en photos, chacune vers sa fiche.
  const lieu = souvenirs ? null : chemin.lieu
  const ou = souvenirs
    ? [chemin.nombre === 1 ? chemin.lieu?.nom : null, ilYA(chemin.quand)]
        .filter(Boolean)
        .join(' · ')
    : [lieu?.region, ilYA(chemin.quand)].filter(Boolean).join(', ')
  const enPlus = chemin.nombre - chemin.vignettes.length
  const { envols, lancer, finir } = useEnvols()
  return (
    <li
      className={styles.ligne}
      style={culture?.couleur ? { '--couleur-culture': culture.couleur } : undefined}
    >
      {chemin.type === 'ajout' && lieu?.type ? (
        // Un lieu ajouté : la bille de son type (Uriel, 29/09).
        <span className={styles.bille}>
          <BilleType icone={lieu.type.icone} couleur={lieu.type.couleur} />
        </span>
      ) : culture?.icone ? (
        // Une énigme percée : le logo de sa culture, peint à sa couleur (Uriel, 07/10).
        <span className={styles.logo} style={{ '--icone': `url("${culture.icone}")` }} />
      ) : (
        <img className={styles.type} src={ICONES[chemin.type]} alt="" />
      )}
      <Avatar url={qui.avatar} nom={qui.nom} taille="mini" />
      <p className={styles.texte}>
        <Link className={styles.qui} to={`/accueil/explorateur/${qui.id}`}>
          {qui.nom}
        </Link>{' '}
        {verbe(chemin)}
        {culture && (
          <>
            {/* La culture, jamais la question ni la réponse (pas de spoiler) ; elle mène à « Les énigmes ». */}
            {' · '}
            <Link className={styles.culture} to={`/accueil/enigmes/${culture.id}`}>
              {culture.nom}
            </Link>
          </>
        )}
        {lieu && (
          <>
            {' '}
            <Link className={styles.lieu} to={`/accueil/lieu/${lieu.id}`}>
              {lieu.nom}
            </Link>
          </>
        )}
        {compagnie && (
          <>
            {/* Une revendication pour sa Compagnie : « … Château de Joux pour Le Lys de Fer ». */}
            {lieu ? ' pour ' : ' '}
            <Link className={styles.lieu} to={`/accueil/compagnie/${compagnie.id}`}>
              {compagnie.nom}
            </Link>
          </>
        )}
        <span className={styles.ou}>{ou}</span>
        {souvenirs && chemin.nombre > 1 && chemin.vignettes.length > 0 && (
          <span className={styles.photos}>
            {chemin.vignettes.map(({ lieu, nom, url }) => (
              <Link key={lieu} to={`/accueil/lieu/${lieu}`}>
                <img src={aLaTaille(url, 44)} alt={nom} loading="lazy" />
              </Link>
            ))}
            {enPlus > 0 && <span className={styles.enPlus}>+{enPlus}</span>}
          </span>
        )}
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
