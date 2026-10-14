/**
 * QUOI     — l'éditeur d'une culture (tiroir) : nom, titre, phrase de zone, présentation, couleur, icône,
 *            active, et la carte où l'on dessine les cercles où elle s'éveille.
 * POURQUOI — une culture active qui ne s'éveille nulle part est refusée avant l'envoi. Une nouvelle icône
 *            est envoyée tout de suite, mais l'ancienne n'est retirée du bucket qu'une fois l'enregistrement
 *            réussi (sinon la culture pointerait vers un fichier disparu).
 */
import { useState, type CSSProperties, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { envoyerFichier, retirerFichier, verifierFichier } from '@/shared/lib/envoi'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { CultureDuHub } from '../api/cultures'
import { useCulturesDuHub, useEcritureCulture } from '../hooks/useCultures'
import type { Cercle } from '../lib/cercle'
import { CarteDesCercles } from './CarteDesCercles'
import styles from './Jeu.module.css'
import { IconeDeCulture } from './IconeDeCulture'
import cultures from './Cultures.module.css'

const LISTE = '/jeu/cultures'
const BUCKET = 'tag-icons'
const TYPES_D_ICONE = ['image/svg+xml', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/webp': 'webp' }
const COULEUR = /^#[0-9a-fA-F]{6}$/

function Formulaire({ fiche }: { fiche: CultureDuHub }) {
  const ecriture = useEcritureCulture()
  const [label, setLabel] = useState(fiche.label)
  const [complement, setComplement] = useState(fiche.complement ?? '')
  const [zone, setZone] = useState(fiche.zone ?? '')
  const [presentation, setPresentation] = useState(fiche.presentation ?? '')
  const [couleur, setCouleur] = useState(fiche.couleur ?? '')
  const [icone, setIcone] = useState(fiche.icone ?? '')
  const [active, setActive] = useState(fiche.active)
  const [cercles, setCercles] = useState<Cercle[]>(fiche.cercles)
  const [refus, setRefus] = useState<string | null>(null)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    ecriture.reset()
    setRefus(null)
  }

  async function choisirIcone(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    const erreur = verifierFichier(fichier, { types: TYPES_D_ICONE })
    setRefus(erreur)
    if (erreur) return
    try {
      const adresse = await envoyerFichier(BUCKET, `cultures/${fiche.id}-${String(Date.now())}.${EXTENSIONS[fichier.type] ?? 'png'}`, fichier)
      // Une icône envoyée puis remplacée avant d'enregistrer n'est référencée par personne : on la retire.
      if (icone && icone !== fiche.icone) await retirerFichier(BUCKET, icone).catch(() => undefined)
      setIcone(adresse)
      ecriture.reset()
    } catch (err) {
      setRefus(err instanceof Error ? err.message : 'L’envoi a échoué.')
    }
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const erreur = !label.trim() ? 'Une culture a un nom.'
      : couleur !== (fiche.couleur ?? '') && couleur && !COULEUR.test(couleur) ? 'La couleur s’écrit #RRGGBB.'
        : active && cercles.length === 0 ? 'Une culture active doit s’éveiller quelque part : ajoute au moins un cercle.'
          : null
    setRefus(erreur)
    if (erreur) return
    ecriture.mutate(
      { id: fiche.id, label, couleur, icone, complement, zone, presentation, cercles, active, ordre: fiche.ordre },
      { onSuccess: () => { if (fiche.icone && fiche.icone !== icone) void retirerFichier(BUCKET, fiche.icone).catch(() => undefined) } },
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={(e) => {
      // Le refus d'un fichier vient du champ lui-même : l'événement qui remonte ne l'efface pas.
      if (!(e.target instanceof HTMLInputElement && e.target.type === 'file')) modifie()
    }}>
      <label className={styles.champ}>Nom
        <input value={label} onChange={(e) => { setLabel(e.target.value) }} />
      </label>
      <label className={styles.champ}>Complément de titre (« Sage … »)
        <input value={complement} onChange={(e) => { setComplement(e.target.value) }} />
      </label>
      <label className={styles.champ}>Où elle s’éveille
        <input value={zone} onChange={(e) => { setZone(e.target.value) }} />
      </label>
      <label className={styles.champ}>En quelques mots
        <textarea rows={4} value={presentation} onChange={(e) => { setPresentation(e.target.value) }} />
      </label>
      <label className={styles.champ}>Couleur
        <span className={cultures.apercu}>
          <input value={couleur} placeholder="#RRGGBB" onChange={(e) => { setCouleur(e.target.value) }} />
          <span className={cultures.icone} style={{ '--couleur': COULEUR.test(couleur) ? couleur : 'transparent' } as CSSProperties} />
        </span>
      </label>
      <label className={styles.champ}>Icône
        <span className={cultures.apercu}>
          <IconeDeCulture icone={icone || null} couleur={COULEUR.test(couleur) ? couleur : null} />
          <input type="file" accept={TYPES_D_ICONE.join(',')} onChange={(e) => void choisirIcone(e)} />
        </span>
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked) }} /> Active
      </label>

      <CarteDesCercles couleur={COULEUR.test(couleur) ? couleur : null} cercles={cercles} eveils={fiche.eveils} onChange={(suivants) => { setCercles(suivants); modifie() }} />

      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && <span role="status"> Enregistré.</span>}
        {refus && <p role="alert">{refus}</p>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>
    </form>
  )
}

export function TiroirCulture() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useCulturesDuHub()

  if (isPending) {
    return <Tiroir titre="Culture" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Culture" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  const fiche = data.find((c) => c.id === id)
  if (!fiche) {
    return (
      <Tiroir titre="Culture introuvable" retour={retour}>
        <p>Culture introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'une culture à l'autre.
  return <Tiroir titre={fiche.label} retour={retour}><Formulaire key={fiche.id} fiche={fiche} /></Tiroir>
}
