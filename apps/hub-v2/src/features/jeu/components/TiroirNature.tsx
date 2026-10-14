/**
 * QUOI     — l'éditeur d'une nature (tiroir) : nom, couleurs, icône SVG, ordre, « hors époque ». À la création,
 *            l'identifiant se tire du nom (modifiable avant d'enregistrer, jamais après).
 * POURQUOI — pas de suppression : une nature porte des lieux. Une nouvelle icône est envoyée tout de suite, mais
 *            l'ancienne n'est retirée du bucket qu'une fois l'enregistrement réussi.
 */
import { useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { envoyerFichier, retirerFichier, verifierFichier } from '@/shared/lib/envoi'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Nature } from '../api/natures'
import { useEcritureNature, useNatures } from '../hooks/useNatures'
import { COULEUR, COULEURS_PAR_DEFAUT, slugDe } from '../lib/nature'
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
  const [icone, setIcone] = useState(fiche?.icon ?? '')
  const [ordre, setOrdre] = useState(String(fiche?.order ?? Math.max(0, ...toutes.map((n) => n.order)) + 1))
  const [horsEpoque, setHorsEpoque] = useState(fiche?.hors_epoque ?? false)
  const [refus, setRefus] = useState<string | null>(null)
  const identifiant = fiche?.id ?? identifiantSaisi ?? slugDe(titre)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    ecriture.reset()
    setRefus(null)
  }

  async function choisirIcone(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    const erreur = verifierFichier(fichier, { types: ['image/svg+xml'] }) ?? (identifiant ? null : 'Donne d’abord un nom à la nature.')
    setRefus(erreur)
    if (erreur) return
    try {
      const adresse = await envoyerFichier(BUCKET, `${identifiant}-${String(Date.now())}.svg`, fichier)
      // Une icône envoyée puis remplacée avant d'enregistrer n'est référencée par personne : on la retire.
      if (icone && icone !== fiche?.icon) await retirerFichier(BUCKET, icone).catch(() => undefined)
      setIcone(adresse)
      ecriture.reset()
    } catch (err) {
      setRefus(err instanceof Error ? err.message : 'L’envoi a échoué.')
    }
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const rang = Number(ordre)
    const erreur = !titre.trim() ? 'Une nature a un nom.'
      : !fiche && !identifiant ? 'L’identifiant ne peut pas être vide.'
        : !fiche && toutes.some((n) => n.id === identifiant) ? 'Cet identifiant est déjà pris.'
          : !COULEUR.test(couleur) || !COULEUR.test(fond) ? 'Les couleurs s’écrivent #RRGGBB.'
            : ordre.trim() === '' || !Number.isInteger(rang) ? 'L’ordre est un nombre entier.'
              : null
    setRefus(erreur)
    if (erreur) return
    ecriture.mutate(
      { id: identifiant, creation: !fiche, nature: { title: titre.trim(), color: couleur, background: fond, icon: icone || null, order: rang, hors_epoque: horsEpoque } },
      {
        onSuccess: () => {
          if (fiche?.icon && fiche.icon !== icone) void retirerFichier(BUCKET, fiche.icon).catch(() => undefined)
          if (!fiche) void naviguer({ pathname: `${LISTE}/${identifiant}`, search })
        },
      },
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={(e) => {
      // Le refus d'un fichier vient du champ lui-même : l'événement qui remonte ne l'efface pas.
      if (!(e.target instanceof HTMLInputElement && e.target.type === 'file')) modifie()
    }}>
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
          <input type="file" accept="image/svg+xml" onChange={(e) => void choisirIcone(e)} />
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
        {refus && <p role="alert">{refus}</p>}
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
