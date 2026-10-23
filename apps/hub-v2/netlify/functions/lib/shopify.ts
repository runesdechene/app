// Ce que les webhooks Shopify partagent : la vérification de la signature.

import crypto from 'crypto'

/** La signature HMAC que Shopify pose sur chaque webhook, comparée en temps constant. */
export function signatureShopifyValide(corps: string, signature: string, secret: string): boolean {
  const attendu = Buffer.from(crypto.createHmac('sha256', secret).update(corps).digest('base64'))
  const recu = Buffer.from(signature)
  // Des longueurs différentes sont déjà un refus (timingSafeEqual les rejette).
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu)
}
