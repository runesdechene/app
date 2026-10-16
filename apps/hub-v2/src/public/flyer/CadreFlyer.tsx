/**
 * QUOI     — le cadre commun de /flyer et /flyercadeau : la photo et le parchemin restent, seule la
 *            colonne change, avec la transition du navigateur (Uriel, 16/10).
 * POURQUOI — chaque page bâtissait son propre cadre, et le lien rechargeait tout : la page sautait.
 *            Les deux pages sont exportées d'ici pour arriver dans le même morceau de code : passer
 *            de l'une à l'autre ne télécharge rien. Au téléphone, /flyercadeau n'a pas de photo.
 */
import { Outlet, useMatch } from 'react-router'
import fond from '@/assets/flyer/fond-parchemin-entrelacs.webp'
import { PhotoFlyer } from '../briques/PhotoFlyer'
import { PagePublique } from '../PagePublique'

export { PageCadeau } from '../cadeau/PageCadeau'
export { PageFlyer } from './PageFlyer'

export function CadreFlyer() {
  const cadeau = useMatch('/flyercadeau') !== null
  return (
    <PagePublique photo={<PhotoFlyer telephone={!cadeau} />} fond={fond}>
      <Outlet />
    </PagePublique>
  )
}
