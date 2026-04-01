// Netlify Function : batch update des tags Shopify via GraphQL
// 25 clients par requête au lieu de 1 — ~10x plus rapide que REST

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

interface BatchItem {
  customerId: number
  email: string
  tags: string  // tags finaux déjà mergés, séparés par ", "
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

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let items: BatchItem[]
  try {
    const body = await request.json()
    items = body.items || []
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (items.length === 0) {
    return json({ results: [], processed: 0 })
  }

  // Max 25 par appel (coût GraphQL : 25 × 10 = 250 points, bucket = 1000)
  if (items.length > 25) {
    items = items.slice(0, 25)
  }

  // Récupérer le token Shopify (1 seule fois)
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

  // Construire une mutation GraphQL avec aliases : 25 updates en 1 requête
  const mutations = items.map((item, i) => {
    const tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean)
    const tagsGraphQL = tagsArray.map(t => `"${t}"`).join(', ')
    return `c${i}: customerUpdate(input: {id: "gid://shopify/Customer/${item.customerId}", tags: [${tagsGraphQL}]}) {
      customer { id }
      userErrors { field message }
    }`
  })

  const query = `mutation { ${mutations.join('\n')} }`

  // Exécuter avec retry sur throttle
  let attempt = 0
  let responseData: Record<string, unknown> | null = null

  while (attempt < 3) {
    const resp = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    if (!resp.ok) {
      if (resp.status === 429) {
        const retryAfter = parseFloat(resp.headers.get('Retry-After') || '2')
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        attempt++
        continue
      }
      const err = await resp.text()
      return json({ error: `GraphQL request failed: ${resp.status} ${err.slice(0, 200)}` }, 500)
    }

    const body = await resp.json()

    // Check for throttled error in GraphQL response
    if (body.errors?.some((e: { extensions?: { code?: string } }) => e.extensions?.code === 'THROTTLED')) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempt++
      continue
    }

    responseData = body.data
    break
  }

  if (!responseData) {
    return json({ error: 'Throttled after 3 retries' }, 429)
  }

  // Parser les résultats
  const results = items.map((item, i) => {
    const result = responseData![`c${i}`] as { customer?: { id: string }; userErrors?: Array<{ message: string }> } | undefined
    if (!result) {
      return { email: item.email, success: false, reason: 'Pas de réponse' }
    }
    if (result.userErrors && result.userErrors.length > 0) {
      return { email: item.email, success: false, reason: result.userErrors.map(e => e.message).join(', ') }
    }
    return { email: item.email, success: true }
  })

  return json({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  })
}

export const config = {
  path: '/.netlify/functions/shopify-batch-tags',
}
