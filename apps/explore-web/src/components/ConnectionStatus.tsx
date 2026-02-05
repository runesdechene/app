interface ConnectionStatusProps {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error: string | null
}

export function ConnectionStatus({ status, error }: ConnectionStatusProps) {
  const statusConfig = {
    idle: { icon: '⏳', text: 'En attente...', className: 'loading' },
    connecting: { icon: '🔄', text: 'Connexion en cours...', className: 'loading' },
    connected: { icon: '✅', text: 'Connecté à Supabase', className: 'success' },
    error: { icon: '❌', text: 'Connexion échouée', className: 'error' }
  }

  const config = statusConfig[status]

  return (
    <div className={`status ${config.className}`}>
      {status === 'connecting' && <div className="spinner" />}
      <div className="status-icon">{config.icon}</div>
      <h2>{config.text}</h2>
      {error && <p className="error-message">{error}</p>}
    </div>
  )
}
