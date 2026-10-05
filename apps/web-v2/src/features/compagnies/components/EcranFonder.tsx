/**
 * QUOI     — /<onglet>/compagnies/fonder : le formulaire pour un Porteur, sinon « C'est réservé aux
 *            Porteurs ».
 * POURQUOI — chacun peut toucher « Fonder » ; c'est l'écran qui dit la règle (spec compagnies).
 */
import { useCompagnies } from '../hooks/useCompagnies'
import { FonderCompagnie } from './FonderCompagnie'
import { ReserveAuxPorteurs } from './ReserveAuxPorteurs'

export function EcranFonder() {
  const { liste } = useCompagnies()
  if (liste === undefined) return <div aria-busy="true" />
  return liste.porteur ? <FonderCompagnie /> : <ReserveAuxPorteurs />
}
