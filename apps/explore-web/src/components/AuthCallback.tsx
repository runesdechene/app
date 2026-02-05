import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession()
      
      if (error) {
        setError(error.message)
        setStatus('error')
      } else {
        setStatus('success')
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
    }

    handleCallback()
  }, [])

  if (status === 'loading') {
    return (
      <div className="auth-callback">
        <div className="spinner" />
        <p>Connexion en cours...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="auth-callback error">
        <p>Erreur de connexion</p>
        <p className="error-message">{error}</p>
        <a href="/">Retour à l'accueil</a>
      </div>
    )
  }

  return (
    <div className="auth-callback success">
      <p>Connexion réussie !</p>
      <p>Redirection...</p>
    </div>
  )
}
