// Netlify Function : créer un client Shopify quand un joueur s'inscrit sur l'app
// Appelé depuis explore-web après l'inscription

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
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

  let email: string, firstName: string | null, factionTitle: string | null

  try {
    const body = await request.json()
    email = body.email
    firstName = body.firstName || null
    factionTitle = body.factionTitle || null
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!email) return json({ error: 'Missing email' }, 400)

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
    // Vérifier si le client existe déjà sur Shopify
    const searchResp = await fetch(`https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email`, {
      headers: { 'X-Shopify-Access-Token': shopifyToken },
    })

    if (searchResp.ok) {
      const searchData = await searchResp.json()
      if (searchData.customers && searchData.customers.length > 0) {
        // Le client existe déjà — mettre à jour ses tags
        const customerId = searchData.customers[0].id
        const existingTags = searchData.customers[0].tags || ''
        const newTags = addTags(existingTags, ['app-player', factionTitle ? `heritage-${slugify(factionTitle)}` : null].filter(Boolean) as string[])

        await fetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: { id: customerId, tags: newTags },
          }),
        })

        // Mettre à jour shopify_customer_id dans Supabase
        await fetch(`${SUPABASE_URL}/rest/v1/users?email_address=eq.${encodeURIComponent(email.toLowerCase())}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shopify_customer_id: customerId, account_source: 'both' }),
        })

        return json({ success: true, action: 'updated', customerId })
      }
    }

    // Le client n'existe pas — le créer
    const createResp = await fetch(`https://${shop}/admin/api/2026-01/customers.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: {
          email,
          first_name: firstName || '',
          tags: ['app-player', factionTitle ? `heritage-${slugify(factionTitle)}` : null].filter(Boolean).join(', '),
          email_marketing_consent: {
            state: 'subscribed',
            consent_updated_at: new Date().toISOString(),
          },
        },
      }),
    })

    if (!createResp.ok) {
      const err = await createResp.text()
      return json({ error: `Shopify create failed: ${err}` }, 500)
    }

    const createData = await createResp.json()
    const newCustomerId = createData.customer?.id

    // Mettre à jour Supabase
    if (newCustomerId) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?email_address=eq.${encodeURIComponent(email.toLowerCase())}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopify_customer_id: newCustomerId, account_source: 'both' }),
      })
    }

    return json({ success: true, action: 'created', customerId: newCustomerId })

  } catch (error) {
    return json({ error: `${error}` }, 500)
  }
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function addTags(existing: string, newTags: string[]): string {
  const tags = new Set(existing.split(',').map(t => t.trim()).filter(Boolean))
  for (const t of newTags) tags.add(t)
  return Array.from(tags).join(', ')
}

export const config = {
  path: '/.netlify/functions/shopify-create-customer',
}
