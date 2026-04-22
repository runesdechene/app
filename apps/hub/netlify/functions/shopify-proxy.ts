// Netlify Function : proxy les appels API Shopify pour éviter le CORS
// Token lu depuis process.env.SHOPIFY_ACCESS_TOKEN, auth admin requise

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const DEFAULT_SHOP = 'runes-de-chene.myshopify.com'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (!SHOPIFY_TOKEN) {
    return jsonError('SHOPIFY_ACCESS_TOKEN not configured in env', 500)
  }

  const auth = await requireAdmin(request)
  if ('error' in auth) return jsonError(auth.error, auth.status)

  const url = new URL(request.url)
  const endpoint = url.searchParams.get('endpoint')
  const shop = url.searchParams.get('shop') || DEFAULT_SHOP

  if (!endpoint) return jsonError('Missing endpoint', 400)

  try {
    const shopifyUrl = `https://${shop}/admin/api/2026-01/${endpoint}`
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json',
      },
    }
    if (request.method === 'POST' || request.method === 'PUT') {
      fetchOptions.body = await request.text()
    }

    const resp = await fetch(shopifyUrl, fetchOptions)
    const data = await resp.text()

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
    const linkHeader = resp.headers.get('link')
    if (linkHeader) responseHeaders['Link'] = linkHeader

    return new Response(data, { status: resp.status, headers: responseHeaders })
  } catch (error) {
    return jsonError(`Proxy error: ${error}`, 500)
  }
}

export const config = {
  path: '/.netlify/functions/shopify-proxy',
}
