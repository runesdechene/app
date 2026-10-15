/**
 * QUOI     — les petites règles des achats et de la correspondance Shopify : l'étiquette telle que le
 *            webhook la lit, les étiquettes d'un journal de commande, les libellés de statut.
 * POURQUOI — le webhook compare les étiquettes produit en minuscules : une étiquette enregistrée autrement
 *            ne correspondrait jamais. Le journal d'une commande sans correspondance range ses étiquettes
 *            après « tags_found: », séparées par des virgules, suivies de « |no_unlock_match ».
 */
export const STATUTS_ACHAT = { pending: 'Attend son inscription', no_match: 'Aucun Fragment trouvé' }

export function etiquetteNormale(tag: string): string {
  return tag.trim().toLowerCase()
}

export function tagsDuJournal(tag: string | null): string[] {
  const trouvees = /^tags_found:([^|]*)/.exec(tag ?? '')?.[1]
  if (!trouvees) return []
  return [...new Set(trouvees.split(',').map(etiquetteNormale).filter(Boolean))]
}
