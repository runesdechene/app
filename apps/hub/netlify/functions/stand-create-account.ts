// Crée un compte client en festival/stand depuis la page AssignFragments du Hub.
// Flow : Shopify d'abord (pour avoir customer_id avant l'insert Supabase),
// puis user Supabase fantôme (id = "shopify-{customer.id}", account_source = 'stand').
// Si Shopify échoue, rien n'est inséré → retry propre.
// L'email de bienvenue Shopify part automatiquement via le flow newsletter (email_marketing_consent: subscribed).

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

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function buildTags(existing: string, factionTitle: string | null): string {
  const tags = existing.split(',').map(t => t.trim()).filter(Boolean)
  const filtered = tags.filter(t => !t.startsWith('heritage-') && !t.startsWith('source:'))
  const tagSet = new Set(filtered)
  tagSet.add('app-player')
  tagSet.add('source:stand')
  if (factionTitle) tagSet.add(`heritage-${slugify(factionTitle)}`)
  return Array.from(tagSet).join(', ')
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Missing Supabase env vars' }, 500)

  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  let email: string, firstName: string | null, factionTitle: string | null
  try {
    const body = await request.json()
    email = String(body.email || '').trim().toLowerCase()
    firstName = body.firstName ? String(body.firstName).trim() : null
    factionTitle = body.factionTitle || null
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!email || !email.includes('@')) return json({ error: 'Invalid email' }, 400)

  // 1. Idempotence : si l'email existe déjà côté Supabase, on retourne le user existant.
  const existingResp = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email_address=eq.${encodeURIComponent(email)}&select=id,first_name,email_address,avatar_url,shopify_customer_id,account_source&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  const existingRows = await existingResp.json() as Array<{ id: string; first_name: string | null; email_address: string; avatar_url: string | null; shopify_customer_id: number | null; account_source: string | null }>
  if (existingRows.length > 0) {
    return json({ success: true, action: 'already_exists', user: existingRows[0] })
  }

  // 2. Token Shopify
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
    // 3. Recherche customer Shopify existant (achat antérieur sans inscription app).
    let customerId: number | null = null
    const searchResp = await fetch(
      `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email,tags,first_name`,
      { headers: { 'X-Shopify-Access-Token': shopifyToken } }
    )

    if (searchResp.ok) {
      const searchData = await searchResp.json() as { customers?: Array<{ id: number; email: string; tags: string; first_name: string | null }> }
      if (searchData.customers && searchData.customers.length > 0) {
        const existing = searchData.customers[0]
        customerId = existing.id
        const newTags = buildTags(existing.tags || '', factionTitle)

        // Update tags + opt-in newsletter + first_name si fourni et absent côté Shopify
        const updateBody: Record<string, unknown> = {
          customer: {
            id: customerId,
            tags: newTags,
            email_marketing_consent: {
              state: 'subscribed',
              opt_in_level: 'single_opt_in',
              consent_updated_at: new Date().toISOString(),
            },
            ...(firstName && !existing.first_name ? { first_name: firstName } : {}),
          },
        }
        await fetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json`, {
          method: 'PUT',
          headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        })
      }
    }

    // 4. Sinon, création du customer Shopify
    if (customerId === null) {
      const createResp = await fetch(`https://${shop}/admin/api/2026-01/customers.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email,
            ...(firstName ? { first_name: firstName } : {}),
            tags: buildTags('', factionTitle),
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
      first_name: firstName || 'Pionnier',
      shopify_customer_id: customerId,
      account_source: 'stand',
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
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(newUser),
    })

    if (!insertResp.ok) {
      const err = await insertResp.text()
      return json({ error: `Supabase insert failed: ${err.slice(0, 300)}`, customerId }, 500)
    }

    const inserted = await insertResp.json() as Array<typeof newUser & { avatar_url: string | null }>
    return json({ success: true, action: 'created', user: inserted[0] })

  } catch (error) {
    return json({ error: `${error}` }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/stand-create-account',
}
