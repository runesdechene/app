/**
 * QUOI     — /<onglet>/compagnies/fonder : le formulaire pour un Porteur, sinon « C'est réservé aux
 *            Porteurs ».
 * POURQUOI — chacun peut toucher « Fonder » ; c'est l'écran qui dit la règle (spec compagnies).
 */
import { useCompagnies } from '../hooks/useCompagnies'
import { ReserveAuxPorteurs } from './ReserveAuxPorteurs'

export function EcranFonder() {
  const { liste } = useCompagnies()
  if (liste === undefined) return <div aria-busy="true" />
  // Le formulaire d'un Porteur arrive avec « Fonder » (tâche 7 du plan).
  return liste.porteur ? null : <ReserveAuxPorteurs />
}
