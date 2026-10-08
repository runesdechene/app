/**
 * QUOI     — /<onglet>/fragment/<id> : le récit d'un Fragment, ouvert depuis son médaillon sur la carte.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que le récit reçoit le
 *            cadre de détail. La maquette n'a pas de barre de titre : la flèche se pose sur le
 *            parchemin (`titreCache`), le nom est écrit dans la page.
 */
import { useParams } from 'react-router'
import { RecitFragment } from '@/features/fragments/components/RecitFragment'
import { useRecit } from '@/features/fragments/hooks/useRecit'
import { DetailPane } from '../shell/DetailPane'

export function RouteFragment() {
  const id = Number(useParams().id)
  const { recit } = useRecit(id)
  return (
    <DetailPane title={recit?.nom ?? 'Fragment'} titreCache>
      <RecitFragment key={id} id={id} />
    </DetailPane>
  )
}
