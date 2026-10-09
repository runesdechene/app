/**
 * QUOI     — décide comment fermer un détail : retour arrière, ou remplacement par la racine.
 * POURQUOI — le retour système doit fermer le détail SANS jamais faire quitter l'app, y compris
 *            quand elle a été ouverte directement sur le détail (lien partagé, rechargement).
 *            Un détail rouvert par son onglet (la mémoire des onglets) a derrière lui l'onglet
 *            d'avant : reculer y mènerait, et le détail resterait ouvert dans la mémoire (le bug
 *            des Préférences, Uriel 28/09). Il se ferme donc sur la racine de son onglet.
 * ATTENTION — `hasInAppHistory` vient de React Router : location.key === 'default' signifie
 *            « première entrée de l'app », donc rien derrière. `rouvertParUnOnglet` : l'état que
 *            pose la barre d'onglets en naviguant (ROUVERT_PAR_UN_ONGLET).
 */
import { tabOf } from './tabs'

export const ROUVERT_PAR_UN_ONGLET = { rouvertParUnOnglet: true } as const

export function rouvertParUnOnglet(etat: unknown): boolean {
  return typeof etat === 'object' && etat !== null && 'rouvertParUnOnglet' in etat
}

export type CloseAction = { kind: 'back' } | { kind: 'replace'; to: string }

export function closeDetailTarget(args: {
  pathname: string
  hasInAppHistory: boolean
  rouvertParUnOnglet?: boolean
}): CloseAction {
  if (args.hasInAppHistory && !args.rouvertParUnOnglet) return { kind: 'back' }
  return { kind: 'replace', to: `/${tabOf(args.pathname) ?? 'accueil'}` }
}
