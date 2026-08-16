import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchIllustrations,
  fetchProduitsSansIllustration,
  ShopifyAccessDeniedError,
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
  const [illustrations, setIllustrations] = useState<IllustrationInfo[]>([])
  const [illustrationsScopeManquant, setIllustrationsScopeManquant] = useState<string | null>(null)
  const [illustrationsErreur, setIllustrationsErreur] = useState<string | null>(null)

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

  // Compteur "produits actifs sans illustration_produit" : seule ligne du bandeau
  // que le token admin actuel peut servir aujourd'hui (pas de scope metaobjets requis).
  useEffect(() => {
    let vivant = true
    async function charger() {
      try {
        const orphelins = await fetchProduitsSansIllustration()
        if (!vivant) return
        setProduitsOrphelins(orphelins)
      } catch (e) {
        if (!vivant) return
        setProduitsErreur(e instanceof Error ? e.message : 'Erreur inconnue')
      }
    }
    void charger()
    return () => { vivant = false }
  }, [])

  // Les deux compteurs bases sur les metaobjets Illustration : indisponibles tant que
  // la portee read_metaobjects manque a l'app Shopify (ShopifyAccessDeniedError) —
  // voir apps/hub/src/lib/shopifyIllustrations.ts.
  useEffect(() => {
    let vivant = true
    async function charger() {
      try {
        const ills = await fetchIllustrations()
        if (!vivant) return
        setIllustrations(ills)
      } catch (e) {
        if (!vivant) return
        if (e instanceof ShopifyAccessDeniedError) {
          setIllustrationsScopeManquant(e.scope)
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
                reliée (le lecteur y est muet) :{' '}
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
          ) : illustrationsErreur ? (
            <li>Inventaire des Illustrations indisponible : {illustrationsErreur}</li>
          ) : (
            <>
              <li>
                <strong>{illustrations.filter((i) => !i.aAudio).length}</strong> Illustrations
                sans voix off :{' '}
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
                Fragments avec voix off et zéro écoute :{' '}
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
