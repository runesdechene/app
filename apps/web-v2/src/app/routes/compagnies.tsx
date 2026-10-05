/**
 * QUOI     — /<onglet>/compagnies (la page des Compagnies), /<onglet>/compagnies/fonder et
 *            /<onglet>/compagnie/<id> (sa fiche), dans le cadre de détail.
 * POURQUOI — la zone Compagnies ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre.
 */
import { useParams } from 'react-router'
import { EcranFonder } from '@/features/compagnies/components/EcranFonder'
import { FicheCompagnie } from '@/features/compagnies/components/FicheCompagnie'
import { GererCompagnie } from '@/features/compagnies/components/GererCompagnie'
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

// Une Compagnie = un état neuf : passer de l'une à l'autre efface la feuille « Quitter ».
export function RouteCompagnie() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Compagnie" surImage>
      <FicheCompagnie key={id} id={id} />
    </DetailPane>
  )
}

export function RouteGerer() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Gérer la Compagnie">
      <GererCompagnie key={id} id={id} />
    </DetailPane>
  )
}
