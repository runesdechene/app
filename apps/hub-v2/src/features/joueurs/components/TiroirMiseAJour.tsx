/**
 * QUOI     — l'éditeur d'une mise à jour (tiroir) : titre (80), texte (3000, compteur), version, image, puis
 *            « Publier et prévenir les joueurs » (nouvelle) ou « Enregistrer » (existante), et « Supprimer »
 *            confirmée en ligne.
 * POURQUOI — publier envoie aussi une notification push aux joueurs abonnés : le bouton le dit. Enregistrer une
 *            note existante garde sa date et ne rallume pas la cloche. Le fichier choisi ne s'envoie qu'à l'enregistrement (aperçu local) ; l'ancien
 *            n'est retiré du bucket qu'ensuite. Une note supprimée quitte la liste même si le retrait
 *            de son image échoue : le tiroir garde alors la fiche pour montrer l'erreur.
 */
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { verifierFichier } from '@/shared/lib/envoi'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { MiseAJour } from '../api/misesAJour'
import { useEnregistrerMiseAJour, useMisesAJour, useSupprimerMiseAJour } from '../hooks/useMisesAJour'
import { estPubliable, REGLE_IMAGE, TEXTE_MAX, TITRE_MAX } from '../lib/miseAJour'
import styles from './Joueurs.module.css'

const LISTE = '/joueurs/mises-a-jour'

function Formulaire({ fiche, supprimee }: { fiche: MiseAJour | null; supprimee: boolean }) {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const enregistrer = useEnregistrerMiseAJour()
  const supprimer = useSupprimerMiseAJour()
  const [titre, setTitre] = useState(fiche?.titre ?? '')
  const [texte, setTexte] = useState(fiche?.texte ?? '')
  const [version, setVersion] = useState(fiche?.version ?? '')
  // Le fichier choisi ne part qu'à l'enregistrement ; son aperçu est libéré au changement et à la fermeture.
  const [choix, setChoix] = useState<{ fichier: File; apercu: string } | null>(null)
  const [retirer, setRetirer] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    if (!choix) return
    return () => { URL.revokeObjectURL(choix.apercu) }
  }, [choix])

  const image = choix?.apercu ?? (retirer ? null : fiche?.image ?? null)
  const occupe = enregistrer.isPending || supprimer.isPending

  function choisirImage(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    const erreur = verifierFichier(fichier, REGLE_IMAGE)
    setRefus(erreur)
    if (erreur) return
    setChoix({ fichier, apercu: URL.createObjectURL(fichier) })
    setRetirer(false)
  }

  function valider(e: SyntheticEvent) {
    e.preventDefault()
    enregistrer.mutate(
      { fiche, brouillon: { titre, texte, version, fichier: choix?.fichier ?? null, retirer } },
      { onSuccess: () => { if (!fiche) void naviguer(LISTE + search) } },
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={valider} onChange={() => { enregistrer.reset() }}>
      {image && <img className={styles.image} src={image} alt="" />}
      <label className={[styles.boutonContour, styles.envoi].join(' ')}>
        {image ? 'Changer l’image' : 'Ajouter une image'}
        <input type="file" accept={REGLE_IMAGE.types.join(',')} disabled={occupe} onChange={choisirImage} />
      </label>
      {refus && <p role="alert">{refus}</p>}
      {image && (
        <button type="button" className={styles.boutonContour} disabled={occupe}
          onClick={() => { setChoix(null); setRetirer(true) }}>Retirer l’image</button>
      )}

      <label className={styles.champ}>Titre
        <input value={titre} maxLength={TITRE_MAX} placeholder="ex. Filtrer la carte" onChange={(e) => { setTitre(e.target.value) }} />
      </label>
      <div className={styles.champ}>
        <label htmlFor="texte-mise-a-jour">Texte</label>
        <textarea id="texte-mise-a-jour" value={texte} rows={10} onChange={(e) => { setTexte(e.target.value) }} />
        <span className={styles.compteur}>{texte.length} / {TEXTE_MAX}</span>
      </div>
      <p className={styles.aide}>
        Un paragraphe par bloc, séparés par une ligne vide. Une ligne qui commence par « - » devient un point de liste ;
        ce qui précède « : » s’écrit en gras.
      </p>
      <label className={styles.champ}>Version
        <input value={version} maxLength={30} placeholder="facultatif, ex. Pythéas 1.2.4" onChange={(e) => { setVersion(e.target.value) }} />
      </label>

      <div>
        {!supprimee && (
          <button type="submit" className={styles.boutonContour} disabled={!estPubliable(titre, texte) || occupe}>
            {fiche ? 'Enregistrer' : 'Publier et prévenir les joueurs'}
          </button>
        )}
        {enregistrer.isSuccess && <span role="status"> Enregistré.</span>}
        {enregistrer.isError && <p role="alert">{enregistrer.error.message}</p>}
      </div>

      {fiche && !supprimee && (
        <div>
          {confirmer ? (
            <span>
              Supprimer cette mise à jour ?{' '}
              <button type="button" className={styles.boutonContour} disabled={supprimer.isPending}
                onClick={() => { setConfirmer(false); supprimer.mutate(fiche, { onSuccess: () => { void naviguer(LISTE + search) } }) }}>Confirmer</button>{' '}
              <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(false) }}>Annuler</button>
            </span>
          ) : (
            <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(true) }}>Supprimer</button>
          )}
        </div>
      )}
      {supprimer.isError && <p role="alert">{supprimer.error.message}</p>}
    </form>
  )
}

export function TiroirMiseAJour() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useMisesAJour()
  // La dernière fiche vue : elle survit à sa suppression le temps d'afficher l'erreur du retrait de l'image.
  const [vue, setVue] = useState<MiseAJour | null>(null)

  if (id === undefined) {
    return <Tiroir titre="Nouvelle mise à jour" retour={retour}><Formulaire fiche={null} supprimee={false} /></Tiroir>
  }
  if (isPending) {
    return <Tiroir titre="Mise à jour" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Mise à jour" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // Une adresse qui n'est pas un numéro ne désigne aucune mise à jour.
  const trouvee = /^[1-9]\d*$/.test(id) ? data.find((m) => m.id === Number(id)) : undefined
  if (trouvee && trouvee !== vue) setVue(trouvee)
  const fiche = trouvee ?? (vue?.id === Number(id) ? vue : undefined)
  if (!fiche) {
    return (
      <Tiroir titre="Mise à jour introuvable" retour={retour}>
        <p>Mise à jour introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'une note à l'autre.
  return <Tiroir titre={fiche.titre} retour={retour}><Formulaire key={fiche.id} fiche={fiche} supprimee={!trouvee} /></Tiroir>
}
