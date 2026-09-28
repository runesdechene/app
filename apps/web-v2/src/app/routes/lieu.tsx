/**
 * QUOI     — /<onglet>/lieu/<id> : la fiche dans le cadre de détail, et ses feuilles.
 * POURQUOI — la zone Lieu ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre.
 */
import { useParams } from 'react-router'
import { FicheLieu } from '@/features/lieu/components/FicheLieu'
import { DetailPane } from '../shell/DetailPane'

export function RouteLieu() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Lieu" surImage>
      <FicheLieu
        id={id}
        onOptions={() => undefined}
        onPartager={() => undefined}
        boutonVisite={() => null}
      />
    </DetailPane>
  )
}
