// Réveillée par pg_cron toutes les 5 minutes (_reveiller_missives, mig 541) quand une Missive est à envoyer.
// Un réveil prépare les Missives arrivées à échéance, prend un lot de destinataires, rend chaque e-mail et
// l'envoie par Resend, puis note chaque résultat. La base garantit qu'un destinataire n'est pris qu'une fois,
// même si deux réveils se croisent ; ce qui reste part au réveil suivant.
// Garde : l'en-tête X-Missives-Secret, partagé avec app_settings.missives_secret.

import { message, type Missive } from './lib/missive'
import { envoyerLot, TAILLE_DU_LOT_RESEND } from './lib/resend'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Ce qu'un réveil rend et envoie dans le délai de la fonction (60 s, netlify.toml).
const TAILLE_DU_LOT = 250

type Destinataire = { missive_id: number; user_id: string; email: string; prenom: string | null }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Un appel à la base qui échoue s'arrête là : le réveil répond 500 au lieu de croire qu'il a fini. */
async function supabase(chemin: string, corps?: unknown): Promise<Response> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    method: corps === undefined ? 'GET' : 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  if (!r.ok) throw new Error(`base : ${chemin.split('?')[0] ?? ''} HTTP ${String(r.status)}`)
  return r
}

export default async function handler(request: Request) {
  const secret = process.env.MISSIVES_SECRET
  if (!secret || request.headers.get('X-Missives-Secret') !== secret) return json({ error: 'Unauthorized' }, 401)
  const cle = process.env.RESEND_API_KEY
  if (!cle) return json({ error: 'RESEND_API_KEY not configured' }, 500)

  try {
    await supabase('rpc/missives_preparer', {})
    const lot = (await (await supabase('rpc/missives_prendre_lot', { p_taille: TAILLE_DU_LOT })).json()) as Destinataire[]

    if (lot.length > 0) {
      const ids = [...new Set(lot.map((d) => d.missive_id))]
      const missives = (await (await supabase(
        `missives?id=in.(${ids.join(',')})&select=id,modele,contenu,couleurs,apercu,objet`,
      )).json()) as Missive[]
      const parId = new Map(missives.map((m) => [m.id, m]))

      // Lot par lot, et chaque résultat noté aussitôt : une panne au lot suivant n'efface pas celui-ci.
      for (let i = 0; i < lot.length; i += TAILLE_DU_LOT_RESEND) {
        const tranche = lot.slice(i, i + TAILLE_DU_LOT_RESEND)
        const aEnvoyer = await Promise.all(
          tranche.map(async (d) => ({ message: await message(parId.get(d.missive_id)!, d), cle: `${String(d.missive_id)}-${d.user_id}` })),
        )
        const resultats = await envoyerLot(aEnvoyer, cle)
        await supabase('rpc/missives_noter', {
          p_resultats: tranche.map((d, j) => {
            const r = resultats[j] ?? { erreur: 'sans réponse de Resend' }
            return 'id' in r
              ? { missive_id: d.missive_id, user_id: d.user_id, resend_id: r.id }
              : { missive_id: d.missive_id, user_id: d.user_id, erreur: r.erreur }
          }),
        })
      }
    }

    await supabase('rpc/missives_terminer', {})
    return json({ envoyes: lot.length })
  } catch (erreur) {
    console.error('missives-envoyer :', erreur instanceof Error ? erreur.message : 'erreur inconnue')
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/missives-envoyer',
}
