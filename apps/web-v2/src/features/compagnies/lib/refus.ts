/**
 * QUOI     — la phrase d'un refus de la base (migration 421), selon son indice.
 * POURQUOI — chaque refus a son indice (`porteur`, `nom_pris`, `role`, `nom`) : chacun sa phrase.
 */
export function messageDeRefus(erreur: unknown): string {
  const indice =
    typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  if (indice === 'nom_pris') return 'Ce nom est déjà pris.'
  if (indice === 'porteur') return 'Fonder une Compagnie est réservé aux Porteurs.'
  if (indice === 'role') return 'Ce geste est réservé au Chef ou aux Officiers.'
  if (indice === 'nom')
    return 'Un champ dépasse la longueur permise : vérifie le nom, la devise et la mission.'
  return 'Ça n’a pas pu être enregistré. Réessaie dans un instant.'
}
