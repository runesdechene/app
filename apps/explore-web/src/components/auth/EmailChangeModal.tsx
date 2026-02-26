import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface EmailChangeModalProps {
  currentEmail: string
  onClose: () => void
}

type Step = 'form' | 'sent'

export function EmailChangeModal({ currentEmail, onClose }: EmailChangeModalProps) {
  const [newEmail, setNewEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail || newEmail === currentEmail) return

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ email: newEmail })

    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
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
            <h2 className="auth-modal-title">Changer mon email</h2>
            <p className="auth-modal-subtitle">
              Email actuel : <strong>{currentEmail}</strong>
            </p>

            <form onSubmit={handleSubmit} className="auth-modal-form">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="nouveau@email.com"
                required
                disabled={loading}
                className="auth-modal-input"
                autoFocus
              />

              {error && <p className="auth-modal-error">{error}</p>}

              <button
                type="submit"
                disabled={loading || !newEmail || newEmail === currentEmail}
                className="auth-modal-submit"
              >
                {loading ? 'Envoi...' : 'Confirmer le changement'}
              </button>
            </form>
          </>
        ) : (
          <div className="auth-modal-sent">
            <h2 className="auth-modal-title">Email de confirmation envoy&eacute; !</h2>
            <p className="auth-modal-subtitle">
              Un lien de confirmation a &eacute;t&eacute; envoy&eacute; &agrave; <strong>{newEmail}</strong>.
              Cliquez sur le lien dans l'email pour finaliser le changement.
            </p>
            <button
              className="auth-modal-submit"
              onClick={onClose}
            >
              Compris
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
