/**
 * QUOI     — /<onglet>/fragment/<id> : la fiche d'un Fragment (maquettes C et D, spec du Codex) ;
 *            /<onglet>/fragment/<id>/histoire : son histoire entière, à lire ou à écouter (le Récit).
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que la fiche reçoit le
 *            cadre de détail, et le skin (le signe du profil, zone Compte). La maquette n'a pas de
 *            barre de titre : la flèche se pose sur le parchemin (`titreCache`).
 */
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useChoisirSigne } from '@/features/compte/hooks/useChoisirSigne'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { FicheFragment } from '@/features/fragments/components/FicheFragment'
import { RecitFragment } from '@/features/fragments/components/RecitFragment'
import { cleMonFragment } from '@/features/fragments/hooks/useMonFragment'
import { useRecit } from '@/features/fragments/hooks/useRecit'
import { DetailPane } from '../shell/DetailPane'

export function RouteFragment() {
  const id = Number(useParams().id)
  const { recit } = useRecit(id)
  const { choisir } = useChoisirSigne(useMonIdentifiant() ?? '')
  const client = useQueryClient()

  async function equiper(fragment: number) {
    await choisir(fragment)
    await client.invalidateQueries({ queryKey: cleMonFragment(fragment) })
  }

  return (
    <DetailPane title={recit?.nom ?? 'Fragment'} titreCache>
      <FicheFragment key={id} id={id} connecte equiper={equiper} />
    </DetailPane>
  )
}

export function RouteHistoireFragment() {
  const id = Number(useParams().id)
  const { recit } = useRecit(id)
  return (
    <DetailPane title={recit?.nom ?? 'Fragment'} titreCache>
      <RecitFragment key={id} id={id} />
    </DetailPane>
  )
}
