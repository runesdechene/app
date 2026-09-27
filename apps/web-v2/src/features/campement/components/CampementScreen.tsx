/**
 * QUOI     — l'écran racine de l'onglet Campement.
 * POURQUOI — vide dans le socle ; la zone Campement a sa propre spec (spec V2 §9).
 */
import { EmptyState } from '@/shared/ui/EmptyState'

export function CampementScreen() {
  return <EmptyState>Le Campement est à venir</EmptyState>
}
