// Le désabonnement des Missives, sans compte : le jeton signé du lien suffit (lib/jeton.ts).
// Deux appelants : la page /desabonnement du Hub (POST { j }), et la boîte de réception en un clic
// (RFC 8058 : POST « List-Unsubscribe=One-Click » à l'adresse de l'en-tête, jeton dans ?j=).
// L'accord est retiré sur la fiche, puis chez Shopify, pour que la boutique cesse aussi ses envois.
// Rejouer un désabonnement ne fait pas d'erreur.

import { colonnesAccord } from './lib/accord'
import { verifier } from './lib/jeton'
import { desabonnerChezShopify } from './lib/shopify'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function supabase(chemin: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  })
}

async function jetonRecu(request: Request): Promise<string> {
  const dansLAdresse = new URL(request.url).searchParams.get('j')
  if (dansLAdresse) return dansLAdresse
  const corps = (await request.json().catch(() => ({}))) as { j?: unknown }
  return typeof corps.j === 'string' ? corps.j : ''
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = verifier(await jetonRecu(request))
  if (!userId) return json({ error: 'Lien invalide' }, 400)

  try {
    const le = new Date().toISOString()
    const r = await supabase(`users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(colonnesAccord({ accord: false, le, porte: 'desabonnement' })),
    })
    if (!r.ok) {
      console.error('missives-desabonnement : la fiche a refusé, HTTP', r.status)
      return json({ error: 'Le désabonnement n’a pas pu s’écrire, réessaie dans un instant.' }, 500)
    }
    await desabonnerChezShopify(userId, le)
    return json({ ok: true })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/missives-desabonnement',
}
