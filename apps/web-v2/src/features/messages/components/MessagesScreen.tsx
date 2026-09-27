/**
 * QUOI     — l'écran racine de l'onglet Messages.
 * POURQUOI — vide dans le socle ; la zone Messages a sa propre spec (spec V2 §10).
 */
import { EmptyState } from '@/shared/ui/EmptyState'

export function MessagesScreen() {
  return <EmptyState>Les Messages sont à venir</EmptyState>
}
