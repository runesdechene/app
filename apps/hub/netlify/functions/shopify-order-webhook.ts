// Netlify Function : webhook Shopify orders/paid
// Reçoit une notification à chaque achat, crée/lie le profil et attribue les fragments

import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function supabaseGet(path: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  return resp.json()
}

async function supabasePost(path: string, body: unknown) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

async function supabasePatch(path: string, body: unknown) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const SHOP = 'runes-de-chene.myshopify.com'

async function getShopifyToken(): Promise<string | null> {
  const fromEnv = process.env.SHOPIFY_ACCESS_TOKEN
  if (fromEnv) return fromEnv
  // Fallback temporaire app_settings pendant la transition
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.shopify_access_token&select=value&limit=1`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  })
  const settings = await resp.json()
  return Array.isArray(settings) && settings.length > 0 ? settings[0].value : null
}

async function pushSourceTagToShopify(shopifyToken: string, customerId: number, sourceTag: string) {
  const resp = await fetch(`https://${SHOP}/admin/api/2026-01/customers/${customerId}.json?fields=id,tags`, {
    headers: { 'X-Shopify-Access-Token': shopifyToken },
  })
  if (!resp.ok) return

  const data = await resp.json()
  const existingTags = data.customer?.tags || ''
  const tags = existingTags.split(',').map((t: string) => t.trim()).filter(Boolean)

  // Ne pas écraser un tag source existant (le premier arrivé gagne)
  if (tags.some((t: string) => t.startsWith('source:'))) return

  tags.push(sourceTag)

  await fetch(`https://${SHOP}/admin/api/2026-01/customers/${customerId}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer: { id: customerId, tags: tags.join(', ') } }),
  })
}

async function fetchProductTags(shopifyToken: string, productIds: number[]): Promise<{ tags: string[]; debug: string }> {
  if (productIds.length === 0) return { tags: [], debug: 'no_product_ids' }

  // GraphQL pour récupérer les tags de tous les produits en 1 seule requête
  const nodes = productIds.map(id => `"gid://shopify/Product/${id}"`).join(', ')
  const query = `{
    nodes(ids: [${nodes}]) {
      ... on Product {
        id
        tags
      }
    }
  }`

  const resp = await fetch(`https://${SHOP}/admin/api/2026-01/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    console.error('[webhook] GraphQL error:', resp.status, text)
    return { tags: [], debug: `graphql_${resp.status}` }
  }

  const body = await resp.json()
  console.log('[webhook] GraphQL response:', JSON.stringify(body))
  const allTags: string[] = []

  if (body.data?.nodes) {
    for (const node of body.data.nodes) {
      if (node?.tags) {
        for (const tag of node.tags as string[]) {
          allTags.push(tag.trim().toLowerCase())
        }
      }
    }
  }

  if (allTags.length === 0 && body.errors) {
    return { tags: [], debug: `graphql_errors: ${JSON.stringify(body.errors).slice(0, 100)}` }
  }

  return { tags: allTags, debug: allTags.length > 0 ? 'ok' : 'empty_nodes' }
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const rawBody = await request.text()

  // Vérifier la signature HMAC Shopify
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256')
  if (hmacHeader && SHOPIFY_SECRET) {
    const hash = crypto.createHmac('sha256', SHOPIFY_SECRET).update(rawBody).digest('base64')
    if (hash !== hmacHeader) {
      return json({ error: 'Invalid HMAC signature' }, 401)
    }
  }

  let order: {
    id?: number
    name?: string
    order_number?: number
    email: string
    customer?: { id: number; email: string; first_name?: string; last_name?: string; tags?: string }
    line_items?: Array<{ product_id: number; title: string; tags?: string }>
  }

  try {
    order = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = order.email || order.customer?.email
  if (!email) {
    return json({ error: 'No email in order' }, 200) // 200 pour que Shopify ne retry pas
  }

  const customerId = order.customer?.id
  const firstName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || null

  try {
    // 1. Chercher le user par email
    const users = await supabaseGet(`users?email_address=eq.${encodeURIComponent(email.toLowerCase())}&select=id,shopify_customer_id,account_source&limit=1`)
    const existingUser = Array.isArray(users) && users.length > 0 ? users[0] : null

    let userId: string

    if (existingUser) {
      userId = existingUser.id

      // Mettre à jour le lien Shopify si nécessaire
      if (!existingUser.shopify_customer_id && customerId) {
        await supabasePatch(`users?id=eq.${existingUser.id}`, {
          shopify_customer_id: customerId,
        })
      }
    } else {
      // Créer un profil shopify-only
      userId = `shopify-${customerId || Date.now()}`
      await supabasePost('users', {
        id: userId,
        email_address: email.toLowerCase(),
        first_name: firstName,
        shopify_customer_id: customerId,
        account_source: 'shopify',
        is_active: true,
        role: 'user',
        rank: '',
        biography: '',
      })
    }

    // 2. Récupérer le token Shopify (1 seule fois pour tout le webhook)
    const shopifyToken = await getShopifyToken()

    // 3. Pousser le tag source:shopify sur le client Shopify (si nouveau client sans compte app)
    if (!existingUser && customerId && shopifyToken) {
      await pushSourceTagToShopify(shopifyToken, customerId, 'source:shopify')
    }

    // 4. Récupérer les tags produit via l'API Shopify GraphQL
    const productIds = (order.line_items || [])
      .map(item => item.product_id)
      .filter((id): id is number => !!id)
    // Dédupliquer (un même produit peut être commandé en plusieurs variantes)
    const uniqueProductIds = [...new Set(productIds)]

    console.log('[webhook] shopifyToken:', shopifyToken ? 'present' : 'MISSING')
    console.log('[webhook] productIds:', uniqueProductIds)
    console.log('[webhook] line_items:', JSON.stringify(order.line_items))

    let productTags: string[] = []
    let tagDebug = 'no_token'
    if (shopifyToken) {
      const result = await fetchProductTags(shopifyToken, uniqueProductIds)
      productTags = result.tags
      tagDebug = result.debug
    }

    console.log('[webhook] productTags:', productTags, 'debug:', tagDebug)

    const orderId = String(order.id || order.name || '')

    // 5. Pour chaque tag, chercher dans shopify_unlocks et débloquer les fragments
    let fragmentsUnlocked = 0
    let fragmentsSkipped = 0
    if (productTags.length > 0) {
      const unlocks = await supabaseGet(`shopify_unlocks?shopify_tag=in.(${productTags.map(t => `"${t}"`).join(',')})&select=shopify_tag,unlock_ref_id`)

      if (Array.isArray(unlocks)) {
        for (const unlock of unlocks) {
          // Vérifier si le fragment n'est pas déjà attribué
          const existing = await supabaseGet(`user_fragments?user_id=eq.${userId}&fragment_id=eq.${unlock.unlock_ref_id}&select=fragment_id&limit=1`)
          const alreadyOwned = Array.isArray(existing) && existing.length > 0

          if (!alreadyOwned) {
            await supabasePost('user_fragments', {
              user_id: userId,
              fragment_id: unlock.unlock_ref_id,
              source: 'shopify',
            })
            fragmentsUnlocked++
          } else {
            fragmentsSkipped++
          }

          // Log par fragment (unlocked ou skipped)
          await supabasePost('purchase_log', {
            email: email.toLowerCase(),
            shopify_order_id: orderId,
            shopify_tag: unlock.shopify_tag,
            unlock_type: 'fragment',
            unlock_ref_id: unlock.unlock_ref_id,
            user_id: existingUser ? existingUser.id : userId,
            status: alreadyOwned ? 'skipped' : (existingUser ? 'unlocked' : 'pending'),
          })
        }
      }
    }

    // 6. Si aucun fragment matché, logger quand même pour traçabilité
    if (fragmentsUnlocked === 0 && fragmentsSkipped === 0) {
      // Stocker les infos de debug dans shopify_tag pour diagnostic
      const debugInfo = productTags.length === 0
        ? `debug:${tagDebug}|pids:${uniqueProductIds.join(',') || 'none'}`
        : `tags_found:${productTags.join(',')}|no_unlock_match`

      await supabasePost('purchase_log', {
        email: email.toLowerCase(),
        shopify_order_id: orderId,
        shopify_tag: debugInfo.slice(0, 100),
        user_id: existingUser ? existingUser.id : userId,
        status: productTags.length === 0 ? 'no_tags' : 'no_match',
      })
    }

    return json({
      success: true,
      email,
      userId,
      orderId,
      productTags,
      tagDebug,
      productIds: uniqueProductIds,
      fragmentsUnlocked,
      fragmentsSkipped,
      isNewUser: !existingUser,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return json({ error: `Webhook error: ${error}` }, 200) // 200 pour que Shopify ne retry pas
  }
}

export const config = {
  path: '/.netlify/functions/shopify-order-webhook',
}
