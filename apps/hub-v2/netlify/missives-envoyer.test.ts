/**
 * QUOI     — la fonction qui envoie les Missives : sa garde, le jeton de désabonnement, les lots Resend.
 * ATTENTION — `fetch` est simulé. Ce qui tient quand deux réveils se croisent vit dans la base
 *             (missives_prendre_lot, mig 541) : ici, la base simulée ne rend chaque personne qu'une fois.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signer, verifier } from './functions/lib/jeton'

type Fonction = (request: Request) => Promise<Response>
type Destinataire = { missive_id: number; user_id: string; email: string; prenom: string | null }

const SECRET = 'secret-des-missives'

const MISSIVE = {
  id: 7,
  modele: 'missive',
  objet: 'L’hiver se prépare à l’atelier',
  apercu: 'Ce qui se prépare à l’atelier',
  couleurs: { fond: '#1f2827', titres: '#d6bd8c', rupture: '#2a4845' },
  contenu: null as unknown,
}

async function charger(): Promise<Fonction> {
  vi.resetModules()
  const { EXEMPLES } = await import('@runes/missives')
  MISSIVE.contenu = EXEMPLES.missive
  return ((await import('./functions/missives-envoyer.ts')) as { default: Fonction }).default
}

function reveil(secret: string | null = SECRET) {
  return new Request('http://localhost/fonction', { method: 'POST', headers: secret ? { 'X-Missives-Secret': secret } : {} })
}

/**
 * La base et Resend simulés. `lot` : ce que missives_prendre_lot rend, une seule fois (comme SKIP LOCKED).
 * `refus` : les adresses que Resend refuse.
 */
function simuler(lot: Destinataire[], refus: string[] = []) {
  let restant = [...lot]
  const envoyes: { to: string[]; headers: Record<string, string>; html: string }[] = []
  const notes: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const corps = init?.body ? JSON.parse(String(init.body)) : null
    if (url.endsWith('/rpc/missives_prendre_lot')) {
      const pris = restant.slice(0, corps.p_taille)
      restant = restant.slice(pris.length)
      return Response.json(pris)
    }
    if (url.endsWith('/rpc/missives_noter')) {
      notes.push(...corps.p_resultats)
      return new Response(null, { status: 204 })
    }
    if (url.includes('/rest/v1/missives?')) return Response.json([MISSIVE])
    if (url === 'https://api.resend.com/emails/batch') {
      const messages = corps as (typeof envoyes)[number][]
      if (messages.some((m) => refus.includes(m.to[0] ?? ''))) {
        return Response.json({ statusCode: 422, message: 'Invalid `to` field.' }, { status: 422 })
      }
      envoyes.push(...messages)
      return Response.json({ data: messages.map((_, i) => ({ id: `re_${String(envoyes.length - messages.length + i)}` })) })
    }
    if (url === 'https://api.resend.com/emails') {
      if (refus.includes(corps.to[0])) return Response.json({ statusCode: 422, message: 'Invalid `to` field.' }, { status: 422 })
      envoyes.push(corps)
      return Response.json({ id: `re_seul_${String(envoyes.length)}` })
    }
    return new Response(null, { status: 204 })
  }))
  return { envoyes, notes }
}

function personnes(n: number): Destinataire[] {
  return Array.from({ length: n }, (_, i) => ({ missive_id: 7, user_id: `u${String(i)}`, email: `p${String(i)}@exemple.fr`, prenom: null }))
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('RESEND_API_KEY', 're_cle')
  vi.stubEnv('MISSIVES_SECRET', SECRET)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('le jeton de désabonnement', () => {
  test('un jeton signé se vérifie et rend la personne', () => {
    vi.stubEnv('MISSIVES_SECRET', SECRET)
    expect(verifier(signer('shopify-42'))).toBe('shopify-42')
  })

  test('un jeton retouché, ou signé avec un autre secret, est refusé', () => {
    vi.stubEnv('MISSIVES_SECRET', SECRET)
    const jeton = signer('u1')
    expect(verifier(jeton.replace('u1', 'u2'))).toBeNull()
    expect(verifier('u1')).toBeNull()
    vi.stubEnv('MISSIVES_SECRET', 'autre')
    expect(verifier(jeton)).toBeNull()
  })
})

describe('missives-envoyer', () => {
  test('sans en-tête, ou avec un faux secret : 401, ni base ni Resend', async () => {
    simuler(personnes(2))
    const handler = await charger()
    expect((await handler(reveil(null))).status).toBe(401)
    expect((await handler(reveil('faux'))).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('deux réveils qui se croisent : chacun reçoit la Missive une seule fois', async () => {
    const { envoyes } = simuler(personnes(3))
    const handler = await charger()
    await Promise.all([handler(reveil()), handler(reveil())])
    expect(envoyes.map((m) => m.to[0]).sort()).toEqual(['p0@exemple.fr', 'p1@exemple.fr', 'p2@exemple.fr'])
  })

  test('un lot refusé repart message par message : 3 envoyés, 2 en échec avec leur raison', async () => {
    const lot = personnes(5)
    const { envoyes, notes } = simuler(lot, ['p1@exemple.fr', 'p3@exemple.fr'])
    const handler = await charger()
    const r = await handler(reveil())
    expect(r.status).toBe(200)
    expect(envoyes).toHaveLength(3)
    expect(notes).toHaveLength(5)
    expect(notes.filter((n) => (n as { resend_id?: string }).resend_id)).toHaveLength(3)
    expect(notes).toContainEqual({ missive_id: 7, user_id: 'u1', erreur: 'Invalid `to` field.' })
  })

  test('chaque e-mail porte le désabonnement en un clic et le prénom manquant devient « Explorateur »', async () => {
    const { envoyes } = simuler(personnes(1))
    const handler = await charger()
    await handler(reveil())
    const message = envoyes[0]
    expect(message?.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(message?.headers['List-Unsubscribe']).toMatch(/^<https:\/\/hub\.runesdechene\.com\/\.netlify\/functions\/missives-desabonnement\?j=u0\.[\w-]+>, <mailto:/)
    expect(message?.html).toContain('desabonnement?j=u0.')
    expect(message?.html).toContain('alut Explorateur')
  })
})
