// Source : `pnpm build` l'empaquette en un seul fichier dans netlify/functions (build:fonctions, voir le README).
// « M'envoyer un essai » dans l'écran Écrire du Hub : la Missive enregistrée part tout de suite, à l'adresse
// de l'admin connecté seulement, objet préfixé « [Essai] ». Rien n'est noté dans missive_envois.

import { exigerAdmin } from '../functions/lib/admin'
import { message, type Missive } from '../functions/lib/missive'
import { envoyerLot } from '../functions/lib/resend'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function lire<T>(chemin: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  })
  return (await r.json()) as T[]
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

  const auth = await exigerAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  const corps = (await request.json().catch(() => ({}))) as { id?: unknown }
  if (typeof corps.id !== 'number') return json({ error: 'Quelle Missive ?' }, 400)
  const cle = process.env.RESEND_API_KEY
  if (!cle) return json({ error: 'RESEND_API_KEY manquante dans Netlify' }, 500)

  try {
    const [moi] = await lire<{ email_address: string; first_name: string | null }>(
      `users?select=email_address,first_name&id=eq.${encodeURIComponent(auth.userId)}`,
    )
    const [missive] = await lire<Missive>(`missives?id=eq.${String(corps.id)}&select=id,modele,contenu,couleurs,apercu,objet`)
    if (!moi || !missive) return json({ error: 'Missive ou compte introuvable' }, 404)

    const essai = await message(
      missive,
      { user_id: auth.userId, email: moi.email_address, prenom: moi.first_name },
      `[Essai] ${missive.objet}`,
    )
    const [resultat] = await envoyerLot([{ message: essai, cle: `essai-${String(missive.id)}-${String(Date.now())}` }], cle)
    // Le texte de Resend peut citer l'adresse : il ne quitte pas la fonction.
    if (!resultat || 'erreur' in resultat) return json({ error: 'Resend a refusé l’essai : le domaine est-il vérifié ?' }, 502)
    return json({ ok: true })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/missives-essai',
}
