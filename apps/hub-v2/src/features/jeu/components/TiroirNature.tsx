/**
 * QUOI     — l'éditeur d'une nature (tiroir) : nom, couleurs, icône SVG, ordre, « hors époque ». À la création,
 *            l'identifiant se tire du nom (modifiable avant d'enregistrer, jamais après).
 * POURQUOI — pas de suppression : une nature porte des lieux. Une nouvelle icône est envoyée tout de suite, mais
 *            l'ancienne n'est retirée du bucket qu'une fois l'enregistrement réussi.
 */
import { useState, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { couleurValide } from '@/shared/lib/couleur'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Nature } from '../api/natures'
import { useIconeEnvoyee } from '../hooks/useIconeEnvoyee'
import { useEcritureNature, useNatures } from '../hooks/useNatures'
import { COULEURS_PAR_DEFAUT, IDENTIFIANTS_RESERVES, slugDe } from '../lib/nature'
import styles from './Jeu.module.css'
import natures from './Natures.module.css'
import { PastilleDeNature } from './PastilleDeNature'

const LISTE = '/jeu/natures'
const BUCKET = 'tag-icons'

function Formulaire({ fiche, toutes }: { fiche: Nature | null; toutes: Nature[] }) {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const ecriture = useEcritureNature()
  const [titre, setTitre] = useState(fiche?.title ?? '')
  // Tant qu'on n'a pas touché à l'identifiant, il suit le nom.
  const [identifiantSaisi, setIdentifiantSaisi] = useState<string | null>(null)
  const [couleur, setCouleur] = useState(fiche?.color ?? COULEURS_PAR_DEFAUT.texte)
  const [fond, setFond] = useState(fiche?.background ?? COULEURS_PAR_DEFAUT.fond)
  const [ordre, setOrdre] = useState(String(fiche?.order ?? Math.max(0, ...toutes.map((n) => n.order)) + 1))
  const [horsEpoque, setHorsEpoque] = useState(fiche?.hors_epoque ?? false)
  const [refus, setRefus] = useState<string | null>(null)
  const { icone, envoiEnCours, refus: refusIcone, choisir, apresEnregistrement } = useIconeEnvoyee(BUCKET, fiche?.icon ?? null)
  const identifiant = fiche?.id ?? identifiantSaisi ?? slugDe(titre)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    ecriture.reset()
    setRefus(null)
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const rang = Number(ordre)
    const erreur = !titre.trim() ? 'Une nature a un nom.'
      : !fiche && !identifiant ? 'L’identifiant ne peut pas être vide.'
        : !fiche && IDENTIFIANTS_RESERVES.includes(identifiant) ? 'Cet identifiant est réservé.'
          : !fiche && toutes.some((n) => n.id === identifiant) ? 'Cet identifiant est déjà pris.'
            : !couleurValide(couleur) || !couleurValide(fond) ? 'Les couleurs s’écrivent #RRGGBB.'
              : ordre.trim() === '' || !Number.isInteger(rang) ? 'L’ordre est un nombre entier.'
                : null
    setRefus(erreur)
    if (erreur) return
    ecriture.mutate(
      { id: identifiant, creation: !fiche, nature: { title: titre.trim(), color: couleur, background: fond, icon: icone || null, order: rang, hors_epoque: horsEpoque } },
      {
        onSuccess: () => {
          apresEnregistrement()
          if (!fiche) void naviguer({ pathname: `${LISTE}/${identifiant}`, search })
        },
      },
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={modifie}>
      <label className={styles.champ}>Nom
        <input value={titre} onChange={(e) => { setTitre(e.target.value) }} />
      </label>
      {!fiche && (
        <label className={styles.champ}>Identifiant
          <input value={identifiant} onChange={(e) => { setIdentifiantSaisi(e.target.value) }} />
        </label>
      )}
      <label className={styles.champ}>Couleur du texte
        <input value={couleur} placeholder="#RRGGBB" onChange={(e) => { setCouleur(e.target.value) }} />
      </label>
      <label className={styles.champ}>Couleur du fond
        <input value={fond} placeholder="#RRGGBB" onChange={(e) => { setFond(e.target.value) }} />
      </label>
      <label className={styles.champ}>Icône SVG
        <span className={natures.apercu}>
          <PastilleDeNature icone={icone || null} couleur={couleur} fond={fond} />
          {/* Le nom de fichier vient de l'identifiant : sans nom, pas d'envoi. */}
          <input
            type="file" accept="image/svg+xml" disabled={envoiEnCours || !identifiant}
            onChange={(e) => void choisir(e, { types: ['image/svg+xml'] }, () => `${identifiant}-${String(Date.now())}.svg`)}
          />
        </span>
      </label>
      <label className={styles.champ}>Ordre
        <input type="number" value={ordre} onChange={(e) => { setOrdre(e.target.value) }} />
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={horsEpoque} onChange={(e) => { setHorsEpoque(e.target.checked) }} /> Hors époque
      </label>

      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && fiche && <span role="status"> Enregistré.</span>}
        {(refus ?? refusIcone) && <p role="alert">{refus ?? refusIcone}</p>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>
    </form>
  )
}

export function TiroirNature() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useNatures()

  if (isPending) {
    return <Tiroir titre="Nature" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Nature" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (id === undefined) return <Tiroir titre="Nouvelle nature" retour={retour}><Formulaire toutes={data} fiche={null} /></Tiroir>
  const fiche = data.find((n) => n.id === id)
  if (!fiche) {
    return (
      <Tiroir titre="Nature introuvable" retour={retour}>
        <p>Nature introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'une nature à l'autre.
  return <Tiroir titre={fiche.title} retour={retour}><Formulaire key={fiche.id} fiche={fiche} toutes={data} /></Tiroir>
}
