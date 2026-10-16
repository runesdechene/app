/**
 * QUOI     — « Les comptes » (maquette 594:961) : quatre chiffres, filtres, recherche, la liste par
 *            pages, l'export CSV ; la fiche d'un compte s'ouvre par-dessus (route enfant).
 * POURQUOI — filtre, recherche, provenance, département, tri et page sont dans l'adresse.
 */
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Pages } from '@/shared/ui/Pages'
import { Tuile } from '@/shared/ui/Tuile'
import type { Criteres, Filtre, Tri } from '../api/comptes'
import { exporterComptes, useComptes } from '../hooks/useComptes'
import { LigneDeCompte } from './LigneDeCompte'
import styles from './Communaute.module.css'

const PAR_PAGE = 50
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' }, { valeur: 'nouveaux', libelle: 'Nouveaux' }, { valeur: 'reactives', libelle: 'Réactivés' },
  { valeur: 'sommeil', libelle: 'En sommeil' }, { valeur: 'jamais', libelle: 'Jamais connectés' }, { valeur: 'porteurs', libelle: 'Porteurs' },
  { valeur: 'equipe', libelle: 'Équipe' },
]
const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: 'inscription', libelle: 'Inscription' }, { valeur: 'visite', libelle: 'Dernière visite' }, { valeur: 'nom', libelle: 'Nom' },
]
function numeroDePage(texte: string | null): number {
  const page = Math.floor(Number(texte))
  return page >= 1 ? page : 1
}
const nombre = new Intl.NumberFormat('fr-FR')

export function Comptes() {
  const [params, setParams] = useSearchParams()
  const { search } = useLocation()
  const criteres: Criteres = {
    filtre: FILTRES.find((f) => f.valeur === params.get('filtre'))?.valeur ?? 'tous',
    recherche: params.get('q') ?? '',
    provenance: params.get('provenance'),
    departement: params.get('departement'),
    tri: TRIS.find((t) => t.valeur === params.get('tri'))?.valeur ?? 'inscription',
    limite: PAR_PAGE,
    decalage: (numeroDePage(params.get('page')) - 1) * PAR_PAGE,
  }
  const { data, isError } = useComptes(criteres)
  const maintenant = new Date()
  const [exportEchoue, setExportEchoue] = useState(false)

  // Une page au-delà de la dernière (liste raccourcie, adresse recopiée) : on se replace sur la dernière.
  const total = data?.total ?? 0
  useEffect(() => {
    if (total > 0 && criteres.decalage >= total) {
      const suivants = new URLSearchParams(params)
      suivants.set('page', String(Math.ceil(total / PAR_PAGE)))
      setParams(suivants, { replace: true })
    }
  }, [total, criteres.decalage, params, setParams])

  function changer(cle: string, valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur === null || valeur === '' || (cle === 'filtre' && valeur === 'tous') || (cle === 'tri' && valeur === 'inscription')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    setParams(suivants)
  }

  async function telecharger() {
    setExportEchoue(false)
    const csv = await exporterComptes(criteres)
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    lien.download = `comptes-${criteres.filtre}.csv`
    lien.click()
    setTimeout(() => { URL.revokeObjectURL(lien.href) }, 1000)
  }

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Communauté"
        titre="Les comptes"
        phrase={data ? `${nombre.format(data.compteurs.comptes)} Explorateurs.` : ''}
        aDroite={(
          <>
            <Link className={styles.boutonContour} to={{ pathname: 'nouveau', search }}>+ Compte du stand</Link>{' '}
            <button className={styles.boutonContour} type="button" onClick={() => { telecharger().catch(() => { setExportEchoue(true) }) }}>Exporter en CSV</button>
          </>
        )}
      />
      {data && (
        <div className={styles.tuiles}>
          <Tuile libelle="Comptes" valeur={nombre.format(data.compteurs.comptes)} />
          {/* Connecté au moins une fois, V1 ou V2 : tout compte qui n'est pas « Jamais connecté ». */}
          <Tuile libelle="Déjà connectés" valeur={nombre.format(data.compteurs.comptes - data.compteurs.jamais)} />
          <Tuile libelle="Actifs en 7 jours" valeur={nombre.format(data.compteurs.actifs)} />
          <Tuile libelle="Réactivés depuis la V2" valeur={nombre.format(data.compteurs.reactives)} />
          <Tuile libelle="En sommeil" valeur={nombre.format(data.compteurs.sommeil)} />
          <Tuile libelle="Jamais connectés" valeur={nombre.format(data.compteurs.jamais)} />
        </div>
      )}
      <div className={styles.barre}>
        <ChoixSegmente nom="Filtre" options={FILTRES} choisi={criteres.filtre} onChoix={(v) => { changer('filtre', v) }} />
        <select className={styles.choix} aria-label="Arrivés par" value={criteres.provenance ?? ''} onChange={(e) => { changer('provenance', e.target.value) }}>
          <option value="">Arrivés par : tous</option>
          {data?.provenances.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={styles.choix} aria-label="Département" value={criteres.departement ?? ''} onChange={(e) => { changer('departement', e.target.value) }}>
          <option value="">Département : tous</option>
          {data?.departements.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={styles.choix} aria-label="Trier" value={criteres.tri} onChange={(e) => { changer('tri', e.target.value) }}>
          {TRIS.map((t) => <option key={t.valeur} value={t.valeur}>{`Trier : ${t.libelle.toLowerCase()}`}</option>)}
        </select>
        <span className={styles.air} />
        <ChampDeRecherche valeur={criteres.recherche} onChange={(q) => { changer('q', q) }} etiquette="Un nom, un e-mail…" />
      </div>
      {exportEchoue && <p className={styles.calme} role="alert">L’export n’a pas pu se faire.</p>}
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && (
        <Bloc>
          <div className={styles.entetesCompte} aria-hidden="true">
            <span /><span>Explorateur</span><span>Arrivé par</span><span>Département</span><span>Fragments</span><span>Dernière visite</span><span>Inscrit</span><span />
          </div>
          {data.lignes.map((c) => <LigneDeCompte key={c.id} compte={c} maintenant={maintenant} />)}
          {data.lignes.length === 0 && <p className={styles.calme}>Aucun compte ne correspond.</p>}
          <Pages total={data.total} decalage={criteres.decalage} parPage={PAR_PAGE} onDecalage={(d) => { changer('page', String(d / PAR_PAGE + 1)) }} />
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
