/**
 * QUOI     — /<onglet>/murmures/<id> : une conversation de Murmures dans le cadre de détail, avec
 *            le portrait, le nom et la dernière connexion en tête (maquette 264:162).
 * POURQUOI — la zone Messages ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre.
 */
import { useParams } from 'react-router'
import { Conversation } from '@/features/messages/components/Conversation'
import { useCorrespondant } from '@/features/messages/hooks/useMurmures'
import { presence } from '@/features/messages/lib/presence'
import { Avatar } from '@/shared/ui/Avatar'
import { DetailPane } from '../shell/DetailPane'

export function RouteMurmure() {
  const { id = '' } = useParams()
  const correspondant = useCorrespondant(id)
  return (
    <DetailPane
      title={correspondant?.nom ?? 'Murmures'}
      avant={
        correspondant && (
          <Avatar url={correspondant.avatar} nom={correspondant.nom} taille="petit" />
        )
      }
      sousTitre={correspondant ? presence(correspondant) : undefined}
    >
      <Conversation key={id} avec={id} />
    </DetailPane>
  )
}
