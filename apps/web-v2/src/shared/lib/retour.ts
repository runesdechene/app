/**
 * QUOI     — le signal « un écran du tiroir est derrière moi », porté par la navigation.
 * POURQUOI — sur PC, la flèche d'une fiche ne sert que si l'on vient d'un autre écran du tiroir
 *            (un profil, par exemple) : elle y ramène par le retour du navigateur (Uriel, 28/09).
 *            Le lien qui ouvre la fiche pose cet état (`<Link state={VENU_D_UN_ECRAN}>`) ; le
 *            cadre de détail le lit. Rien à tenir à la main : un rechargement l'efface, et c'est
 *            juste — il n'y a alors plus rien derrière.
 */
export const VENU_D_UN_ECRAN = { venuDUnEcran: true } as const

export function venuDUnEcran(etat: unknown): boolean {
  return typeof etat === 'object' && etat !== null && 'venuDUnEcran' in etat
}
