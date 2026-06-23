import { useState } from 'react'

type Phase = 'form' | 'done'

export function FlyerGift() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [promoCode, setPromoCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const value = email.trim().toLowerCase()
    if (!value || !value.includes('@') || !value.includes('.')) {
      setError('Entre une adresse email valide.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const resp = await fetch('/.netlify/functions/flyer-create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        setError(data.error || 'Une erreur est survenue, réessaie.')
        return
      }
      setPromoCode(data.promoCode)
      setPhase('done')
    } catch {
      setError('Connexion impossible, réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {phase === 'form' ? (
          <>
            <p style={kicker}>Bienvenue dans la Confrérie</p>
            <h1 style={title}>Voici ton cadeau</h1>
            <p style={body}>
              Laisse ton email : on t'offre un code promo pour la boutique, et tu rejoins
              le Mouvement. Pas de mot de passe, rien à installer.
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ton@email.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={input}
              disabled={submitting}
              autoFocus
            />
            {error && <p style={errorText}>{error}</p>}
            <button onClick={submit} disabled={submitting} style={button}>
              {submitting ? 'Un instant…' : 'Recevoir mon cadeau'}
            </button>
          </>
        ) : (
          <>
            <p style={kicker}>Ton cadeau</p>
            <h1 style={title}>Code promo boutique</h1>
            <p style={body}>Utilise ce code à la boutique en ligne :</p>
            <div style={codeBox}>{promoCode}</div>
            <p style={{ ...body, fontSize: 15, opacity: 0.7 }}>
              On te l'a aussi envoyé par email. À bientôt, Confrère.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1c1814',
  padding: 24,
  boxSizing: 'border-box',
}
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#262019',
  border: '1px solid #3a3026',
  borderRadius: 16,
  padding: 32,
  color: '#f0e9dd',
  textAlign: 'center',
}
const kicker: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: 13,
  color: '#c9a24b',
  margin: '0 0 8px',
}
const title: React.CSSProperties = { fontSize: 28, margin: '0 0 16px', fontWeight: 700 }
const body: React.CSSProperties = { fontSize: 18, lineHeight: 1.5, margin: '0 0 20px' }
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  fontSize: 18,
  borderRadius: 10,
  border: '1px solid #4a3e30',
  background: '#1c1814',
  color: '#f0e9dd',
  marginBottom: 12,
}
const button: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 18,
  fontWeight: 600,
  borderRadius: 10,
  border: 'none',
  background: '#c9a24b',
  color: '#1c1814',
  cursor: 'pointer',
}
const codeBox: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: 3,
  padding: '16px 12px',
  borderRadius: 10,
  border: '1px dashed #c9a24b',
  background: '#1c1814',
  color: '#c9a24b',
  margin: '0 0 16px',
}
const errorText: React.CSSProperties = { color: '#e08a7a', fontSize: 15, margin: '0 0 12px' }
