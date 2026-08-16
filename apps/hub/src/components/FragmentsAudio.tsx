import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchIllustrations,
  fetchProduitsSansIllustration,
  ShopifyAccessDeniedError,
  ShopifyEmptyResultError,
} from '../lib/shopifyIllustrations'
import type { IllustrationInfo, ProduitSansIllustration } from '../lib/shopifyIllustrations'

export interface FragmentAudioStat {
  illustration_handle: string
  ecoutes: number
  completions: number
  taux: number | null
  ecoutes_motif: number
  ecoutes_produit: number
  derniere_ecoute: string | null
}

export function FragmentsAudio() {
  const [stats, setStats] = useState<FragmentAudioStat[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  // Bandeau de couverture — deux chargements independants du tableau des ecoutes
  // ci-dessus : une panne ici ne doit jamais faire disparaitre le tableau.
  const [produitsOrphelins, setProduitsOrphelins] = useState<ProduitSansIllustration[]>([])
  const [produitsErreur, setProduitsErreur] = useState<string | null>(null)
  const [produitsTronque, setProduitsTronque] = useState(false)
  const [illustrations, setIllustrations] = useState<IllustrationInfo[]>([])
  const [illustrationsScopeManquant, setIllustrationsScopeManquant] = useState<string | null>(null)
  const [illustrationsVideMessage, setIllustrationsVideMessage] = useState<string | null>(null)
  const [illustrationsErreur, setIllustrationsErreur] = useState<string | null>(null)
  const [illustrationsTronque, setIllustrationsTronque] = useState(false)

  useEffect(() => {
    let vivant = true
    async function charger() {
      const { data, error } = await supabase.rpc('get_fragment_audio_stats')
      if (!vivant) return
      if (error) {
        setErreur(error.message)
      } else {
        setStats((data ?? []) as FragmentAudioStat[])
      }
      setLoading(false)
    }
    void charger()
    return () => { vivant = false }
  }, [])

  // Compteur "produits actifs sans illustration_produit".
  useEffect(() => {
    let vivant = true
    async function charger() {
      try {
        const { produits, tronque } = await fetchProduitsSansIllustration()
        if (!vivant) return
        setProduitsOrphelins(produits)
        setProduitsTronque(tronque)
      } catch (e) {
        if (!vivant) return
        setProduitsErreur(e instanceof Error ? e.message : 'Erreur inconnue')
      }
    }
    void charger()
    return () => { vivant = false }
  }, [])

  // Les deux compteurs bases sur les metaobjets Illustration. Trois facons de ne pas
  // s'afficher normalement, toutes distinguees explicitement (voir
  // apps/hub/src/lib/shopifyIllustrations.ts) : portee Shopify manquante
  // (ShopifyAccessDeniedError), type de metaobjet devenu invalide cote admin
  // (ShopifyEmptyResultError — zero resultat sans erreur, ne pas le lire comme
  // "tout est couvert"), ou toute autre panne (erreur generique).
  useEffect(() => {
    let vivant = true
    async function charger() {
      try {
        const { illustrations: ills, tronque } = await fetchIllustrations()
        if (!vivant) return
        setIllustrations(ills)
        setIllustrationsTronque(tronque)
      } catch (e) {
        if (!vivant) return
        if (e instanceof ShopifyAccessDeniedError) {
          setIllustrationsScopeManquant(e.scope)
        } else if (e instanceof ShopifyEmptyResultError) {
          setIllustrationsVideMessage(e.message)
        } else {
          setIllustrationsErreur(e instanceof Error ? e.message : 'Erreur inconnue')
        }
      }
    }
    void charger()
    return () => { vivant = false }
  }, [])

  if (loading) return <div className="page">Chargement…</div>
  if (erreur) return <div className="page">Erreur de chargement : {erreur}</div>

  const totalEcoutes = stats.reduce((n, s) => n + s.ecoutes, 0)
  const totalCompletions = stats.reduce((n, s) => n + s.completions, 0)
  const tauxGlobal = totalEcoutes > 0
    ? Math.round((1000 * totalCompletions) / totalEcoutes) / 10
    : null

  return (
    <div className="page">
      <h1>Fragments audio</h1>
      <p>
        Le taux de complétion est la colonne qui décide : c&apos;est lui qui dit si la voix off
        mérite de rester au budget de chaque drop. Les écoutes de moins de dix secondes ne sont
        pas comptées.
      </p>

      <section className="couverture">
        <h2>Couverture</h2>
        <ul>
          <li>
            {produitsErreur ? (
              <>Inventaire des produits Shopify indisponible : {produitsErreur}</>
            ) : (
              <>
                <strong>{produitsOrphelins.length}</strong> produits actifs sans Illustration
                reliée (le lecteur y est muet){produitsTronque ? ' — liste tronquée' : ''} :{' '}
                {produitsOrphelins.map((p) => p.titre).join(', ') || '—'}
              </>
            )}
          </li>
          {illustrationsScopeManquant ? (
            <li>
              Inventaire des Illustrations indisponible : la portée{' '}
              <code>{illustrationsScopeManquant}</code> manque à l&apos;app Shopify. Ces deux
              compteurs resteront vides tant qu&apos;elle n&apos;est pas ajoutée.
            </li>
          ) : illustrationsVideMessage ? (
            <li>{illustrationsVideMessage}</li>
          ) : illustrationsErreur ? (
            <li>Inventaire des Illustrations indisponible : {illustrationsErreur}</li>
          ) : (
            <>
              <li>
                <strong>{illustrations.filter((i) => !i.aAudio).length}</strong> Illustrations
                sans voix off{illustrationsTronque ? ' — liste tronquée' : ''} :{' '}
                {illustrations.filter((i) => !i.aAudio).map((i) => i.nom).join(', ') || '—'}
              </li>
              <li>
                <strong>
                  {
                    illustrations.filter(
                      (i) => i.aAudio && !stats.some((s) => s.illustration_handle === i.handle),
                    ).length
                  }
                </strong>{' '}
                Fragments avec voix off et zéro écoute
                {illustrationsTronque ? ' — liste tronquée' : ''} :{' '}
                {illustrations
                  .filter((i) => i.aAudio && !stats.some((s) => s.illustration_handle === i.handle))
                  .map((i) => i.nom)
                  .join(', ') || '—'}
              </li>
            </>
          )}
        </ul>
      </section>

      {stats.length === 0 ? (
        <p>Aucune écoute enregistrée pour l&apos;instant.</p>
      ) : (
        <>
          <p>
            <strong>{totalEcoutes}</strong> écoutes, <strong>{totalCompletions}</strong> allées au
            bout{tauxGlobal !== null ? <> — <strong>{tauxGlobal} %</strong> de complétion</> : null}
          </p>
          <table>
            <thead>
              <tr>
                <th>Fragment</th>
                <th>Écoutes</th>
                <th>Complétions</th>
                <th>Taux</th>
                <th>Page motif</th>
                <th>Fiche produit</th>
                <th>Dernière écoute</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.illustration_handle}>
                  <td>{s.illustration_handle}</td>
                  <td>{s.ecoutes}</td>
                  <td>{s.completions}</td>
                  <td>{s.taux !== null ? `${s.taux} %` : '—'}</td>
                  <td>{s.ecoutes_motif}</td>
                  <td>{s.ecoutes_produit}</td>
                  <td>
                    {s.derniere_ecoute
                      ? new Date(s.derniere_ecoute).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
