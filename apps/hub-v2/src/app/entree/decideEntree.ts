/**
 * QUOI     — décide ce que la porte du Hub montre, à partir de l'état de la session.
 * POURQUOI — fonction pure : toute la logique de la porte se teste sans navigateur.
 */
export type EtatEntree =
  | { statut: 'lecture' }
  | { statut: 'erreur' }
  | { statut: 'pret'; session: boolean; admin: boolean }

export type Decision = 'attendre' | 'code' | 'refuse' | 'ouvrir' | 'reessayer'

export function decideEntree(etat: EtatEntree): Decision {
  switch (etat.statut) {
    case 'lecture':
      return 'attendre'
    case 'erreur':
      return 'reessayer'
    case 'pret':
      if (!etat.session) return 'code'
      return etat.admin ? 'ouvrir' : 'refuse'
  }
}
