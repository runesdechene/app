/**
 * QUOI     — le détail « Compte », ouvert par l'avatar.
 * POURQUOI — vide dans le socle : il prouve le patron du détail (spec socle §4bis). Son
 *            contenu vient avec la zone Compte (spec V2 §4).
 */
import { EmptyState } from '@/shared/ui/EmptyState'

export function CompteDetail() {
  return <EmptyState>Ton compte est à venir</EmptyState>
}
