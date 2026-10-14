/**
 * QUOI     — l'éditeur d'une culture (tiroir) : nom, titre, phrase de zone, présentation, couleur, icône,
 *            active, et la carte où l'on dessine les cercles où elle s'éveille.
 * POURQUOI — une culture active qui ne s'éveille nulle part est refusée avant l'envoi. Une nouvelle icône
 *            est envoyée tout de suite, mais l'ancienne n'est retirée du bucket qu'une fois l'enregistrement
 *            réussi (sinon la culture pointerait vers un fichier disparu).
 */
import { useState, type CSSProperties, type SyntheticEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { couleurValide } from '@/shared/lib/couleur'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Cercle, CultureDuHub } from '@/shared/cultures/api'
import { useCulturesDuHub } from '@/shared/cultures/useCulturesDuHub'
import { useEcritureCulture } from '../hooks/useCultures'
import { useIconeEnvoyee } from '../hooks/useIconeEnvoyee'
import { CarteDesCercles } from './CarteDesCercles'
import styles from './Jeu.module.css'
import { IconeDeCulture } from './IconeDeCulture'
import cultures from './Cultures.module.css'

const LISTE = '/jeu/cultures'
const BUCKET = 'tag-icons'
const TYPES_D_ICONE = ['image/svg+xml', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/webp': 'webp' }

function Formulaire({ fiche }: { fiche: CultureDuHub }) {
  const ecriture = useEcritureCulture()
  const [label, setLabel] = useState(fiche.label)
  const [complement, setComplement] = useState(fiche.complement ?? '')
  const [zone, setZone] = useState(fiche.zone ?? '')
  const [presentation, setPresentation] = useState(fiche.presentation ?? '')
  const [couleur, setCouleur] = useState(fiche.couleur ?? '')
  const [active, setActive] = useState(fiche.active)
  const [cercles, setCercles] = useState<Cercle[]>(fiche.cercles)
  const [refus, setRefus] = useState<string | null>(null)
  const { icone, envoiEnCours, refus: refusIcone, choisir, apresEnregistrement } = useIconeEnvoyee(BUCKET, fiche.icone)
  const couleurChoisie = couleurValide(couleur) ? couleur : null

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    ecriture.reset()
    setRefus(null)
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const erreur = !label.trim() ? 'Une culture a un nom.'
      : couleur !== (fiche.couleur ?? '') && couleur && !couleurValide(couleur) ? 'La couleur s’écrit #RRGGBB.'
        : active && cercles.length === 0 ? 'Une culture active doit s’éveiller quelque part : ajoute au moins un cercle.'
          : null
    setRefus(erreur)
    if (erreur) return
    ecriture.mutate(
      { id: fiche.id, label, couleur, icone, complement, zone, presentation, cercles, active, ordre: fiche.ordre },
      { onSuccess: apresEnregistrement },
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={modifie}>
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
          <span className={cultures.icone} style={{ '--couleur': couleurChoisie ?? 'transparent' } as CSSProperties} />
        </span>
      </label>
      <label className={styles.champ}>Icône
        <span className={cultures.apercu}>
          <IconeDeCulture icone={icone || null} couleur={couleurChoisie} />
          <input
            type="file" accept={TYPES_D_ICONE.join(',')} disabled={envoiEnCours}
            onChange={(e) => void choisir(e, { types: TYPES_D_ICONE }, (f) => `cultures/${fiche.id}-${String(Date.now())}.${EXTENSIONS[f.type] ?? 'png'}`)}
          />
        </span>
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked) }} /> Active
      </label>

      <CarteDesCercles couleur={couleurChoisie} cercles={cercles} eveils={fiche.eveils} onChange={(suivants) => { setCercles(suivants); modifie() }} />

      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && <span role="status"> Enregistré.</span>}
        {(refus ?? refusIcone) && <p role="alert">{refus ?? refusIcone}</p>}
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
