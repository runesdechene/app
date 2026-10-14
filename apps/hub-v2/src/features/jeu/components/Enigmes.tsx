/**
 * QUOI     — « Les énigmes » : les chiffres, les filtres, la recherche, la liste par pages ; l'éditeur
 *            d'une énigme (ou la création) s'ouvre par-dessus (route enfant).
 * POURQUOI — état, culture, difficulté, recherche et page sont dans l'adresse. La liste n'écrit rien :
 *            activer une énigme se fait dans son éditeur (c'est un champ du formulaire).
 */
import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { texteEnClair } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Pages } from '@/shared/ui/Pages'
import { Tuile } from '@/shared/ui/Tuile'
import type { Actives, Criteres, LigneEnigme } from '../api/enigmes'
import { useCultures, useEnigmes } from '../hooks/useEnigmes'
import { DIFFICULTES, type Difficulte } from '../lib/enigme'
import styles from './Jeu.module.css'

const PAR_PAGE = 50
const ETATS: { valeur: Actives; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' }, { valeur: 'actives', libelle: 'Actives' }, { valeur: 'inactives', libelle: 'Inactives' },
]
function numeroDePage(texte: string | null): number {
  const page = Math.floor(Number(texte))
  return page >= 1 ? page : 1
}
const nombre = new Intl.NumberFormat('fr-FR')

function LigneDEnigme({ enigme, culture }: { enigme: LigneEnigme; culture: string }) {
  const { search } = useLocation()
  return (
    <Link className={styles.ligneEnigme} to={{ pathname: String(enigme.id), search }}>
      <span className={styles.numero}>n° {enigme.id}</span>
      <span className={styles.question}>{texteEnClair(enigme.question)}</span>
      <span className={styles.etiquettes}>
        <Balise texte={culture} teinte="enigme" />
        <span>{DIFFICULTES[enigme.difficulte]}</span>
        {enigme.active ? <span>Active</span> : <Balise texte="Inactive" teinte="sommeil" />}
      </span>
    </Link>
  )
}

export function Enigmes() {
  const [params, setParams] = useSearchParams()
  const { search } = useLocation()
  const { data: cultures = [] } = useCultures()
  const criteres: Criteres = {
    culture: params.get('culture'),
    difficulte: (Object.keys(DIFFICULTES) as Difficulte[]).find((d) => d === params.get('difficulte')) ?? null,
    actives: ETATS.find((e) => e.valeur === params.get('etat'))?.valeur ?? 'toutes',
    recherche: params.get('q') ?? '',
    limite: PAR_PAGE,
    decalage: (numeroDePage(params.get('page')) - 1) * PAR_PAGE,
  }
  const { data, isError } = useEnigmes(criteres)
  const nomDeCulture = (id: string | null) => (id === null ? 'Universelle' : (cultures.find((c) => c.id === id)?.label ?? id))

  function changer(cle: string, valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur === null || valeur === '' || (cle === 'etat' && valeur === 'toutes')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    setParams(suivants)
  }

  const plusFournies = data ? Object.entries(data.compteurs.parCulture).sort((a, b) => b[1] - a[1]).slice(0, 2) : []

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Le jeu"
        titre="Les énigmes"
        phrase={data ? `${nombre.format(data.compteurs.actives)} énigmes actives sur ${nombre.format(data.compteurs.toutes)}.` : ''}
        aDroite={<Link className={styles.boutonContour} to={{ pathname: 'nouvelle', search }}>+ Nouvelle énigme</Link>}
      />
      {data && (
        <div className={styles.tuiles}>
          <Tuile libelle="Toutes" valeur={nombre.format(data.compteurs.toutes)} />
          <Tuile libelle="Actives" valeur={nombre.format(data.compteurs.actives)} />
          {plusFournies.map(([id, n]) => <Tuile key={id} libelle={nomDeCulture(id)} valeur={nombre.format(n)} />)}
        </div>
      )}
      <div className={styles.barre}>
        <ChoixSegmente nom="État" options={ETATS} choisi={criteres.actives} onChoix={(v) => { changer('etat', v) }} />
        <select className={styles.choixDeFiltre} aria-label="Culture" value={criteres.culture ?? ''} onChange={(e) => { changer('culture', e.target.value) }}>
          <option value="">Toutes les cultures</option>
          {cultures.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className={styles.choixDeFiltre} aria-label="Difficulté" value={criteres.difficulte ?? ''} onChange={(e) => { changer('difficulte', e.target.value) }}>
          <option value="">Toutes les difficultés</option>
          {Object.entries(DIFFICULTES).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
        </select>
        <span className={styles.air} />
        <ChampDeRecherche valeur={criteres.recherche} onChange={(q) => { changer('q', q) }} etiquette="Une question, une réponse…" />
      </div>
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && (
        <Bloc>
          {data.lignes.map((e) => <LigneDEnigme key={e.id} enigme={e} culture={nomDeCulture(e.culture)} />)}
          {data.lignes.length === 0 && <p className={styles.calme}>Aucune énigme ne correspond.</p>}
          <Pages total={data.total} decalage={criteres.decalage} parPage={PAR_PAGE} onDecalage={(d) => { changer('page', String(d / PAR_PAGE + 1)) }} />
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
