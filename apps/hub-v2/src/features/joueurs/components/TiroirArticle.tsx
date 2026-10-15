/**
 * QUOI     — l'éditeur d'un article (tiroir) : titre, type, texte en Markdown, couverture, bouton d'appel (lien et texte),
 *            puis « Enregistrer » et « Publier sur la boutique » (« Mettre à jour l'article » s'il est déjà sur Shopify).
 *            Sur /nouveau, un petit formulaire (type et titre) crée le brouillon, qui s'ouvre aussitôt.
 * POURQUOI — publier enregistre d'abord : la boutique reçoit ce qui est à l'écran. Le bouton marche sur tout brouillon
 *            (plus besoin de publier dans l'app). Le fichier choisi ne s'envoie qu'à l'enregistrement ; l'erreur de la
 *            fonction, ou du marquage « publié », est dite telle quelle.
 */
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { verifierFichier } from '@/shared/lib/envoi'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Article, TypeArticle } from '../api/blog'
import { useBlog, useCreerArticle, useEnregistrerArticle, usePublierArticle } from '../hooks/useBlog'
import { REGLE_IMAGE } from '../lib/miseAJour'
import styles from './Joueurs.module.css'

const LISTE = '/joueurs/blog'
const TYPES: { valeur: TypeArticle; libelle: string }[] = [
  { valeur: 'produit', libelle: 'produit' }, { valeur: 'app', libelle: 'app' }, { valeur: 'marque', libelle: 'marque' },
]
const typeDe = (t: string): TypeArticle => (t === 'app' || t === 'marque' ? t : 'produit')

function Creation() {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const creer = useCreerArticle()
  const [titre, setTitre] = useState('')
  const [type, setType] = useState<TypeArticle>('produit')

  function valider(e: SyntheticEvent) {
    e.preventDefault()
    creer.mutate({ type, titre }, { onSuccess: (a) => { void naviguer({ pathname: `${LISTE}/${a.id}`, search }) } })
  }

  return (
    <form className={styles.formulaire} onSubmit={valider}>
      <ChoixSegmente nom="Type" options={TYPES} choisi={type} onChoix={setType} />
      <label className={styles.champ}>Titre
        <input value={titre} onChange={(e) => { setTitre(e.target.value) }} />
      </label>
      <div>
        <button type="submit" className={styles.boutonContour} disabled={!titre.trim() || creer.isPending}>Créer le brouillon</button>
        {creer.isError && <p role="alert">{creer.error.message}</p>}
      </div>
    </form>
  )
}

function Formulaire({ fiche }: { fiche: Article }) {
  const enregistrer = useEnregistrerArticle()
  const publier = usePublierArticle()
  const [titre, setTitre] = useState(fiche.title)
  const [type, setType] = useState<TypeArticle>(typeDe(fiche.type))
  const [texte, setTexte] = useState(fiche.body)
  const [ctaUrl, setCtaUrl] = useState(fiche.cta_url ?? '')
  const [ctaLibelle, setCtaLibelle] = useState(fiche.cta_label ?? '')
  // Le fichier choisi ne part qu'à l'enregistrement ; son aperçu est libéré au changement et à la fermeture.
  const [choix, setChoix] = useState<{ fichier: File; apercu: string } | null>(null)
  const [retirer, setRetirer] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    if (!choix) return
    return () => { URL.revokeObjectURL(choix.apercu) }
  }, [choix])

  const image = choix?.apercu ?? (retirer ? null : fiche.cover_image)
  const occupe = enregistrer.isPending || publier.isPending
  const brouillon = { titre, type, texte, ctaUrl, ctaLibelle, fichier: choix?.fichier ?? null, retirer }

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

  return (
    <form
      className={styles.formulaire}
      onChange={() => { enregistrer.reset(); publier.reset() }}
      onSubmit={(e) => { e.preventDefault(); enregistrer.mutate({ fiche, brouillon }) }}
    >
      {image && <img className={styles.image} src={image} alt="" />}
      <label className={[styles.boutonContour, styles.envoi].join(' ')}>
        {image ? 'Changer la couverture' : 'Ajouter une couverture'}
        <input type="file" accept={REGLE_IMAGE.types.join(',')} disabled={occupe} onChange={choisirImage} />
      </label>
      {refus && <p role="alert">{refus}</p>}
      {image && (
        <button type="button" className={styles.boutonContour} disabled={occupe}
          onClick={() => { setChoix(null); setRetirer(true) }}>Retirer la couverture</button>
      )}

      <ChoixSegmente nom="Type" options={TYPES} choisi={type} onChoix={setType} />
      <label className={styles.champ}>Titre
        <input value={titre} onChange={(e) => { setTitre(e.target.value) }} />
      </label>
      <div className={styles.champ}>
        <label htmlFor="texte-article">Texte</label>
        <textarea id="texte-article" value={texte} rows={14} onChange={(e) => { setTexte(e.target.value) }} />
      </div>
      <p className={styles.aide}>Markdown : « ## » pour un titre, « - » pour une liste, « ** » autour d’un mot pour le mettre en gras.</p>
      <label className={styles.champ}>Lien du bouton
        <input value={ctaUrl} placeholder="facultatif, https://…" onChange={(e) => { setCtaUrl(e.target.value) }} />
      </label>
      <label className={styles.champ}>Texte du bouton
        <input value={ctaLibelle} placeholder="facultatif, ex. Découvrir" onChange={(e) => { setCtaLibelle(e.target.value) }} />
      </label>

      <div>
        <button type="submit" className={styles.boutonContour} disabled={!titre.trim() || occupe}>Enregistrer</button>{' '}
        <button type="button" className={styles.boutonContour} disabled={!titre.trim() || occupe}
          onClick={() => { publier.mutate({ fiche, brouillon }) }}>
          {fiche.shopify_article_id ? 'Mettre à jour l’article' : 'Publier sur la boutique'}
        </button>
        {enregistrer.isSuccess && <span role="status"> Enregistré.</span>}
        {publier.isSuccess && <span role="status"> Publié sur la boutique.</span>}
        {enregistrer.isError && <p role="alert">{enregistrer.error.message}</p>}
        {publier.isError && <p role="alert">{publier.error.message}</p>}
      </div>
    </form>
  )
}

export function TiroirArticle() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useBlog()

  if (id === undefined) return <Tiroir titre="Nouvel article" retour={retour}><Creation /></Tiroir>
  if (isPending) return <Tiroir titre="Article" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  if (isError) {
    return (
      <Tiroir titre="Article" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  const fiche = data.find((a) => a.id === id)
  if (!fiche) {
    return (
      <Tiroir titre="Article introuvable" retour={retour}>
        <p>Article introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'un article à l'autre.
  return <Tiroir titre={fiche.title} retour={retour}><Formulaire key={fiche.id} fiche={fiche} /></Tiroir>
}
