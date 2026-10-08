/**
 * QUOI     — les Fragments : leur contenu tiré de Shopify (lecture seule), leur origine sur la carte
 *            et leur visibilité, plus la liste des motifs Shopify qui ne sont pas des Fragments.
 * POURQUOI — décision du 08/10 (vault, Explore/_État.md « Fragments ») : Shopify reste la source,
 *            le Hub aspire et n'ajoute que ce que Shopify n'a pas. Une ligne de title_fragments = un
 *            Fragment ; un métaobjet sans ligne est un ancien motif, listé ici pour le tri.
 * ATTENTION — écriture par les RPC `synchroniser_fragments`, `ajouter_fragment`, `enregistrer_fragment`
 *            (admins, mig 457) : la table n'a pas de policy d'écriture. SaveBar + refetch.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchIllustrationsCompletes, texteRiche, type IllustrationComplete } from '../../lib/shopifyIllustrations'
import { SaveBar } from '../SaveBar'
import { CarteOrigine } from './CarteOrigine'
import './Fragments.css'

interface Fragment {
  id: number
  name: string
  link_url: string | null
  visible: boolean
  shopify_handle: string | null
  resume: string | null
  histoire: string | null
  illustration_url: string | null
  audio_url: string | null
  artiste: string | null
  narrateur: string | null
  heritage: string | null
  synchronise_le: string | null
  origine_lat: number | null
  origine_lng: number | null
  origine_nom: string | null
}

const COLONNES =
  'id, name, link_url, visible, shopify_handle, resume, histoire, illustration_url, audio_url, artiste, narrateur, heritage, synchronise_le, origine_lat, origine_lng, origine_nom'

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function Fragments() {
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [enregistres, setEnregistres] = useState<Fragment[]>([])
  const [illustrations, setIllustrations] = useState<IllustrationComplete[] | null>(null)
  const [erreurShopify, setErreurShopify] = useState<string | null>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [synchro, setSynchro] = useState<string | null>(null) // compte rendu de la dernière synchro
  const [synchronisant, setSynchronisant] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function fetchFragments() {
    const { data, error } = await supabase.from('title_fragments').select(COLONNES).order('name')
    if (error) throw error
    const lus = (data ?? []) as Fragment[]
    setFragments(JSON.parse(JSON.stringify(lus)))
    setEnregistres(JSON.parse(JSON.stringify(lus)))
    setChoisi((c) => c ?? lus[0]?.id ?? null)
  }

  async function fetchShopify() {
    setErreurShopify(null)
    try {
      setIllustrations(await fetchIllustrationsCompletes())
    } catch (e) {
      setErreurShopify(e instanceof Error ? e.message : String(e))
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      await fetchFragments()
    } catch (e) {
      setSaveError(`${e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    void fetchShopify()
  }, [])

  async function synchroniser() {
    setSynchronisant(true)
    setSynchro(null)
    setSaveError(null)
    try {
      const lues = await fetchIllustrationsCompletes()
      setIllustrations(lues)
      const { data, error } = await supabase.rpc('synchroniser_fragments', { p_illustrations: lues })
      if (error) throw error
      setSynchro(`${data as number} Fragment${(data as number) > 1 ? 's' : ''} mis à jour depuis Shopify`)
      await fetchFragments()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setSynchronisant(false)
    }
  }

  async function ajouter(ill: IllustrationComplete) {
    setSynchronisant(true)
    setSaveError(null)
    try {
      const { data, error } = await supabase.rpc('ajouter_fragment', { p_nom: ill.nom, p_collection: ill.collection })
      if (error) throw error
      const { error: e2 } = await supabase.rpc('synchroniser_fragments', { p_illustrations: [ill] })
      if (e2) throw e2
      await fetchFragments()
      setChoisi(data as number)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setSynchronisant(false)
    }
  }

  const fragment = fragments.find((f) => f.id === choisi) ?? null
  const changer = (patch: Partial<Fragment>) => {
    setFragments((prev) => prev.map((f) => (f.id === choisi ? { ...f, ...patch } : f)))
  }
  const modifies = fragments.filter((f) => JSON.stringify(f) !== JSON.stringify(enregistres.find((e) => e.id === f.id)))

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      for (const f of modifies) {
        const { error } = await supabase.rpc('enregistrer_fragment', {
          p_id: f.id, p_origine_lat: f.origine_lat, p_origine_lng: f.origine_lng,
          p_origine_nom: f.origine_nom ?? '', p_visible: f.visible,
        })
        if (error) throw error
      }
      await fetchFragments()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setSaving(false)
    }
  }

  // Un métaobjet est un Fragment s'il est déjà relié, ou si sa collection est celle du lien d'un Fragment.
  const estUnFragment = (ill: IllustrationComplete) =>
    fragments.some((f) => f.shopify_handle === ill.handle ||
      (!!ill.collection && !!f.link_url?.toLowerCase().endsWith(`/collections/${ill.collection.toLowerCase()}`)))
  const motifs = illustrations?.filter((ill) => !estUnFragment(ill)) ?? []
  const derniere = fragments.map((f) => f.synchronise_le).filter((d): d is string => !!d).sort().pop()
  const points = fragments
    .filter((f) => f.origine_lat !== null && f.origine_lng !== null)
    .map((f) => ({ id: f.id, lat: f.origine_lat as number, lng: f.origine_lng as number, image: f.illustration_url, nom: f.name }))

  if (loading && fragments.length === 0) return <div className="loading">Chargement…</div>

  return (
    <div className="section frag">
      <div className="frag-tete">
        <div>
          <h1>Fragments</h1>
          <p className="frag-sous-titre">
            {fragments.length} Fragments · contenu tiré de Shopify
            {derniere ? `, synchronisé le ${dateCourte(derniere)}` : ', jamais synchronisé'}
          </p>
        </div>
        <button className="btn-primary" disabled={synchronisant} onClick={() => void synchroniser()}>
          {synchronisant ? 'Synchronisation…' : 'Synchroniser depuis Shopify'}
        </button>
      </div>
      {synchro && <p className="frag-bandeau">{synchro}</p>}
      {erreurShopify && <p className="frag-bandeau frag-bandeau--erreur">Shopify ne répond pas : {erreurShopify}</p>}

      <div className="frag-grille">
        {fragments.map((f) => (
          <button key={f.id} className={`frag-tuile${f.id === choisi ? ' frag-tuile--choisie' : ''}${f.visible ? '' : ' frag-tuile--masquee'}`}
            onClick={() => setChoisi(f.id)}>
            <span className="frag-tuile-image" style={f.illustration_url ? { backgroundImage: `url("${f.illustration_url}")` } : undefined}>
              {!f.illustration_url && <span className="frag-tuile-vide">Pas d’illustration</span>}
            </span>
            <span className="frag-tuile-nom">{f.name}</span>
            <span className={f.origine_lat !== null ? 'frag-etat frag-etat--ok' : 'frag-etat'}>
              {!f.visible ? 'Masqué' : f.origine_lat !== null ? f.origine_nom || 'Origine posée' : 'Origine à poser'}
            </span>
          </button>
        ))}
      </div>

      {fragment && (
        <div className="frag-fiche">
          <div className="frag-contenu">
            <div className="frag-entete">
              <h2>{fragment.name}</h2>
              {fragment.heritage && <p className="frag-heritage">de la collection {fragment.heritage}</p>}
            </div>
            {!fragment.shopify_handle && (
              <p className="frag-bandeau frag-bandeau--erreur">
                Aucune fiche Shopify reliée : synchronise, ou vérifie que sa collection ({fragment.link_url ?? 'aucun lien'}) est bien celle de son métaobjet.
              </p>
            )}
            <dl className="frag-champs">
              <dt>Résumé</dt><dd>{fragment.resume || <em>vide dans Shopify</em>}</dd>
              <dt>Son histoire</dt>
              <dd className="frag-recit">{texteRiche(fragment.histoire) || <em>vide dans Shopify</em>}</dd>
              <dt>Récit audio</dt>
              <dd>{fragment.audio_url ? <audio controls preload="none" src={fragment.audio_url} /> : <em>pas de voix off</em>}
                {fragment.narrateur && <span className="frag-discret"> · lu par {fragment.narrateur}</span>}</dd>
              <dt>Artiste</dt><dd>{fragment.artiste || <em>non renseigné</em>}</dd>
            </dl>
            <p className="frag-discret">Ce contenu se corrige dans Shopify (Contenu → Métaobjets → Illustrations), puis « Synchroniser ».</p>
          </div>

          <div className="frag-origine">
            <div className="frag-origine-champs">
              <label className="faction-field"><span className="faction-field-label">Lieu d’origine</span>
                <input className="settings-input" value={fragment.origine_nom ?? ''} placeholder="Sparte, Péloponnèse"
                  onChange={(e) => changer({ origine_nom: e.target.value })} /></label>
              <p className="frag-discret">
                {fragment.origine_lat !== null && fragment.origine_lng !== null
                  ? `${fragment.origine_lat.toFixed(4)}, ${fragment.origine_lng.toFixed(4)} — un clic sur la carte le déplace`
                  : 'Un clic sur la carte pose son point d’origine.'}
              </p>
              <div className="frag-origine-actions">
                {fragment.origine_lat !== null && (
                  <button className="btn-secondary" onClick={() => changer({ origine_lat: null, origine_lng: null })}>Retirer le point</button>
                )}
                <label className="frag-visible"><input type="checkbox" checked={fragment.visible}
                  onChange={(e) => changer({ visible: e.target.checked })} /> Visible dans l’app</label>
              </div>
            </div>
            <CarteOrigine points={points} choisi={fragment.id}
              onPoser={(lat, lng) => changer({ origine_lat: lat, origine_lng: lng })} />
          </div>
        </div>
      )}

      {illustrations && (
        <section className="frag-motifs">
          <h2>Motifs Shopify sans Fragment <span className="frag-compte">{motifs.length}</span></h2>
          <p className="frag-discret">
            Des métaobjets Illustration qui ne correspondent à aucun Fragment : d’anciens motifs à trier dans Shopify, ou un nouveau Fragment à ajouter.
          </p>
          {motifs.length === 0 && <p className="frag-discret">Tout est trié : chaque Illustration de Shopify est un Fragment.</p>}
          {motifs.map((ill) => (
            <div key={ill.handle} className="frag-motif">
              <span className="frag-motif-image" style={ill.illustration_url ? { backgroundImage: `url("${ill.illustration_url}")` } : undefined} />
              <span className="frag-motif-nom">{ill.nom}<span className="frag-discret"> · {ill.collection ? `collection ${ill.collection}` : 'aucune collection'}</span></span>
              <button className="btn-secondary" disabled={!ill.collection || synchronisant}
                title={ill.collection ? '' : 'Relie d’abord une collection à ce métaobjet dans Shopify'}
                onClick={() => void ajouter(ill)}>En faire un Fragment</button>
            </div>
          ))}
        </section>
      )}

      <SaveBar hasChanges={modifies.length > 0} saving={saving} error={saveError}
        onSave={() => void handleSave()} onCancel={() => setFragments(JSON.parse(JSON.stringify(enregistres)))} />
    </div>
  )
}
