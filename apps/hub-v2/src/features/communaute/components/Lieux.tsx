/**
 * QUOI     — « Les lieux à modérer » : ceux qu'on a ajoutés depuis la bascule et que personne n'a
 *            vérifiés (la même définition que la pastille du menu), ou les vérifiés, les masqués, tous ;
 *            la fiche de modération s'ouvre par-dessus (route enfant).
 * POURQUOI — filtre, nature, recherche et page sont dans l'adresse.
 */
import { useEffect } from 'react'
import { Link, Outlet, useSearchParams } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import { depuis } from '@/shared/lib/quand'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Pages } from '@/shared/ui/Pages'
import type { Criteres, Filtre, LigneDeLieu } from '../api/lieux'
import { useNatures } from '../hooks/useLieu'
import { useLieux } from '../hooks/useLieux'
import communaute from './Communaute.module.css'
import styles from './Lieux.module.css'

const PAR_PAGE = 50
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'a_moderer', libelle: 'À modérer' }, { valeur: 'verifies', libelle: 'Vérifiés' },
  { valeur: 'masques', libelle: 'Masqués' }, { valeur: 'tous', libelle: 'Tous' },
]
function numeroDePage(texte: string | null): number {
  const page = Math.floor(Number(texte))
  return page >= 1 ? page : 1
}
const nombre = new Intl.NumberFormat('fr-FR')

function LigneDeLieuListe({ lieu, maintenant }: { lieu: LigneDeLieu; maintenant: Date }) {
  const nature = lieu.tags.find((t) => t.is_primary) ?? lieu.tags[0]
  const detail = [`par ${lieu.author_name ?? 'Un Voyageur'}`, depuis(lieu.created_at, maintenant), lieu.address].filter(Boolean).join(' · ')
  return (
    <Link className={styles.ligne} to={`/communaute/lieux/${lieu.id}`}>
      {lieu.thumb_url ? <img className={styles.vignette} src={lieu.thumb_url} alt="" loading="lazy" /> : <span className={styles.vignette} />}
      <span className={styles.qui}>
        <span className={styles.nomEtBalises}>
          <span className={styles.nom}>{lieu.title}</span>
          {nature && <Balise texte={nature.title} teinte="lieu" />}
          {lieu.masked && <Balise texte="Masqué" teinte="sommeil" />}
        </span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <span className={styles.etat}>
        <span>{lieu.visit_count} visites · {lieu.photo_count} photos</span>
        {lieu.verified_at
          ? <span className={styles.verifie}>Vérifié par {lieu.verified_by_name ?? 'l’équipe'}</span>
          : <span className={styles.atraiter}>À traiter</span>}
      </span>
      <img className={styles.chevron} src={chevron} alt="" />
    </Link>
  )
}

export function Lieux() {
  const [params, setParams] = useSearchParams()
  const criteres: Criteres = {
    filtre: FILTRES.find((f) => f.valeur === params.get('filtre'))?.valeur ?? 'a_moderer',
    recherche: params.get('q') ?? '',
    nature: params.get('nature'),
    limite: PAR_PAGE,
    decalage: (numeroDePage(params.get('page')) - 1) * PAR_PAGE,
  }
  const { data, error } = useLieux(criteres)
  const natures = useNatures()
  const maintenant = new Date()

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
    if (valeur === null || valeur === '' || (cle === 'filtre' && valeur === 'a_moderer')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    setParams(suivants)
  }

  return (
    <div className={communaute.ecran}>
      <EnTeteDePage surtitre="Communauté" titre="Les lieux à modérer" phrase={data ? `${nombre.format(data.total)} lieux dans cette vue.` : ''} />
      <div className={communaute.barre}>
        <ChoixSegmente nom="Filtre" options={FILTRES} choisi={criteres.filtre} onChoix={(v) => { changer('filtre', v) }} />
        <select className={communaute.choix} aria-label="Nature" value={criteres.nature ?? ''} onChange={(e) => { changer('nature', e.target.value) }}>
          <option value="">Nature : toutes</option>
          {natures.data?.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
        <span className={communaute.air} />
        <ChampDeRecherche valeur={criteres.recherche} onChange={(q) => { changer('q', q) }} etiquette="Un nom de lieu…" />
      </div>
      {error && <p className={communaute.calme}>{error.message || 'La base ne répond pas.'}</p>}
      {data && (
        <Bloc>
          {data.rows.map((l) => <LigneDeLieuListe key={l.id} lieu={l} maintenant={maintenant} />)}
          {data.rows.length === 0 && <p className={communaute.calme}>Aucun lieu ne correspond.</p>}
          <Pages total={data.total} decalage={criteres.decalage} parPage={PAR_PAGE} onDecalage={(d) => { changer('page', String(d / PAR_PAGE + 1)) }} />
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
