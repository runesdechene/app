/**
 * QUOI     — route de premier niveau /:tab ; laisse passer un onglet connu, redirige le reste.
 * POURQUOI — une adresse inconnue (/nimporte) ne doit jamais donner un écran vide.
 */
import { Navigate, Outlet, useParams } from 'react-router'
import { isTabId } from './tabs'

export function TabRoute() {
  const { tab } = useParams()
  return isTabId(tab) ? <Outlet /> : <Navigate to="/accueil" replace />
}
