// Webhook Shopify customers/create et customers/update : l'accord aux nouvelles suit le client.
// Une inscription à la newsletter du site crée un client Shopify ; s'il est inconnu du Hub, sa fiche naît
// ici. Ensuite, le choix le plus récent gagne entre Shopify et le Hub (lib/accord.ts).
// Signature HMAC obligatoire, comme shopify-order-webhook.

import { appliquerAccord, colonnesAccord, type Porte } from './lib/accord'
import { signatureShopifyValide } from './lib/shopify'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET!

type Client = {
  id: number
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  email_marketing_consent?: { state?: string; consent_updated_at?: string | null } | null
}

type Fiche = { id: string; accord_nouvelles: boolean; accord_nouvelles_le: string | null }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function supabase(chemin: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  })
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SHOPIFY_SECRET) return json({ error: 'Webhook secret not configured' }, 500)

  const corps = await request.text()
  const signature = request.headers.get('x-shopify-hmac-sha256')
  if (!signature) return json({ error: 'Missing HMAC signature' }, 401)
  if (!signatureShopifyValide(corps, signature, SHOPIFY_SECRET)) return json({ error: 'Invalid HMAC signature' }, 401)

  let client: Client
  try {
    client = JSON.parse(corps)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const email = client.email?.trim().toLowerCase()
  if (!email) return json({ ok: true, ignore: 'sans e-mail' }) // 200 : Shopify ne relance pas

  const consentement = client.email_marketing_consent
  const recu = {
    accord: consentement?.state === 'subscribed',
    le: consentement?.consent_updated_at ?? null,
    // Une création vient du formulaire de la newsletter du site ; une mise à jour, de la boutique.
    porte: (request.headers.get('x-shopify-topic') === 'customers/create' ? 'site' : 'shopify') as Porte,
  }

  try {
    const fiches = await (await supabase(
      `users?email_address=eq.${encodeURIComponent(email)}&select=id,accord_nouvelles,accord_nouvelles_le&limit=1`,
    )).json() as Fiche[]
    const fiche = fiches[0]

    if (!fiche) {
      const choix = appliquerAccord({ accord: false, le: null }, recu)
      // Le stand et le flyer créent la même fiche au même instant : la première arrivée garde la place.
      const r = await supabase('users?on_conflict=id', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          id: `shopify-${client.id}`,
          email_address: email,
          first_name: [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Client Shopify',
          shopify_customer_id: client.id,
          account_source: 'shopify',
          is_active: true,
          role: 'user',
          rank: '',
          biography: '',
          ...(choix ? colonnesAccord(choix) : {}),
        }),
      })
      if (!r.ok) console.error('shopify-client-webhook : fiche refusée, HTTP', r.status)
      return json({ ok: r.ok }, r.ok ? 200 : 500)
    }

    const choix = appliquerAccord({ accord: fiche.accord_nouvelles, le: fiche.accord_nouvelles_le }, recu)
    if (!choix) return json({ ok: true })
    const r = await supabase(`users?id=eq.${encodeURIComponent(fiche.id)}`, { method: 'PATCH', body: JSON.stringify(colonnesAccord(choix)) })
    if (!r.ok) console.error('shopify-client-webhook : accord refusé, HTTP', r.status)
    return json({ ok: r.ok }, r.ok ? 200 : 500)
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/shopify-client-webhook',
}
