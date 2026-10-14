/**
 * QUOI     — « Les comptes » (maquette 594:961) : quatre chiffres, filtres, recherche, la liste par
 *            pages, l'export CSV ; la fiche d'un compte s'ouvre par-dessus (route enfant).
 * POURQUOI — filtre, recherche, provenance, département, tri et page sont dans l'adresse.
 */
import { Outlet, useSearchParams } from 'react-router'
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
  { valeur: 'sommeil', libelle: 'En sommeil' }, { valeur: 'porteurs', libelle: 'Porteurs' }, { valeur: 'equipe', libelle: 'Équipe' },
]
const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: 'visite', libelle: 'Dernière visite' }, { valeur: 'inscription', libelle: 'Inscription' }, { valeur: 'nom', libelle: 'Nom' },
]
const nombre = new Intl.NumberFormat('fr-FR')

export function Comptes() {
  const [params, setParams] = useSearchParams()
  const criteres: Criteres = {
    filtre: FILTRES.find((f) => f.valeur === params.get('filtre'))?.valeur ?? 'tous',
    recherche: params.get('q') ?? '',
    provenance: params.get('provenance'),
    departement: params.get('departement'),
    tri: TRIS.find((t) => t.valeur === params.get('tri'))?.valeur ?? 'visite',
    limite: PAR_PAGE,
    decalage: Math.max(0, Number(params.get('page') ?? '1') - 1) * PAR_PAGE,
  }
  const { data, isError } = useComptes(criteres)
  const maintenant = new Date()

  function changer(cle: string, valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur === null || valeur === '' || (cle === 'filtre' && valeur === 'tous') || (cle === 'tri' && valeur === 'visite')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    setParams(suivants)
  }

  async function telecharger() {
    const csv = await exporterComptes(criteres)
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    lien.download = `comptes-${criteres.filtre}.csv`
    lien.click()
    URL.revokeObjectURL(lien.href)
  }

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Communauté"
        titre="Les comptes"
        phrase={data ? `${nombre.format(data.compteurs.comptes)} Explorateurs.` : ''}
        aDroite={<button className={styles.boutonContour} type="button" onClick={() => void telecharger()}>Exporter en CSV</button>}
      />
      {data && (
        <div className={styles.tuiles}>
          <Tuile libelle="Comptes" valeur={nombre.format(data.compteurs.comptes)} />
          <Tuile libelle="Actifs en 7 jours" valeur={nombre.format(data.compteurs.actifs)} />
          <Tuile libelle="Réactivés depuis la V2" valeur={nombre.format(data.compteurs.reactives)} />
          <Tuile libelle="En sommeil" valeur={nombre.format(data.compteurs.sommeil)} />
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
