/**
 * QUOI     — dire si un motif Shopify (métaobjet Illustration) est déjà un Fragment.
 * POURQUOI — un Fragment se relie à son motif par le handle du métaobjet, ou à défaut par la collection
 *            de son lien (les premiers Fragments n'ont pas de handle).
 */
import type { Fragment } from '../api/fragments'
import type { Illustration } from '../api/shopify'

type Motif = Pick<Illustration, 'handle' | 'collection'>
type Relie = Pick<Fragment, 'shopify_handle' | 'link_url'>

export function estUnFragment(motif: Motif, fragments: Relie[]): boolean {
  const collection = motif.collection.toLowerCase()
  return fragments.some(
    (f) =>
      f.shopify_handle === motif.handle ||
      (collection !== '' && (f.link_url ?? '').toLowerCase().endsWith(`/collections/${collection}`)),
  )
}

export function motifsSansFragment<M extends Motif>(motifs: M[], fragments: Relie[]): M[] {
  return motifs.filter((m) => !estUnFragment(m, fragments))
}
