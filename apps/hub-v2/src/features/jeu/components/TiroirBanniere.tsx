/**
 * QUOI     — l'éditeur d'une bannière (tiroir) : l'aperçu comme sur l'Accueil, le titre, le sous-titre, le lien,
 *            Active, les couleurs du voile, du bandeau, du titre, du sous-titre et de l'ombre, « Changer l'image »
 *            et « Supprimer » (confirmée en ligne).
 * POURQUOI — un lien qui ne commence pas par http:// ou https:// n'est pas affiché par la V2 : il est refusé ici.
 *            L'image se change tout de suite (envoi, mise à jour, retrait de l'ancien fichier), à part des
 *            autres champs. Supprimer retire la ligne d'abord, le fichier ensuite.
 */
import { useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { verifierFichier } from '@/shared/lib/envoi'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Banniere } from '../api/bannieres'
import { useBannieres, useEcritureBanniere } from '../hooks/useBannieres'
import { lienValide, REGLE_IMAGE } from '../lib/banniere'
import { ApercuBanniere } from './ApercuBanniere'
import styles from './Jeu.module.css'
import bannieres from './Bannieres.module.css'

const LISTE = '/jeu/bannieres'

// Une valeur de 0 à 1 ; vide ou hors bornes, c'est NaN.
const entreZeroEtUn = (texte: string) => {
  const n = Number(texte)
  return texte.trim() !== '' && n >= 0 && n <= 1 ? n : NaN
}

function Formulaire({ fiche }: { fiche: Banniere }) {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const { modifier, changerImage, supprimer } = useEcritureBanniere()
  const [titre, setTitre] = useState(fiche.title)
  const [sousTitre, setSousTitre] = useState(fiche.subtitle ?? '')
  const [lien, setLien] = useState(fiche.link_url)
  const [active, setActive] = useState(fiche.active)
  const [voile, setVoile] = useState(fiche.overlay_color)
  const [opacite, setOpacite] = useState(String(fiche.overlay_opacity))
  const [tag, setTag] = useState(fiche.tag_color)
  const [couleurTitre, setCouleurTitre] = useState(fiche.title_color)
  const [couleurSousTitre, setCouleurSousTitre] = useState(fiche.subtitle_color)
  const [ombre, setOmbre] = useState(fiche.shadow_color)
  const [force, setForce] = useState(String(fiche.shadow_strength))
  const [confirmer, setConfirmer] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    modifier.reset()
    setRefus(null)
  }

  function choisirImage(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    const erreur = verifierFichier(fichier, REGLE_IMAGE)
    setRefus(erreur)
    if (erreur) return
    changerImage.reset()
    changerImage.mutate({ banniere: fiche, fichier })
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const opaciteVoile = entreZeroEtUn(opacite)
    const forceOmbre = entreZeroEtUn(force)
    const erreur = !lienValide(lien) ? 'Le lien doit commencer par http:// ou https://'
      : Number.isNaN(opaciteVoile) ? 'L’opacité du voile est un nombre de 0 à 1.'
        : Number.isNaN(forceOmbre) ? 'La force de l’ombre est un nombre de 0 à 1.'
          : null
    setRefus(erreur)
    if (erreur) return
    modifier.mutate({
      id: fiche.id,
      banniere: {
        title: titre, subtitle: sousTitre.trim() || null, link_url: lien, active,
        overlay_color: voile, overlay_opacity: opaciteVoile, tag_color: tag, title_color: couleurTitre,
        subtitle_color: couleurSousTitre, shadow_color: ombre, shadow_strength: forceOmbre,
      },
    })
  }

  const couleur = (nom: string, valeur: string, change: (v: string) => void) => (
    <label className={styles.champ}>{nom}
      <input type="color" value={valeur} onChange={(e) => { change(e.target.value) }} />
    </label>
  )
  const nombre = (nom: string, valeur: string, change: (v: string) => void) => (
    <label className={styles.champ}>{nom}
      <input type="number" min={0} max={1} step={0.05} value={valeur} onChange={(e) => { change(e.target.value) }} />
    </label>
  )

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={(e) => {
      // Le refus d'un fichier vient du champ lui-même : l'événement qui remonte ne l'efface pas.
      if (!(e.target instanceof HTMLInputElement && e.target.type === 'file')) modifie()
    }}>
      <ApercuBanniere image={fiche.image_url} reglages={{
        titre, sousTitre, voile, opacite: Number(opacite), tag, couleurTitre, couleurSousTitre, ombre, force: Number(force),
      }} />
      <label className={[styles.boutonContour, bannieres.envoi].join(' ')}>
        Changer l'image
        <input type="file" accept={REGLE_IMAGE.types.join(',')} disabled={changerImage.isPending} onChange={choisirImage} />
      </label>
      {changerImage.isError && <p role="alert">{changerImage.error.message}</p>}

      <label className={styles.champ}>Titre
        <input value={titre} onChange={(e) => { setTitre(e.target.value) }} />
      </label>
      <label className={styles.champ}>Sous-titre
        <input value={sousTitre} onChange={(e) => { setSousTitre(e.target.value) }} />
      </label>
      <label className={styles.champ}>Lien
        <input value={lien} placeholder="https://" onChange={(e) => { setLien(e.target.value) }} />
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked) }} /> Active
      </label>

      <div className={bannieres.reglage}>
        {couleur('Couleur du voile', voile, setVoile)}
        {nombre('Opacité du voile', opacite, setOpacite)}
        {couleur('Couleur du bandeau', tag, setTag)}
        {couleur('Couleur du titre', couleurTitre, setCouleurTitre)}
        {couleur('Couleur du sous-titre', couleurSousTitre, setCouleurSousTitre)}
        {couleur('Couleur de l’ombre', ombre, setOmbre)}
        {nombre('Force de l’ombre', force, setForce)}
      </div>

      <div>
        <button type="submit" className={styles.boutonContour} disabled={modifier.isPending}>Enregistrer</button>
        {modifier.isSuccess && <span role="status"> Enregistré.</span>}
        {refus && <p role="alert">{refus}</p>}
        {modifier.isError && <p role="alert">{modifier.error.message}</p>}
      </div>

      <div>
        {confirmer ? (
          <span>
            Supprimer cette bannière ?{' '}
            <button type="button" className={styles.boutonContour} disabled={supprimer.isPending}
              onClick={() => { setConfirmer(false); supprimer.mutate(fiche, { onSuccess: () => { void naviguer(LISTE + search) } }) }}>Confirmer</button>{' '}
            <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(false) }}>Annuler</button>
          </span>
        ) : (
          <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(true) }}>Supprimer</button>
        )}
        {supprimer.isError && <p role="alert">{supprimer.error.message}</p>}
      </div>
    </form>
  )
}

export function TiroirBanniere() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useBannieres()

  if (isPending) {
    return <Tiroir titre="Bannière" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Bannière" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // Une adresse qui n'est pas un numéro ne désigne aucune bannière.
  const fiche = id !== undefined && /^[1-9]\d*$/.test(id) ? data.find((b) => b.id === Number(id)) : undefined
  if (!fiche) {
    return (
      <Tiroir titre="Bannière introuvable" retour={retour}>
        <p>Bannière introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'une bannière à l'autre.
  return <Tiroir titre={fiche.title || 'Nouvelle bannière'} retour={retour}><Formulaire key={fiche.id} fiche={fiche} /></Tiroir>
}
