import { useAuthForm } from '../../hooks/useAuthForm'
import './LandingAuthForm.css'

interface LandingAuthFormProps {
  onSuccess: () => void
  onBack: () => void
}

export default function LandingAuthForm({ onSuccess, onBack }: LandingAuthFormProps) {
  const {
    email, setEmail,
    code, setCode,
    step, setStep,
    loading, error,
    requestCode, verifyCode,
  } = useAuthForm({ onSuccess })

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    void requestCode()
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    void verifyCode()
  }

  return (
    <div className="landing-auth">
      <button type="button" className="landing-auth__back" onClick={onBack} aria-label="Revenir">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>Retour</span>
      </button>

      {step === 'form' ? (
        <>
          <h2 className="landing-auth__title">Se connecter</h2>
          <p className="landing-auth__hint">Entrez votre email — vous recevrez un code à 6 chiffres pour vous connecter.</p>

          <form className="landing-auth__form" onSubmit={handleEmailSubmit}>
            <label className="landing-auth__field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
            </label>

            {error && <p className="landing-auth__error" role="alert">{error}</p>}

            <button type="submit" className="landing-auth__submit" disabled={loading || !email}>
              {loading ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>

          <button
            type="button"
            className="landing-auth__toggle"
            onClick={() => { if (email) setStep('sent') }}
            disabled={!email}
          >
            J'ai déjà un code
          </button>
        </>
      ) : (
        <>
          <h2 className="landing-auth__title">Code reçu ?</h2>
          <p className="landing-auth__hint">Entrez le code à 6 chiffres reçu sur <strong>{email}</strong>.</p>

          <form className="landing-auth__form" onSubmit={handleCodeSubmit}>
            <label className="landing-auth__field">
              <span>Code</span>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                disabled={loading}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                className="landing-auth__code"
              />
            </label>

            {error && <p className="landing-auth__error" role="alert">{error}</p>}

            <button type="submit" className="landing-auth__submit" disabled={loading || code.length !== 6}>
              {loading ? 'Vérification...' : 'Valider'}
            </button>
          </form>

          <button
            type="button"
            className="landing-auth__toggle"
            onClick={() => { setStep('form'); setCode('') }}
          >
            Changer d'email
          </button>
        </>
      )}
    </div>
  )
}
