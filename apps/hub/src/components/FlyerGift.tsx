import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Phase = 'form' | 'done'

// Palette parchemin de l'app (index.css explore-web) — répliquée ici car le hub
// n'a pas ces variables. Polices Bebas Neue / Cabin déjà chargées par index.html.
const C = {
  parchment: '#f7ede1',
  parchmentDark: '#E8D5BE',
  ink: '#4A3728',
  inkLight: '#7D5A3C',
  sepia: '#C19A6B',
  sepiaDark: '#A0784C',
}

export function FlyerGift() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [promoCode, setPromoCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bgUrl, setBgUrl] = useState('')

  // Réutilise l'image de fond hero de la home de l'app (app_settings, lisible en
  // anon). Si absente, on retombe sur un dégradé parchemin.
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['landing_image_mobile_url', 'landing_image_desktop_url'])
      .then(({ data }) => {
        if (!data) return
        const map = Object.fromEntries(data.map(r => [r.key, r.value])) as Record<string, string>
        setBgUrl(map.landing_image_mobile_url || map.landing_image_desktop_url || '')
      })
  }, [])

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

  const pageStyle: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
    fontFamily: "'Cabin', sans-serif",
    background: bgUrl
      ? `linear-gradient(rgba(34,24,16,0.55), rgba(34,24,16,0.72)), url(${bgUrl}) center / cover no-repeat`
      : `linear-gradient(160deg, ${C.parchmentDark}, ${C.sepia})`,
  }

  return (
    <div style={pageStyle}>
      <div style={panel}>
        <img src="/rune-de-chene.png" alt="Runes de Chêne" style={logo} />

        {phase === 'form' ? (
          <>
            <h1 style={title}>Pendant que le monde scrolle, un mouvement s'éveille</h1>
            <p style={body}>
              Répondez à l'appel pour débloquer votre premier cadeau chez Runes de Chêne.
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
            <p style={{ ...body, fontSize: 16, color: C.inkLight, marginBottom: 0 }}>
              On te l'a aussi envoyé par email. À bientôt, Confrère.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: `${C.parchment} url(/background-parchemin.jpg) center / cover no-repeat`,
  border: `1px solid ${C.sepia}`,
  borderRadius: 18,
  padding: '40px 32px',
  color: C.ink,
  textAlign: 'center',
  boxShadow: '0 18px 50px rgba(20, 12, 6, 0.45)',
}
const logo: React.CSSProperties = {
  height: 84,
  width: 'auto',
  objectFit: 'contain',
  margin: '0 auto 16px',
  display: 'block',
  opacity: 0.9,
}
const kicker: React.CSSProperties = {
  fontFamily: "'Cabin Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  fontSize: 15,
  color: C.sepiaDark,
  margin: '0 0 4px',
}
const title: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 'clamp(30px, 7.5vw, 42px)',
  lineHeight: 1.05,
  letterSpacing: '0.02em',
  color: C.ink,
  margin: '0 0 18px',
}
const body: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.5,
  color: C.ink,
  margin: '0 0 22px',
}
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  fontSize: 18,
  fontFamily: "'Cabin', sans-serif",
  borderRadius: 10,
  border: `1px solid ${C.sepia}`,
  background: '#fffaf3',
  color: C.ink,
  marginBottom: 12,
  outline: 'none',
}
const button: React.CSSProperties = {
  width: '100%',
  padding: '15px 16px',
  fontSize: 17,
  fontFamily: "'Cabin Condensed', sans-serif",
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderRadius: 10,
  border: 'none',
  background: C.ink,
  color: C.parchment,
  cursor: 'pointer',
}
const codeBox: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 34,
  letterSpacing: '0.12em',
  padding: '18px 12px',
  borderRadius: 12,
  border: `2px dashed ${C.sepiaDark}`,
  background: C.parchmentDark,
  color: C.ink,
  margin: '0 0 18px',
}
const errorText: React.CSSProperties = {
  color: '#a83232',
  fontSize: 15,
  margin: '0 0 12px',
}
