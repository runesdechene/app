/**
 * QUOI     — /<onglet>/compagnies (la page des Compagnies) et /<onglet>/compagnies/fonder, dans le
 *            cadre de détail.
 * POURQUOI — la zone Compagnies ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre.
 */
import { EcranFonder } from '@/features/compagnies/components/EcranFonder'
import { PageCompagnies } from '@/features/compagnies/components/PageCompagnies'
import { DetailPane } from '../shell/DetailPane'

export function RouteCompagnies() {
  return (
    <DetailPane title="Les Compagnies">
      <PageCompagnies />
    </DetailPane>
  )
}

export function RouteFonder() {
  return (
    <DetailPane title="Fonder une Compagnie">
      <EcranFonder />
    </DetailPane>
  )
}
