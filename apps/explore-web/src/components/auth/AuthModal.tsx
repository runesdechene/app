import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AuthModalProps {
  onClose: () => void
}

type Step = 'form' | 'sent'

export function AuthModal({ onClose }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
      setError(null)
    }
    setLoading(false)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error) {
      setError('Code invalide ou expiré')
    } else {
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        {step === 'form' ? (
          <>
            <h2 className="auth-modal-title">Rejoignez l'Aventure</h2>
            <p className="auth-modal-subtitle">
              Entrez votre email pour explorer la carte du patrimoine
            </p>

            <form onSubmit={handleSubmit} className="auth-modal-form">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                disabled={loading}
                className="auth-modal-input"
                autoFocus
              />

              {error && <p className="auth-modal-error">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                className="auth-modal-submit"
              >
                {loading ? 'Envoi...' : 'Recevoir le lien magique'}
              </button>
            </form>

            <button
              className="auth-modal-link"
              onClick={() => { if (email) { setStep('sent'); setError(null) } }}
              disabled={!email}
            >
              J'ai déjà un code
            </button>

            <button
              className="auth-modal-skip"
              onClick={onClose}
              type="button"
            >
              Voir la carte sans me connecter
            </button>
          </>
        ) : (
          <div className="auth-modal-sent">
            <h2 className="auth-modal-title">Email envoyé !</h2>
            <p className="auth-modal-subtitle">
              Entrez le code reçu par mail sur <strong>{email}</strong>
            </p>

            <form onSubmit={handleVerifyCode} className="auth-modal-form">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                disabled={loading}
                className="auth-modal-input auth-modal-code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
              />

              {error && <p className="auth-modal-error">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="auth-modal-submit"
              >
                {loading ? 'Vérification...' : 'Valider'}
              </button>
            </form>

            <button
              className="auth-modal-retry"
              onClick={() => { setStep('form'); setCode(''); setError(null) }}
            >
              Changer d'email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
