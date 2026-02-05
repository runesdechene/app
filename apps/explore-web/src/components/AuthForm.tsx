import { useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthMode = 'magic_link' | 'sent'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<AuthMode>('magic_link')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setMode('sent')
    }
    setLoading(false)
  }

  if (mode === 'sent') {
    return (
      <div className="auth-form">
        <div className="auth-success">
          <h2>Email envoyé !</h2>
          <p>Vérifiez votre boîte mail <strong>{email}</strong></p>
          <p>Cliquez sur le lien magique pour vous connecter.</p>
          <button onClick={() => setMode('magic_link')}>
            Renvoyer un email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-form">
      <h2>Connexion</h2>
      <form onSubmit={handleMagicLink}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            disabled={loading}
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" disabled={loading || !email}>
          {loading ? 'Envoi...' : 'Recevoir un lien magique'}
        </button>
      </form>
    </div>
  )
}
