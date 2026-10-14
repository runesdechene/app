/**
 * QUOI     — les règles d'une nature (catégorie de lieu) : l'identifiant tiré du nom, la forme d'une couleur,
 *            les valeurs d'une nature neuve.
 * POURQUOI — l'identifiant d'une nature se fixe à la création et ne change plus (les lieux le portent).
 */
export const COULEUR = /^#[0-9a-fA-F]{6}$/
export const COULEURS_PAR_DEFAUT = { texte: '#C19A6B', fond: '#F5E6D3' }

export function slugDe(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
