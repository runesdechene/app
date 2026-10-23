// Webhook de Resend : ce qu'il advient de chaque Missive envoyée (missive_envois, retrouvé par resend_id).
// Ouverture et clic : la première date. Rebond : l'adresse ne reçoit plus rien (accord retiré, porte
// « rebond »). Plainte (marquée comme indésirable) : l'accord est retiré aussi.
// Signature Svix obligatoire : HMAC-SHA256 de « id.horodatage.corps », clé = RESEND_WEBHOOK_SECRET décodé.

import crypto from 'crypto'
import { colonnesAccord, type Porte } from './lib/accord'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
// Au-delà, une requête signée est une requête rejouée.
const TOLERANCE_S = 5 * 60

type Evenement = { type: string; created_at: string; data: { email_id: string } }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function supabase(chemin: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  })
}

function signatureValide(request: Request, corps: string, secret: string): boolean {
  const id = request.headers.get('svix-id')
  const horodatage = request.headers.get('svix-timestamp')
  const signatures = request.headers.get('svix-signature')
  if (!id || !horodatage || !signatures) return false
  if (Math.abs(Date.now() / 1000 - Number(horodatage)) > TOLERANCE_S) return false
  const cle = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const attendu = Buffer.from(crypto.createHmac('sha256', cle).update(`${id}.${horodatage}.${corps}`).digest('base64'))
  // L'en-tête peut porter plusieurs signatures (« v1,… v1,… ») pendant un changement de secret.
  return signatures.split(' ').some((s) => {
    const recu = Buffer.from(s.replace(/^v1,/, ''))
    return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu)
  })
}

async function retirerAccord(envoi: string, statut: 'rebond' | 'plainte', porte: Porte, le: string) {
  const lignes = (await (await supabase(envoi, { method: 'PATCH', body: JSON.stringify({ statut }) })).json()) as { user_id: string }[]
  const userId = lignes[0]?.user_id
  if (!userId) return
  await supabase(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(colonnesAccord({ accord: false, le, porte })),
  })
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return json({ error: 'Webhook secret not configured' }, 500)
  const corps = await request.text()
  if (!signatureValide(request, corps, secret)) return json({ error: 'Invalid signature' }, 401)

  let evenement: Evenement
  try {
    evenement = JSON.parse(corps)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const envoi = `missive_envois?resend_id=eq.${encodeURIComponent(evenement.data.email_id)}`
  const le = evenement.created_at

  try {
    switch (evenement.type) {
      case 'email.opened':
        await supabase(`${envoi}&ouvert_le=is.null`, { method: 'PATCH', body: JSON.stringify({ ouvert_le: le }) })
        break
      case 'email.clicked':
        await supabase(`${envoi}&clique_le=is.null`, { method: 'PATCH', body: JSON.stringify({ clique_le: le }) })
        break
      case 'email.bounced':
        await retirerAccord(envoi, 'rebond', 'rebond', le)
        break
      case 'email.complained':
        await retirerAccord(envoi, 'plainte', 'desabonnement', le)
        break
    }
    return json({ ok: true })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/resend-webhook',
}
