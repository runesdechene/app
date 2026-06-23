import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthForm } from '../../hooks/useAuthForm'
import logoImg from '../../assets/logo_couleur.webp'
import changelogRaw from '../../../CHANGELOG.md?raw'
import './AuthModal.css'

const appVersion = changelogRaw.split('\n').find(l => l.startsWith('# '))?.slice(2).trim() ?? ''

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const {
    email, setEmail,
    code, setCode,
    step, setStep,
    loading, error,
    requestCode, verifyCode,
  } = useAuthForm({ onSuccess: onClose })

  const [placesCount, setPlacesCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('places').select('*', { count: 'exact', head: true }).then(({ count }) => {
      if (count) setPlacesCount(count)
    })
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void requestCode()
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    void verifyCode()
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <a
        href="https://runesdechene.com"
        className="auth-back-button"
        onClick={e => e.stopPropagation()}
      >
        <span className="auth-back-arrow">&#8592;</span>
        Retour à la boutique
      </a>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        {appVersion && <span className="auth-modal-version">{appVersion}</span>}
        <button className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        {step === 'form' ? (
          <>
            <img src={logoImg} alt="Runes de Chêne" className="auth-modal-logo" />
            <p className="auth-modal-subtitle">
            Découvrez & explorez plus de <b className="auth-modal-places">{placesCount ? `${placesCount}` : '+ de 2000'}</b> lieux Historiques, magiques ou atypiques de votre région. Choisissez votre classe d'explorateur inspirée par <a href="https://runesdechene.com/">Nos Collections</a>, et
            progressez aux côtés de <b>milliers de clients Runes de Chêne</b> qui cartographient leur patrimoine en s'amusant.
            </p>

            <p className="auth-modal-subtitle"><i><b>
              Application en ALPHA, les règles et fonctionnalités peuvent changer arbitrairement à chaque mise à jour
              </b></i></p>


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
              onClick={() => { if (email) setStep('sent') }}
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

            <p className="auth-modal-newsletter">Toute inscription vous abonne de facto à la newsletter de la marque Runes de Chêne.</p>
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
              onClick={() => { setStep('form'); setCode('') }}
            >
              Changer d'email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
