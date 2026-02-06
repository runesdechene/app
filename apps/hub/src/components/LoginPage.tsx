import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Email envoye !</h1>
          <p>Verifiez votre boite mail <strong>{email}</strong></p>
          <p>Cliquez sur le lien pour vous connecter.</p>
          <button onClick={() => setSent(false)}>Renvoyer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>HUB Central</h1>
        <p>Runes de Chene - Administration</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@runesdechene.fr"
            required
            disabled={loading}
          />
          
          {error && <p className="error">{error}</p>}
          
          <button type="submit" disabled={loading || !email}>
            {loading ? 'Envoi...' : 'Connexion Magic Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
