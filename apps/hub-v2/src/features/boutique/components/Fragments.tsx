/**
 * QUOI     — « Les Fragments » : une ligne par Fragment (vignette, nom, état de l'origine, « À filmer ») ;
 *            la fiche s'ouvre par-dessus (route enfant). En tête, la synchro depuis Shopify ; en bas, les
 *            motifs Shopify qui ne sont aucun Fragment.
 * POURQUOI — le contenu des Fragments vient de Shopify : le Hub ne l'écrit pas, il le synchronise. « À filmer »
 *            = un Fragment visible dont aucune vue n'a encore servi de référence au scan.
 */
import { Link, Outlet, useLocation } from 'react-router'
import { depuis } from '@/shared/lib/quand'
import { pluriel } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Fragment } from '../api/fragments'
import { useFragments, useScans } from '../hooks/useFragments'
import { useSynchroFragments } from '../hooks/useSynchroFragments'
import styles from './Boutique.module.css'
import { MotifsSansFragment } from './MotifsSansFragment'
import { OngletsFragments } from './OngletsFragments'

function origine(f: Fragment): string {
  if (f.origine_nom) return f.origine_nom
  return f.origine_lat === null ? 'Origine à poser' : 'Origine posée'
}

function LigneDeFragment({ fragment, aFilmer }: { fragment: Fragment; aFilmer: boolean }) {
  const { search } = useLocation()
  return (
    <Link className={styles.ligne} to={{ pathname: String(fragment.id), search }}>
      {fragment.illustration_url ? <img className={styles.vignette} src={fragment.illustration_url} alt="" /> : <span className={styles.vignette} />}
      <span className={styles.nom}>
        <strong>{fragment.name}</strong>
        {fragment.visible ? <span>{origine(fragment)}</span> : <Balise texte="Masqué" teinte="sommeil" />}
      </span>
      {aFilmer && <Balise texte="À filmer" teinte="moderation" />}
    </Link>
  )
}

export function Fragments() {
  const { data: fragments, isError } = useFragments()
  const { data: scans } = useScans()
  const synchro = useSynchroFragments()

  // Tant que les scans ne sont pas lus, personne n'est « à filmer » : on ne l'affirme pas.
  const avecVue = new Set((scans ?? []).filter((s) => s.vues.length > 0).map((s) => s.id))
  const aFilmer = (f: Fragment) => scans !== undefined && f.visible && !avecVue.has(f.id)

  const dernier = (fragments ?? []).flatMap((f) => (f.synchronise_le ? [f.synchronise_le] : [])).sort().at(-1)
  const phrase = fragments
    ? `${String(fragments.length)} ${pluriel(fragments.length, 'Fragment')} · contenu tiré de Shopify, ${dernier ? `synchronisé ${depuis(dernier)}` : 'jamais synchronisé'} · ${String(fragments.filter(aFilmer).length)} à filmer pour le scan`
    : ''

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Fragments et boutique"
        titre="Les Fragments"
        phrase={phrase}
        aDroite={
          <button type="button" className={styles.boutonContour} disabled={synchro.enCours} onClick={() => void synchro.synchroniser()}>
            {synchro.enCours ? 'Synchronisation…' : 'Synchroniser depuis Shopify'}
          </button>
        }
      />
      <OngletsFragments />
      {synchro.compteRendu && <p className={styles.calme} role="status">{synchro.compteRendu}</p>}
      {synchro.erreur && <p className={styles.erreur} role="alert">{synchro.erreur}</p>}
      {isError && <p className={styles.erreur} role="alert">La base ne répond pas.</p>}
      {fragments && <Bloc>{fragments.map((f) => <LigneDeFragment key={f.id} fragment={f} aFilmer={aFilmer(f)} />)}</Bloc>}
      <MotifsSansFragment />
      <Outlet />
    </div>
  )
}
