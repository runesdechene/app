import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchIllustrations,
  fetchProduitsSansIllustration,
  ShopifyAccessDeniedError,
  ShopifyEmptyResultError,
} from '../lib/shopifyIllustrations'
import type { IllustrationInfo, ProduitSansIllustration } from '../lib/shopifyIllustrations'
import './FragmentsAudio.css'

export interface FragmentAudioStat {
  illustration_handle: string
  ecoutes: number
  completions: number
  taux: number | null
  ecoutes_motif: number
  ecoutes_produit: number
  derniere_ecoute: string | null
}

/**
 * En dessous de ce nombre d'ecoutes, le taux de completion est du bruit : un
 * seul auditeur qui va au bout place un Fragment a 100 %. L'ecran refuse alors
 * de conclure au lieu d'afficher un pourcentage qu'on prendrait pour un signal.
 */
const SEUIL_DECISION = 20

function jauge(taux: number | null, muette = false) {
  const part = Math.max(0, Math.min(100, taux ?? 0))
  return (
    <span className="frg-jauge">
      <span
        className={muette ? 'frg-jauge-encre frg-jauge-encre--muette' : 'frg-jauge-encre'}
        style={{ width: `${part}%` }}
      />
    </span>
  )
}

export function FragmentsAudio() {
  const [stats, setStats] = useState<FragmentAudioStat[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  // Bandeau de couverture — deux chargements independants du tableau des ecoutes :
  // une panne ici ne doit jamais faire disparaitre le tableau.
  const [produitsOrphelins, setProduitsOrphelins] = useState<ProduitSansIllustration[]>([])
  const [produitsErreur, setProduitsErreur] = useState<string | null>(null)
  const [produitsTronque, setProduitsTronque] = useState(false)
  const [illustrations, setIllustrations] = useState<IllustrationInfo[]>([])
  const [illustrationsScopeManquant, setIllustrationsScopeManquant] = useState<string | null>(null)
  const [illustrationsVideMessage, setIllustrationsVideMessage] = useState<string | null>(null)
  const [illustrationsErreur, setIllustrationsErreur] = useState<string | null>(null)
  const [illustrationsTronque, setIllustrationsTronque] = useState(false)
  // Tant que l'inventaire n'a pas repondu, on n'affiche AUCUN compteur. Sans ca,
  // la fenetre de chargement montre « 0 Illustration sans voix off », qui se lit
  // comme « tout est couvert » — exactement le contresens que ce bandeau existe
  // pour empecher. Constate en production le 2026-08-16 : la page a affiche 0
  // pendant plusieurs secondes avant d'afficher les 21 reelles.
  const [produitsChargement, setProduitsChargement] = useState(true)
  const [illustrationsChargement, setIllustrationsChargement] = useState(true)

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
      } finally {
        if (vivant) setProduitsChargement(false)
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
      } finally {
        if (vivant) setIllustrationsChargement(false)
      }
    }
    void charger()
    return () => { vivant = false }
  }, [])

  if (loading) return <div className="loading">Chargement…</div>
  if (erreur) return <div className="loading">Lecture des écoutes impossible : {erreur}</div>

  const totalEcoutes = stats.reduce((n, s) => n + s.ecoutes, 0)
  const totalCompletions = stats.reduce((n, s) => n + s.completions, 0)
  const tauxGlobal = totalEcoutes > 0
    ? Math.round((1000 * totalCompletions) / totalEcoutes) / 10
    : null
  const assezPourTrancher = totalEcoutes >= SEUIL_DECISION

  const sansVoix = illustrations.filter((i) => !i.aAudio)
  const jamaisEcoutes = illustrations.filter(
    (i) => i.aAudio && !stats.some((s) => s.illustration_handle === i.handle),
  )

  const derniere = stats
    .map((s) => s.derniere_ecoute)
    .filter((d): d is string => d !== null)
    .sort()
    .pop()

  return (
    <div className="frg">
      <div className="page-header">
        <h1>Fragments audio</h1>
        {derniere ? (
          <span className="frg-date">
            Dernière écoute le {new Date(derniere).toLocaleDateString('fr-FR')}
          </span>
        ) : null}
      </div>

      {stats.length === 0 ? (
        <div className="frg-vide">
          <p className="frg-vide-titre">Personne n&apos;a encore écouté de Fragment</p>
          <p className="frg-vide-quoi">
            Le compteur démarre à la première écoute qui dépasse dix secondes. Faire glisser le
            curseur jusqu&apos;au bout ne compte pas.
          </p>
        </div>
      ) : (
        <section className="frg-verdict">
          <p className="frg-oeil">Verdict</p>
          {assezPourTrancher ? (
            <>
              <div className="frg-verdict-corps">
                <span className="frg-chiffre">{tauxGlobal} %</span>
                <span className="frg-dit">
                  des écoutes vont <strong>jusqu&apos;au bout</strong> de la narration.
                  <span className="frg-assiette">
                    Sur {totalEcoutes} écoutes réelles, {stats.length}{' '}
                    {stats.length > 1 ? 'Fragments' : 'Fragment'}.
                  </span>
                </span>
              </div>
              {jauge(tauxGlobal)}
            </>
          ) : (
            <>
              <div className="frg-verdict-corps">
                <span className="frg-chiffre frg-chiffre--muet">Pas encore de quoi trancher</span>
                <span className="frg-dit">
                  {totalEcoutes} {totalEcoutes > 1 ? 'écoutes réelles' : 'écoute réelle'} pour
                  l&apos;instant
                  {tauxGlobal !== null ? <> — {tauxGlobal} % vont au bout</> : null}.
                  <span className="frg-assiette">
                    Il en faut une vingtaine avant que ce taux veuille dire quelque chose : un seul
                    auditeur qui termine suffit à afficher 100 %.
                  </span>
                </span>
              </div>
              {jauge(tauxGlobal, true)}
            </>
          )}
        </section>
      )}

      <p className="frg-oeil">Couverture</p>
      <section className="frg-couverture">
        <div className="frg-releve">
          {illustrationsChargement ? (
            <span className="frg-releve-quoi">Lecture de l&apos;inventaire…</span>
          ) : illustrationsScopeManquant ? (
            <p className="frg-releve-panne">
              Inventaire indisponible : la portée <code>{illustrationsScopeManquant}</code> manque à
              l&apos;app Shopify.
            </p>
          ) : illustrationsVideMessage ? (
            <p className="frg-releve-panne">{illustrationsVideMessage}</p>
          ) : illustrationsErreur ? (
            <p className="frg-releve-panne">Inventaire indisponible : {illustrationsErreur}</p>
          ) : (
            <>
              <span
                className={
                  sansVoix.length === 0 ? 'frg-releve-compte frg-releve-compte--zero' : 'frg-releve-compte'
                }
              >
                {sansVoix.length}
              </span>
              <span className="frg-releve-quoi">
                Illustrations sans voix off
                {illustrationsTronque ? <span className="frg-tronque"> — liste tronquée</span> : null}
              </span>
              {sansVoix.length > 0 ? (
                <p className="frg-releve-liste">{sansVoix.map((i) => i.nom).join(' · ')}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="frg-releve">
          {illustrationsChargement || illustrationsScopeManquant || illustrationsVideMessage
            || illustrationsErreur ? (
            <span className="frg-releve-quoi">
              {illustrationsChargement ? 'Lecture de l’inventaire…' : 'Compteur indisponible'}
            </span>
          ) : (
            <>
              <span
                className={
                  jamaisEcoutes.length === 0
                    ? 'frg-releve-compte frg-releve-compte--zero'
                    : 'frg-releve-compte'
                }
              >
                {jamaisEcoutes.length}
              </span>
              <span className="frg-releve-quoi">
                Fragments enregistrés que personne n&apos;a écoutés
              </span>
              {jamaisEcoutes.length > 0 ? (
                <p className="frg-releve-liste">{jamaisEcoutes.map((i) => i.nom).join(' · ')}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="frg-releve">
          {produitsChargement ? (
            <span className="frg-releve-quoi">Lecture des produits…</span>
          ) : produitsErreur ? (
            <p className="frg-releve-panne">Produits indisponibles : {produitsErreur}</p>
          ) : (
            <>
              <span
                className={
                  produitsOrphelins.length === 0
                    ? 'frg-releve-compte frg-releve-compte--zero'
                    : 'frg-releve-compte'
                }
              >
                {produitsOrphelins.length}
              </span>
              <span className="frg-releve-quoi">
                Produits actifs sans Illustration reliée — le lecteur y reste muet
                {produitsTronque ? <span className="frg-tronque"> — liste tronquée</span> : null}
              </span>
              {produitsOrphelins.length > 0 ? (
                <p className="frg-releve-liste">
                  {produitsOrphelins.map((p) => p.titre).join(' · ')}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      {stats.length > 0 ? (
        <>
          <p className="frg-oeil">Par Fragment</p>
          <div className="frg-cadre">
            <table className="frg-table">
              <thead>
                <tr>
                  <th>Fragment</th>
                  <th className="frg-num">Écoutes</th>
                  <th className="frg-num">Au bout</th>
                  <th className="frg-taux">Complétion</th>
                  <th>Répartition</th>
                  <th>Dernière</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const mince = s.ecoutes < SEUIL_DECISION
                  return (
                    <tr key={s.illustration_handle}>
                      <td className="frg-nom">{s.illustration_handle}</td>
                      <td className="frg-num">{s.ecoutes}</td>
                      <td className="frg-num">{s.completions}</td>
                      <td className="frg-taux">
                        <span
                          className={
                            mince ? 'frg-taux-valeur frg-taux-valeur--mince' : 'frg-taux-valeur'
                          }
                          title={mince ? 'Trop peu d’écoutes pour que ce taux soit fiable' : undefined}
                        >
                          {s.taux !== null ? `${s.taux} %` : '—'}
                          {mince ? ' · à confirmer' : ''}
                        </span>
                        {jauge(s.taux, mince)}
                      </td>
                      <td className="frg-repartition">
                        {s.ecoutes_motif} motif · {s.ecoutes_produit} produit
                      </td>
                      <td className="frg-date">
                        {s.derniere_ecoute
                          ? new Date(s.derniere_ecoute).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
