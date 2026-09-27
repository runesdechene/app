/**
 * QUOI     — décide comment fermer un détail : retour arrière, ou remplacement par la racine.
 * POURQUOI — le retour système doit fermer le détail SANS jamais faire quitter l'app, y compris
 *            quand elle a été ouverte directement sur le détail (lien partagé, rechargement).
 * ATTENTION — `hasInAppHistory` vient de React Router : location.key === 'default' signifie
 *            « première entrée de l'app », donc rien derrière.
 */
import { tabOf } from './tabs'

export type CloseAction = { kind: 'back' } | { kind: 'replace'; to: string }

export function closeDetailTarget(args: {
  pathname: string
  hasInAppHistory: boolean
}): CloseAction {
  if (args.hasInAppHistory) return { kind: 'back' }
  return { kind: 'replace', to: `/${tabOf(args.pathname) ?? 'accueil'}` }
}
