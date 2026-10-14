/**
 * QUOI     — la fiche d'un Fragment (tiroir) : ce que Shopify en dit (lecture seule), son origine sur la carte
 *            d'Explore, sa culture, sa visibilité, puis son scan.
 * POURQUOI — le contenu vient de Shopify et s'y corrige ; le Hub n'écrit que l'origine, la culture et la
 *            visibilité. Sans origine posée, la latitude et la longitude partent vides (la base lit « aucune »).
 */
import { useState, type CSSProperties, type SyntheticEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useCulturesDuHub } from '@/shared/cultures/useCulturesDuHub'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Fragment } from '../api/fragments'
import { useEcritureFragment, useFragments } from '../hooks/useFragments'
import { texteRiche } from '../lib/texteRiche'
import styles from './Boutique.module.css'
import { CarteDOrigine } from './CarteDOrigine'
import { ScanDuFragment } from './ScanDuFragment'

const LISTE = '/boutique/fragments'
const VIDE = 'vide dans Shopify'

function Texte({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div>
      <strong>{titre}</strong>
      {texte ? <p className={styles.paragraphes}>{texte}</p> : <p className={styles.calme}>{VIDE}</p>}
    </div>
  )
}

function DansShopify({ fragment }: { fragment: Fragment }) {
  return (
    <section className={styles.section}>
      <h3>Dans Shopify</h3>
      {fragment.heritage && <p>{`de la collection ${fragment.heritage}`}</p>}
      {!fragment.shopify_handle && (
        <p className={styles.erreur}>
          {`Aucune fiche Shopify reliée : synchronise, ou vérifie que sa collection (${fragment.link_url ?? 'aucun lien'}) est bien celle de son métaobjet.`}
        </p>
      )}
      <Texte titre="Résumé" texte={fragment.resume ?? ''} />
      <Texte titre="Son histoire" texte={texteRiche(fragment.histoire)} />
      <div>
        <strong>Récit audio</strong>
        {fragment.audio_url ? (
          <>
            <audio controls preload="none" src={fragment.audio_url} />
            {fragment.narrateur && <p className={styles.calme}>{`lu par ${fragment.narrateur}`}</p>}
          </>
        ) : <p className={styles.calme}>{VIDE}</p>}
      </div>
      <Texte titre="Artiste" texte={fragment.artiste ?? ''} />
      <p className={styles.calme}>Ce contenu se corrige dans Shopify (Contenu → Métaobjets → Illustrations), puis « Synchroniser ».</p>
    </section>
  )
}

type Position = { lat: number; lng: number } | null

function Formulaire({ fragment, tous }: { fragment: Fragment; tous: Fragment[] }) {
  const ecriture = useEcritureFragment(fragment.id)
  const { data: cultures = [] } = useCulturesDuHub()
  const [nom, setNom] = useState(fragment.origine_nom ?? '')
  const [position, setPosition] = useState<Position>(
    fragment.origine_lat !== null && fragment.origine_lng !== null ? { lat: fragment.origine_lat, lng: fragment.origine_lng } : null,
  )
  const [theme, setTheme] = useState(fragment.theme ?? '')
  const [visible, setVisible] = useState(fragment.visible)

  // Tout champ modifié efface « Enregistré. » et le message d'erreur.
  const modifie = () => { ecriture.reset() }

  // Les autres Fragments posés, et celui-ci à l'endroit où l'on est en train de le poser.
  const points = tous.flatMap((f) => {
    const lieu = f.id === fragment.id ? position : f.origine_lat !== null && f.origine_lng !== null ? { lat: f.origine_lat, lng: f.origine_lng } : null
    return lieu ? [{ id: f.id, ...lieu, image: f.illustration_url, nom: f.name }] : []
  })
  const couleur = cultures.find((c) => c.id === theme)?.couleur ?? null

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    ecriture.mutate({
      origine_lat: position?.lat ?? null, origine_lng: position?.lng ?? null,
      origine_nom: nom.trim() || null, visible, theme: theme || null,
    })
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer}>
      <h3>Sur la carte d’Explore</h3>
      <label className={styles.champ}>Lieu d’origine
        <input value={nom} placeholder="Sparte, Péloponnèse" onChange={(e) => { modifie(); setNom(e.target.value) }} />
      </label>
      <p className={styles.calme}>
        {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)} — un clic sur la carte le déplace` : 'Un clic sur la carte pose son point d’origine.'}
      </p>
      <CarteDOrigine points={points} choisi={fragment.id} onPoser={(lat, lng) => { modifie(); setPosition({ lat, lng }) }} />
      {position && <button type="button" className={styles.boutonContour} onClick={() => { modifie(); setPosition(null) }}>Retirer le point</button>}
      <label className={styles.champ}>Culture (la couleur de son éclat sur la carte)
        <span className={styles.apercu}>
          <select value={theme} onChange={(e) => { modifie(); setTheme(e.target.value) }}>
            <option value="">Aucune (rouge de la marque)</option>
            {cultures.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className={styles.pastilleDeCulture} style={{ '--couleur': couleur ?? 'var(--color-accent)' } as CSSProperties} />
        </span>
      </label>
      <label>
        <input type="checkbox" checked={visible} onChange={(e) => { modifie(); setVisible(e.target.checked) }} /> Visible dans l’appli
      </label>
      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && <span role="status"> Enregistré.</span>}
        {ecriture.isError && <p className={styles.erreur} role="alert">{ecriture.error.message}</p>}
      </div>
    </form>
  )
}

function Fiche({ fragment, tous, retour }: { fragment: Fragment; tous: Fragment[]; retour: string }) {
  return (
    <Tiroir titre={fragment.name} retour={retour}>
      <DansShopify fragment={fragment} />
      <Formulaire key={fragment.id} fragment={fragment} tous={tous} />
      <section className={styles.section}>
        <h3>Le scan</h3>
        <ScanDuFragment fragment={fragment} />
      </section>
    </Tiroir>
  )
}

function Introuvable({ retour }: { retour: string }) {
  return (
    <Tiroir titre="Fragment introuvable" retour={retour}>
      <p>Fragment introuvable.</p>
      <Link to={retour}>Retour à la liste</Link>
    </Tiroir>
  )
}

export function TiroirFragment() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useFragments()

  // Une adresse qui n'est pas un numéro n'interroge pas la base.
  if (id === undefined || !/^[1-9]\d*$/.test(id)) return <Introuvable retour={retour} />
  if (isPending) return <Tiroir titre="Fragment" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  if (isError) {
    return (
      <Tiroir titre="Fragment" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  const fragment = data.find((f) => f.id === Number(id))
  if (!fragment) return <Introuvable retour={retour} />
  // La clé remet la fiche à zéro quand on passe d'un Fragment à l'autre.
  return <Fiche key={fragment.id} fragment={fragment} tous={data} retour={retour} />
}
