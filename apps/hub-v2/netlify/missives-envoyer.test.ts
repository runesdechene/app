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
  return ((await import('./missives/missives-envoyer.ts')) as { default: Fonction }).default
}

function reveil(secret: string | null = SECRET) {
  return new Request('http://localhost/fonction', { method: 'POST', headers: secret ? { 'X-Missives-Secret': secret } : {} })
}

/**
 * La base et Resend simulés. `lot` : ce que missives_prendre_lot rend, une seule fois (comme SKIP LOCKED).
 * `refus` : les adresses que Resend refuse.
 */
function simuler(
  lot: Destinataire[],
  refus: string[] = [],
  panne: { lot?: Response | 'reseau'; aPartirDuLot?: number; noter?: number } = {},
) {
  let restant = [...lot]
  let lots = 0
  const envoyes: { to: string[]; headers: Record<string, string>; html: string }[] = []
  const notes: unknown[] = []
  const cles: (string | null)[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('https://api.resend.com')) cles.push(new Headers(init?.headers).get('Idempotency-Key'))
    const corps = init?.body ? JSON.parse(String(init.body)) : null
    if (url.endsWith('/rpc/missives_prendre_lot')) {
      const pris = restant.slice(0, corps.p_taille)
      restant = restant.slice(pris.length)
      return Response.json(pris)
    }
    if (url.endsWith('/rpc/missives_noter')) {
      if (panne.noter) return new Response('{}', { status: panne.noter })
      notes.push(...corps.p_resultats)
      return new Response(null, { status: 204 })
    }
    if (url.includes('/rest/v1/missives?')) return Response.json([MISSIVE])
    if (url === 'https://api.resend.com/emails/batch') {
      lots += 1
      if (panne.lot && lots >= (panne.aPartirDuLot ?? 1)) {
        if (panne.lot === 'reseau') throw new TypeError('fetch failed')
        return panne.lot.clone()
      }
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
  return { envoyes, notes, cles }
}

function personnes(n: number): Destinataire[] {
  return Array.from({ length: n }, (_, i) => ({ missive_id: 7, user_id: `u${String(i)}`, email: `p${String(i)}@exemple.fr`, prenom: null }))
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('RESEND_API_KEY', 're_cle')
  vi.stubEnv('MISSIVES_SECRET', SECRET)
  vi.stubEnv('MISSIVES_JETON_SECRET', 'cle-des-jetons')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('le jeton de désabonnement', () => {
  test('un jeton signé se vérifie et rend la personne', () => {
    expect(verifier(signer('shopify-42'))).toBe('shopify-42')
  })

  test('un jeton retouché, ou signé avec une autre clé, est refusé', () => {
    const jeton = signer('u1')
    expect(verifier(jeton.replace('u1', 'u2'))).toBeNull()
    expect(verifier('u1')).toBeNull()
    vi.stubEnv('MISSIVES_JETON_SECRET', 'autre')
    expect(verifier(jeton)).toBeNull()
  })

  test('sans clé de jeton, rien ne se signe : une clé vide se forgerait', () => {
    vi.stubEnv('MISSIVES_JETON_SECRET', '')
    expect(() => signer('u1')).toThrow()
    expect(() => verifier('u1.abc')).toThrow()
  })

  test('la clé des jetons n’est pas le secret du réveil', () => {
    const jeton = signer('u1')
    vi.stubEnv('MISSIVES_SECRET', 'autre-reveil')
    expect(verifier(jeton)).toBe('u1')
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

  test('un lot que Resend n’a pas pu prendre (500) n’est pas renvoyé un par un : noté en échec', async () => {
    const { envoyes, notes } = simuler(personnes(5), [], { lot: new Response('{}', { status: 500 }) })
    const handler = await charger()
    await handler(reveil())
    expect(envoyes).toHaveLength(0)
    expect(notes).toHaveLength(5)
    expect(notes.every((n) => typeof (n as { erreur?: string }).erreur === 'string')).toBe(true)
  })

  test('chaque appel à Resend porte une clé d’idempotence : un renvoi ne part pas deux fois', async () => {
    const { cles } = simuler(personnes(5), ['p1@exemple.fr'])
    const handler = await charger()
    await handler(reveil())
    expect(cles.length).toBeGreaterThan(1)
    expect(cles.every((c) => typeof c === 'string' && c.length > 0)).toBe(true)
    expect(new Set(cles).size).toBe(cles.length)
  })

  test('une panne au second lot n’efface pas le premier : ses résultats sont déjà notés', async () => {
    const { notes } = simuler(personnes(150), [], { lot: 'reseau', aPartirDuLot: 2 })
    const handler = await charger()
    const r = await handler(reveil())
    expect(r.status).toBe(500)
    expect(notes.filter((n) => (n as { resend_id?: string }).resend_id)).toHaveLength(100)
  })

  test('si la base refuse de noter, le réveil le dit (500)', async () => {
    simuler(personnes(2), [], { noter: 500 })
    const handler = await charger()
    expect((await handler(reveil())).status).toBe(500)
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
