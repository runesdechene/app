/**
 * QUOI     — l'option « Mes lieux en couleur », éteinte tant qu'elle n'est pas lue.
 * POURQUOI — la clé `['preferences', 'lieuxEnCouleur']` est le contrat avec la zone Compte :
 *            quand l'Explorateur bascule l'option, les Préférences rafraîchissent
 *            `['preferences', <réglage>]` et la carte se recolore sans qu'une zone importe l'autre.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchLieuxEnCouleur } from '../api/carte'

export function useLieuxEnCouleur(): boolean {
  const query = useQuery({ queryKey: ['preferences', 'lieuxEnCouleur'], queryFn: fetchLieuxEnCouleur })
  return query.data ?? false
}
