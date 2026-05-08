import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface HealthState {
  ok: boolean
  status: number
  latency_ms: number
  shop_name?: string | null
  shop_domain?: string | null
  error?: string
  checked_at: string
}

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 min

export function ShopifyHealthBadge() {
  const [state, setState] = useState<HealthState | null>(null)
  const [checking, setChecking] = useState(true)
  const timerRef = useRef<number | null>(null)

  async function runCheck() {
    setChecking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) {
        setState({ ok: false, status: 0, latency_ms: 0, error: 'Pas de session', checked_at: new Date().toISOString() })
        return
      }

      const resp = await fetch('/.netlify/functions/shopify-health-check', {
        headers: { 'Authorization': `Bearer ${jwt}` },
      })
      const data = await resp.json() as HealthState
      setState(data)
    } catch (err) {
      setState({ ok: false, status: 0, latency_ms: 0, error: `${err}`, checked_at: new Date().toISOString() })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    runCheck()
    timerRef.current = window.setInterval(runCheck, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [])

  const dotClass = checking
    ? 'health-dot checking'
    : state?.ok
      ? 'health-dot ok'
      : 'health-dot error'

  const label = checking ? 'Vérification…' : state?.ok ? 'Shopify OK' : 'Shopify KO'

  const tooltip = state
    ? `${state.ok ? '✓' : '✗'} ${state.shop_name || 'Shopify'}\n` +
      `Status HTTP : ${state.status || '—'}\n` +
      `Latence : ${state.latency_ms} ms\n` +
      `Vérifié à ${new Date(state.checked_at).toLocaleTimeString('fr-FR')}` +
      (state.error ? `\n\nErreur : ${state.error}` : '')
    : 'En attente du premier check…'

  return (
    <button
      type="button"
      className="sidebar-health"
      title={tooltip}
      onClick={runCheck}
      disabled={checking}
    >
      <span className={dotClass} />
      <span className="sidebar-health-label">{label}</span>
    </button>
  )
}
