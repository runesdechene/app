// Endpoint PUBLIC (pas d'auth) atteint par le QR code des flyers.
// Crée un compte fantôme à partir d'un email et renvoie un code promo boutique.
// Calqué sur stand-create-account.ts, MAIS public → garde-fous : idempotence email
// + rate-limit par IP (table flyer_signup_log). Code promo générique via env FLYER_PROMO_CODE.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROMO_CODE = process.env.FLYER_PROMO_CODE || 'CONFRERIE'

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 heure
const RATE_LIMIT_MAX = 15 // tentatives max par IP et par fenêtre

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function clientIp(request: Request): string {
  const nf = request.headers.get('x-nf-client-connection-ip')
  if (nf) return nf
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'unknown'
}

function buildTags(existing: string): string {
  const tags = existing.split(',').map(t => t.trim()).filter(Boolean)
  const filtered = tags.filter(t => !t.startsWith('source:'))
  const tagSet = new Set(filtered)
  tagSet.add('app-player')
  tagSet.add('source:flyer')
  return Array.from(tagSet).join(', ')
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Missing Supabase env vars' }, 500)

  let email: string
  try {
    const body = await request.json()
    email = String(body.email || '').trim().toLowerCase()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!email || !email.includes('@')) return json({ error: 'Invalid email' }, 400)

  const ip = clientIp(request)

  // 0. Rate-limit par IP : compte les tentatives de la dernière heure.
  const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const rlResp = await fetch(
    `${SUPABASE_URL}/rest/v1/flyer_signup_log?ip=eq.${encodeURIComponent(ip)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  if (rlResp.ok) {
    const rows = await rlResp.json() as Array<{ id: number }>
    if (Array.isArray(rows) && rows.length >= RATE_LIMIT_MAX) {
      return json({ error: 'Trop de tentatives, réessaie dans un moment.' }, 429)
    }
  }

  // Journalise la tentative (best-effort, ne bloque pas le flow).
  await fetch(`${SUPABASE_URL}/rest/v1/flyer_signup_log`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ip, email }),
  })

  // 1. Idempotence : email déjà connu côté Supabase → on réaffiche le code, pas de doublon.
  const existingResp = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email_address=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  const existingRows = await existingResp.json() as Array<{ id: string }>
  if (existingRows.length > 0) {
    return json({ success: true, action: 'already_exists', promoCode: PROMO_CODE })
  }

  // 2. Token Shopify (env ou app_settings).
  let shopifyToken: string | null = process.env.SHOPIFY_ACCESS_TOKEN || null
  if (!shopifyToken) {
    const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.shopify_access_token&select=value&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
    const settings = await settingsResp.json()
    shopifyToken = Array.isArray(settings) && settings.length > 0 ? settings[0].value : null
  }
  if (!shopifyToken) return json({ error: 'Shopify not connected' }, 500)

  const shop = 'runes-de-chene.myshopify.com'

  try {
    // 3. Customer Shopify existant ? (achat antérieur sans inscription app)
    let customerId: number | null = null
    const searchResp = await fetch(
      `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email,tags`,
      { headers: { 'X-Shopify-Access-Token': shopifyToken } }
    )
    if (searchResp.ok) {
      const searchData = await searchResp.json() as { customers?: Array<{ id: number; tags: string }> }
      if (searchData.customers && searchData.customers.length > 0) {
        const existing = searchData.customers[0]
        customerId = existing.id
        await fetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json`, {
          method: 'PUT',
          headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: {
              id: customerId,
              tags: buildTags(existing.tags || ''),
              email_marketing_consent: {
                state: 'subscribed',
                opt_in_level: 'single_opt_in',
                consent_updated_at: new Date().toISOString(),
              },
            },
          }),
        })
      }
    }

    // 4. Sinon création du customer Shopify.
    if (customerId === null) {
      const createResp = await fetch(`https://${shop}/admin/api/2026-01/customers.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email,
            tags: buildTags(''),
            email_marketing_consent: {
              state: 'subscribed',
              opt_in_level: 'single_opt_in',
              consent_updated_at: new Date().toISOString(),
            },
          },
        }),
      })
      if (!createResp.ok) {
        const err = await createResp.text()
        return json({ error: `Shopify create failed: ${err.slice(0, 300)}` }, 500)
      }
      const createData = await createResp.json() as { customer?: { id: number } }
      customerId = createData.customer?.id ?? null
      if (!customerId) return json({ error: 'Shopify customer created but no id returned' }, 500)
    }

    // 5. Insert user Supabase fantôme — pattern shopify-sync : id = "shopify-{customer.id}".
    const newUser = {
      id: `shopify-${customerId}`,
      email_address: email,
      first_name: 'Pionnier',
      shopify_customer_id: customerId,
      account_source: 'flyer',
      is_active: true,
      role: 'user',
      rank: '',
      biography: '',
      created_at: new Date().toISOString(),
    }
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(newUser),
    })
    if (!insertResp.ok) {
      const err = await insertResp.text()
      return json({ error: `Supabase insert failed: ${err.slice(0, 300)}`, customerId }, 500)
    }

    return json({ success: true, action: 'created', promoCode: PROMO_CODE })
  } catch (error) {
    return json({ error: `${error}` }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/flyer-create-account',
}
