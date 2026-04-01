// Netlify Function : met à jour les tags d'un client Shopify existant
// Appelé depuis le Hub (Users.tsx, ShopifySync.tsx) pour synchroniser les tags

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function shopifyFetch(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resp = await fetch(url, options)
    if (resp.status === 429) {
      // Rate limited — attendre le temps indiqué par Shopify ou 2s par défaut
      const retryAfter = parseFloat(resp.headers.get('Retry-After') || '2')
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      continue
    }
    return resp
  }
  // Dernier essai sans retry
  return fetch(url, options)
}

function mergeTags(existing: string, newTags: string[], removePrefixes: string[]): string {
  const tags = existing.split(',').map(t => t.trim()).filter(Boolean)
  const filtered = tags.filter(t => !removePrefixes.some(p => t.startsWith(p)))
  const tagSet = new Set(filtered)
  for (const t of newTags) tagSet.add(t)
  return Array.from(tagSet).join(', ')
}

export default async function handler(request: Request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let email: string
  let shopifyCustomerId: number | undefined
  let tags: string[]
  let removePrefixes: string[]

  try {
    const body = await request.json()
    email = body.email
    shopifyCustomerId = body.shopifyCustomerId
    tags = body.tags || []
    removePrefixes = body.removePrefixes || []
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!email && !shopifyCustomerId) {
    return json({ error: 'Missing email or shopifyCustomerId' }, 400)
  }

  // Récupérer le token Shopify depuis app_settings
  const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.shopify_access_token&select=value&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  const settings = await settingsResp.json()
  const shopifyToken = Array.isArray(settings) && settings.length > 0 ? settings[0].value : null

  if (!shopifyToken) {
    return json({ error: 'Shopify not connected' }, 500)
  }

  const shop = 'runes-de-chene.myshopify.com'

  try {
    let customerId = shopifyCustomerId
    let existingTags = ''

    if (customerId) {
      // Fetch direct par ID
      const resp = await shopifyFetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json?fields=id,tags`, {
        headers: { 'X-Shopify-Access-Token': shopifyToken },
      })
      if (!resp.ok) {
        return json({ success: false, reason: 'not_found', details: `Customer ${customerId} not found` })
      }
      const data = await resp.json()
      existingTags = data.customer?.tags || ''
    } else {
      // Search par email
      const searchResp = await shopifyFetch(`https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,tags`, {
        headers: { 'X-Shopify-Access-Token': shopifyToken },
      })
      if (!searchResp.ok) {
        return json({ success: false, reason: 'search_failed' })
      }
      const searchData = await searchResp.json()
      if (!searchData.customers || searchData.customers.length === 0) {
        return json({ success: false, reason: 'not_found' })
      }
      customerId = searchData.customers[0].id
      existingTags = searchData.customers[0].tags || ''
    }

    // Merger les tags
    const newTags = mergeTags(existingTags, tags, removePrefixes)

    // PUT les tags mis à jour
    const putResp = await shopifyFetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: { id: customerId, tags: newTags },
      }),
    })

    if (!putResp.ok) {
      const err = await putResp.text()
      return json({ success: false, reason: 'update_failed', details: err })
    }

    return json({ success: true, customerId, tags: newTags })

  } catch (error) {
    return json({ error: `${error}` }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/shopify-sync-tags',
}
