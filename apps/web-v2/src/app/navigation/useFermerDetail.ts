/**
 * QUOI     — la fonction qui ferme le détail ouvert (retour, ou racine de l'onglet), après l'avoir
 *            fait glisser hors du tiroir.
 * POURQUOI — une seule règle de fermeture, voir closeDetail.ts ; l'animation, voir
 *            replierDetail.ts.
 */
import { useLocation, useNavigate } from 'react-router'
import { closeDetailTarget, rouvertParUnOnglet } from './closeDetail'
import { replierDetail } from './replierDetail'

export function useFermerDetail(): () => void {
  const location = useLocation()
  const navigate = useNavigate()
  return () => {
    const action = closeDetailTarget({
      pathname: location.pathname,
      hasInAppHistory: location.key !== 'default',
      rouvertParUnOnglet: rouvertParUnOnglet(location.state),
    })
    void replierDetail().then(() => {
      if (action.kind === 'back') void navigate(-1)
      else void navigate(action.to, { replace: true })
    })
  }
}
