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
        const newSource = existingUser.id.startsWith('shopify-') ? 'shopify' : 'both'
        await supabasePatch(`users?id=eq.${existingUser.id}`, {
          shopify_customer_id: customerId,
          account_source: newSource,
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

    // 2. Attribuer les fragments via les tags produits
    // Récupérer les tags de tous les produits de la commande
    const productTags: string[] = []
    if (order.line_items) {
      for (const item of order.line_items) {
        // Les tags sont parfois dans le line_item, parfois il faut les chercher via l'API
        // Pour l'instant on utilise le titre du produit comme fallback
        if (item.tags) {
          productTags.push(...item.tags.split(',').map(t => t.trim().toLowerCase()))
        }
      }
    }

    // Aussi checker les tags du customer
    if (order.customer?.tags) {
      // Les customer tags ne sont pas des product tags, on les ignore ici
    }

    // 3. Pour chaque tag, chercher dans shopify_unlocks
    let fragmentsUnlocked = 0
    if (productTags.length > 0) {
      const unlocks = await supabaseGet(`shopify_unlocks?shopify_tag=in.(${productTags.map(t => `"${t}"`).join(',')})&select=unlock_ref_id`)

      if (Array.isArray(unlocks)) {
        for (const unlock of unlocks) {
          // Vérifier si le fragment n'est pas déjà attribué
          const existing = await supabaseGet(`user_fragments?user_id=eq.${userId}&fragment_id=eq.${unlock.unlock_ref_id}&select=fragment_id&limit=1`)
          if (Array.isArray(existing) && existing.length === 0) {
            await supabasePost('user_fragments', {
              user_id: userId,
              fragment_id: unlock.unlock_ref_id,
              source: 'shopify',
            })
            fragmentsUnlocked++
          }
        }
      }
    }

    // 4. Aussi stocker dans purchase_log pour traçabilité
    await supabasePost('purchase_log', {
      email: email.toLowerCase(),
      shopify_order_id: String(order.customer?.id || ''),
      user_id: existingUser ? existingUser.id : userId,
      status: existingUser ? 'unlocked' : 'pending',
    })

    return json({
      success: true,
      email,
      userId,
      fragmentsUnlocked,
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
