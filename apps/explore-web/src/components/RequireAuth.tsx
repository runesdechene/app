import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RequireAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', minHeight: '100vh' }}>
        Chargement...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
