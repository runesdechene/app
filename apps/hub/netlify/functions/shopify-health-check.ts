// Health check léger de la connexion Shopify ↔ Hub.
// Pingé périodiquement par <ShopifyHealthBadge /> dans la sidebar.
// On utilise GET shop.json — endpoint le plus léger qui exige un token valide.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function requireAdmin(request: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = request.headers.get('Authorization') || ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  if (!bearer) return { error: 'Missing Authorization header', status: 401 }

  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${bearer}` },
  })
  if (!userResp.ok) return { error: 'Invalid session', status: 401 }
  const user = await userResp.json() as { id?: string }
  if (!user?.id) return { error: 'Invalid session', status: 401 }

  const roleResp = await fetch(`${SUPABASE_URL}/rest/v1/users?select=role&id=eq.${user.id}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  })
  if (!roleResp.ok) return { error: 'Failed to verify role', status: 500 }
  const rows = await roleResp.json() as Array<{ role?: string }>
  if (!rows[0] || rows[0].role !== 'admin') return { error: 'Forbidden — admin only', status: 403 }

  return { userId: user.id }
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    })
  }

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  // Récupère token Shopify (env Netlify > fallback app_settings)
  let token: string | null = process.env.SHOPIFY_ACCESS_TOKEN || null
  if (!token) {
    const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.shopify_access_token&select=value&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
    const settings = await settingsResp.json()
    token = Array.isArray(settings) && settings.length > 0 ? settings[0].value : null
  }

  const checkedAt = new Date().toISOString()

  if (!token) {
    return json({
      ok: false,
      status: 0,
      latency_ms: 0,
      error: 'Token Shopify absent (env + app_settings vides)',
      checked_at: checkedAt,
    })
  }

  const shop = 'runes-de-chene.myshopify.com'
  const start = Date.now()

  try {
    const resp = await fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    })
    const latency = Date.now() - start

    if (!resp.ok) {
      const body = await resp.text()
      return json({
        ok: false,
        status: resp.status,
        latency_ms: latency,
        error: `Shopify ${resp.status}: ${body.slice(0, 200)}`,
        checked_at: checkedAt,
      })
    }

    const data = await resp.json() as { shop?: { name?: string; domain?: string } }
    return json({
      ok: true,
      status: resp.status,
      latency_ms: latency,
      shop_name: data.shop?.name ?? null,
      shop_domain: data.shop?.domain ?? null,
      checked_at: checkedAt,
    })
  } catch (error) {
    return json({
      ok: false,
      status: 0,
      latency_ms: Date.now() - start,
      error: `Network error: ${error}`,
      checked_at: checkedAt,
    })
  }
}

export const config = {
  path: '/.netlify/functions/shopify-health-check',
}
