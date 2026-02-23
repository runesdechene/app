import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState<string | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: 'email'
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleBack = () => {
    setStep('email')
    setOtpCode('')
    setError(null)
  }

  if (step === 'code') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Code de verification</h1>
          <p>Un code a 6 chiffres a ete envoye a <strong>{email}</strong></p>

          <form onSubmit={handleVerifyOtp}>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              disabled={loading}
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem' }}
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verification...' : 'Valider'}
            </button>
          </form>

          <button onClick={handleBack} style={{ marginTop: '0.5rem', background: 'transparent', color: 'var(--color-muted)' }}>
            Changer d'email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>HUB Central</h1>
        <p>Runes de Chene - Administration</p>
        
        <form onSubmit={handleSendOtp}>
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
            {loading ? 'Envoi...' : 'Recevoir un code'}
          </button>
        </form>

        <button
          onClick={() => { if (email) { setStep('code'); setError(null) } }}
          disabled={!email}
          style={{ marginTop: '0.5rem', background: 'transparent', color: 'var(--color-muted)', textDecoration: 'underline', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          J'ai déjà un code
        </button>
      </div>
    </div>
  )
}
