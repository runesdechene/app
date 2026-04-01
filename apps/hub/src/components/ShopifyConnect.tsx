import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SHOPIFY_SHOP = 'runes-de-chene.myshopify.com'
const SHOPIFY_CLIENT_ID = import.meta.env.VITE_SHOPIFY_CLIENT_ID || ''
const SHOPIFY_SCOPES = 'read_customers,write_customers,read_orders,read_products'
// Le callback passe par une Netlify Function (pas directement le navigateur → CORS)
const REDIRECT_URI = `${window.location.origin}/.netlify/functions/shopify-callback`

export function ShopifyConnect() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    // Vérifier si on a déjà un token
    supabase.from('app_settings').select('value').eq('key', 'shopify_access_token').single()
      .then(({ data }) => {
        if (data?.value) setToken(data.value)
        setLoading(false)
      })
  }, [])

  function startOAuth() {
    const state = crypto.randomUUID()
    sessionStorage.setItem('shopify_oauth_state', state)

    const authUrl = `https://${SHOPIFY_SHOP}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_CLIENT_ID}` +
      `&scope=${SHOPIFY_SCOPES}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${state}`

    window.location.href = authUrl
  }

  async function shopifyGet(endpoint: string) {
    const resp = await fetch(`/.netlify/functions/shopify-proxy?endpoint=${encodeURIComponent(endpoint)}&token=${encodeURIComponent(token!)}&shop=${SHOPIFY_SHOP}`)
    if (!resp.ok) throw new Error(`Shopify ${resp.status}: ${await resp.text()}`)
    return resp.json()
  }

  async function testConnection() {
    if (!token) return
    setTesting(true)
    setTestError(null)

    try {
      const data = await shopifyGet('customers/count.json')
      setCustomerCount(data.count)
    } catch (err) {
      setTestError(`${err}`)
    } finally {
      setTesting(false)
    }
  }

  async function disconnect() {
    await supabase.from('app_settings').upsert({ key: 'shopify_access_token', value: '' }, { onConflict: 'key' })
    setToken(null)
    setCustomerCount(null)
  }

  if (loading) return <div className="section"><p>Chargement...</p></div>

  return (
    <div className="section">
      <h1>Connexion Shopify</h1>

      {!token ? (
        <div className="divers-card">
          <h3>Connecter la boutique Shopify</h3>
          <p className="divers-description">
            Connectez votre boutique Shopify pour synchroniser les clients et les commandes avec le Hub.
          </p>
          {!SHOPIFY_CLIENT_ID ? (
            <p style={{ color: '#cb2020', fontWeight: 600 }}>
              ⚠️ Variable VITE_SHOPIFY_CLIENT_ID manquante dans le .env
            </p>
          ) : (
            <button className="btn-primary" onClick={startOAuth}>
              Connecter Shopify
            </button>
          )}
        </div>
      ) : (
        <div className="divers-card">
          <h3>✅ Boutique connectée</h3>
          <p className="divers-description">
            Boutique : <strong>{SHOPIFY_SHOP}</strong>
          </p>
          <p style={{ fontSize: 12, color: '#6b5a47', wordBreak: 'break-all' }}>
            Token : {token.slice(0, 8)}...{token.slice(-4)}
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" onClick={testConnection} disabled={testing}>
              {testing ? 'Test...' : 'Tester la connexion'}
            </button>
            <button className="btn-danger" onClick={disconnect}>
              Déconnecter
            </button>
          </div>

          {customerCount !== null && (
            <p style={{ marginTop: 8, color: '#2a7a30', fontWeight: 600 }}>
              ✅ Connexion OK — {customerCount} clients sur Shopify
            </p>
          )}
          {testError && (
            <p style={{ marginTop: 8, color: '#cb2020' }}>
              ❌ {testError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Callback OAuth — reçoit le token depuis la Netlify Function */
export function ShopifyCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    async function saveToken() {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      const shop = params.get('shop')

      if (!token) {
        setError('Pas de token reçu. Le flow OAuth a échoué.')
        setStatus('error')
        return
      }

      // Stocker le token dans app_settings
      await supabase.from('app_settings').upsert(
        { key: 'shopify_access_token', value: token },
        { onConflict: 'key' }
      )

      if (shop) {
        await supabase.from('app_settings').upsert(
          { key: 'shopify_shop', value: shop },
          { onConflict: 'key' }
        )
      }

      setStatus('success')

      // Rediriger vers la page Shopify du Hub après 2s
      setTimeout(() => {
        window.location.href = '/shopify/connect'
      }, 2000)
    }

    saveToken()
  }, [])

  return (
    <div className="section" style={{ textAlign: 'center', padding: 40 }}>
      {status === 'loading' && <p>Enregistrement du token Shopify...</p>}
      {status === 'success' && <p style={{ color: '#2a7a30', fontWeight: 600 }}>✅ Shopify connecté ! Redirection...</p>}
      {status === 'error' && <p style={{ color: '#cb2020' }}>❌ {error}</p>}
    </div>
  )
}
