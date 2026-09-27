/**
 * QUOI     — la fonction qui ferme le détail ou le menu ouvert (retour, ou racine de l'onglet).
 * POURQUOI — la même règle pour le cadre de détail et pour le menu avatar : voir closeDetail.ts.
 */
import { useLocation, useNavigate } from 'react-router'
import { closeDetailTarget } from './closeDetail'

export function useFermerDetail(): () => void {
  const location = useLocation()
  const navigate = useNavigate()
  return () => {
    const action = closeDetailTarget({
      pathname: location.pathname,
      hasInAppHistory: location.key !== 'default',
    })
    if (action.kind === 'back') void navigate(-1)
    else void navigate(action.to, { replace: true })
  }
}
