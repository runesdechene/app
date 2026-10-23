// Ce que les fonctions partagent avec Shopify : la signature des webhooks, et le désabonnement côté boutique.

import crypto from 'crypto'

/** La signature HMAC que Shopify pose sur chaque webhook, comparée en temps constant. */
export function signatureShopifyValide(corps: string, signature: string, secret: string): boolean {
  const attendu = Buffer.from(crypto.createHmac('sha256', secret).update(corps).digest('base64'))
  const recu = Buffer.from(signature)
  // Des longueurs différentes sont déjà un refus (timingSafeEqual les rejette).
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu)
}

const BOUTIQUE = 'runes-de-chene.myshopify.com'

/** Le client Shopify relié à cette fiche cesse de recevoir le marketing de la boutique. Sans lien : rien. */
export async function desabonnerChezShopify(userId: string, le: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const jeton = process.env.SHOPIFY_ACCESS_TOKEN
  const r = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=shopify_customer_id`, {
    headers: { 'apikey': cle, 'Authorization': `Bearer ${cle}` },
  })
  const client = ((await r.json()) as { shopify_customer_id: number | null }[])[0]?.shopify_customer_id
  if (!client || !jeton) return
  const maj = await fetch(`https://${BOUTIQUE}/admin/api/2026-01/customers/${String(client)}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': jeton, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { id: client, email_marketing_consent: { state: 'unsubscribed', opt_in_level: 'single_opt_in', consent_updated_at: le } },
    }),
  })
  if (!maj.ok) console.error('desabonnerChezShopify : Shopify a refusé, HTTP', maj.status)
}
