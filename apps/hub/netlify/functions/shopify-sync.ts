// Netlify Function : synchro initiale Shopify → Supabase
// Utilise l'API REST Supabase directement (pas le SDK, pour éviter les problèmes de bundling)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function supabaseRest(path: string, method = 'GET', body?: unknown) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'GET') return resp.json()
  return resp
}

interface ShopifyCustomer {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  orders_count: number
  tags: string
  created_at: string
}

async function requireAdmin(request: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = request.headers.get('Authorization') || ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  if (!bearer) return { error: 'Missing Authorization header', status: 401 }

  // Valider le JWT avec Supabase Auth
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${bearer}`,
    },
  })
  if (!userResp.ok) return { error: 'Invalid session', status: 401 }
  const user = await userResp.json() as { id?: string }
  if (!user?.id) return { error: 'Invalid session', status: 401 }

  // Vérifier le rôle admin côté DB
  const roleResp = await fetch(`${SUPABASE_URL}/rest/v1/users?select=role&id=eq.${user.id}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!roleResp.ok) return { error: 'Failed to verify role', status: 500 }
  const rows = await roleResp.json() as Array<{ role?: string }>
  if (!rows[0] || rows[0].role !== 'admin') return { error: 'Forbidden — admin only', status: 403 }

  return { userId: user.id }
}

export default async function handler(request: Request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json({ error: 'Missing Supabase env vars' }, 500)
  }

  // GARDE SÉCURITÉ : session Supabase valide + role admin
  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  let token: string, shop: string
  try {
    const body = await request.json()
    token = body.token
    shop = body.shop
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!token || !shop) {
    return json({ error: 'Missing token or shop' }, 400)
  }

  try {
    // 1. Fetch tous les clients Shopify (paginé)
    const allCustomers: ShopifyCustomer[] = []
    let nextUrl: string | null = `https://${shop}/admin/api/2026-01/customers.json?limit=250&fields=id,email,first_name,last_name,orders_count,tags,created_at`

    while (nextUrl) {
      const resp = await fetch(nextUrl, {
        headers: { 'X-Shopify-Access-Token': token },
      })

      if (!resp.ok) {
        const err = await resp.text()
        return json({ error: `Shopify API error: ${resp.status} — ${err}` }, 500)
      }

      const data = await resp.json()
      if (data.customers) allCustomers.push(...data.customers)

      const linkHeader = resp.headers.get('link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = match ? match[1] : null
      } else {
        nextUrl = null
      }
    }

    // 2. Fetch tous les users Supabase (paginé par 1000)
    const existingUsers: Array<{
      id: string
      email_address: string
      shopify_customer_id: number | null
      account_source: string | null
    }> = []

    let offset = 0
    const PAGE_SIZE = 1000
    while (true) {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email_address,shopify_customer_id,account_source&limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      })
      const page = await resp.json()
      if (!Array.isArray(page) || page.length === 0) break
      existingUsers.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    const emailToUser = new Map<string, typeof existingUsers[0]>()
    for (const u of existingUsers) {
      if (u.email_address) emailToUser.set(u.email_address.toLowerCase(), u)
    }

    // 3. Croiser
    const toUpdate: Array<{ id: string; shopify_customer_id: number }> = []
    const toCreate: Array<Record<string, unknown>> = []
    let skipped = 0

    for (const customer of allCustomers) {
      if (!customer.email) { skipped++; continue }
      const email = customer.email.toLowerCase()
      const existing = emailToUser.get(email)

      if (existing) {
        if (!existing.shopify_customer_id) {
          toUpdate.push({ id: existing.id, shopify_customer_id: customer.id })
        } else {
          skipped++
        }
      } else {
        toCreate.push({
          id: `shopify-${customer.id}`,
          email_address: customer.email,
          first_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client Shopify',
          shopify_customer_id: customer.id,
          account_source: 'shopify',
          is_active: true,
          created_at: customer.created_at,
          role: 'user',
          rank: '',
          biography: '',
        })
      }
    }

    // 4. Batch update (lier les existants) — par lots de 50
    let updated = 0
    for (let i = 0; i < toUpdate.length; i += 50) {
      const batch = toUpdate.slice(i, i + 50)
      const promises = batch.map(u =>
        fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${u.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shopify_customer_id: u.shopify_customer_id }),
        })
      )
      await Promise.all(promises)
      updated += batch.length
    }

    // 5. Batch create (nouveaux profils Shopify) — par lots de 50
    let created = 0
    const createErrors: string[] = []
    for (let i = 0; i < toCreate.length; i += 50) {
      const batch = toCreate.slice(i, i + 50)
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(batch),
      })
      if (resp.ok) {
        created += batch.length
      } else {
        const errText = await resp.text()
        if (createErrors.length < 3) createErrors.push(`Batch ${i}: ${resp.status} — ${errText.slice(0, 200)}`)
      }
    }

    return json({
      success: true,
      shopifyTotal: allCustomers.length,
      supabaseTotal: existingUsers.length,
      matched: toUpdate.length + skipped,
      updated,
      created,
      skipped,
      toCreateCount: toCreate.length,
      toUpdateCount: toUpdate.length,
      logs: [
        `Shopify: ${allCustomers.length} clients récupérés`,
        `Supabase: ${existingUsers.length} users récupérés (${Math.ceil(existingUsers.length / PAGE_SIZE)} pages)`,
        `Croisement: ${toUpdate.length} à lier, ${toCreate.length} à créer, ${skipped} déjà à jour`,
        `Updates: ${updated} liés avec succès`,
        `Creates: ${created} profils créés`,
        toCreate.length > 0 && created === 0 ? `⚠️ Aucun profil créé sur ${toCreate.length} tentatives` : null,
        ...createErrors.map(e => `❌ ${e}`),
        existingUsers.length === 0 ? `⚠️ Aucun user Supabase récupéré — vérifier SUPABASE_SERVICE_ROLE_KEY` : null,
      ].filter(Boolean),
    })

  } catch (error) {
    return json({ error: `Sync error: ${error}` }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/shopify-sync',
}
