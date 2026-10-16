/**
 * QUOI     — le Fragment d'un produit porté, deviné d'après son nom (« T-shirt Yggdrasil » → Yggdrasil).
 */
import type { Fragment } from '../api/fragments'

export function fragmentDuProduit(fragments: Fragment[], produit: string | null): Fragment | undefined {
  const p = produit?.toLowerCase()
  return p ? fragments.find((f) => p.includes(f.name.toLowerCase())) : undefined
}
