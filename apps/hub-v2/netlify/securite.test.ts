/**
 * QUOI     — les garde-fous refermés dans les copies des fonctions Netlify (plan 4, R2).
 * POURQUOI — webhook sans signature, étiquettes réécrites par n'importe qui, secret envoyé à une
 *            boutique choisie par l'appelant : chaque trou a son test, `fetch` est simulé.
 */
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type Fonction = (request: Request) => Promise<Response>

const BOUTIQUE = 'runes-de-chene.myshopify.com'
const SECRET = 'secret-de-test'

// Un compte admin ou joueur pour la garde ; tout le reste (Shopify) échoue proprement.
function simulerReseau(role: 'admin' | 'player', sessionValide = true) {
  const appels: string[] = []
  const f = vi.fn((url: string) => {
    appels.push(url)
    if (url.includes('/auth/v1/user')) {
      return Promise.resolve(sessionValide ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 }))
    }
    if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role }]))
    return Promise.resolve(new Response('{}', { status: 500 }))
  })
  vi.stubGlobal('fetch', f)
  return appels
}

async function charger(nom: string): Promise<Fonction> {
  vi.resetModules()
  const module = (await import(`./functions/${nom}.ts`)) as { default: Fonction }
  return module.default
}

function signer(corps: string) {
  return crypto.createHmac('sha256', SECRET).update(corps).digest('base64')
}

function post(corps: string, entetes: Record<string, string> = {}) {
  return new Request('http://localhost/fonction', { method: 'POST', body: corps, headers: entetes })
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('SHOPIFY_ACCESS_TOKEN', 'jeton-shopify')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('shopify-order-webhook', () => {
  test('sans en-tête de signature : 401', async () => {
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', SECRET)
    const handler = await charger('shopify-order-webhook')
    const r = await handler(post('{"email":"a@b.fr"}'))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'Missing HMAC signature' })
  })

  test('sans secret configuré : 500', async () => {
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', '')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', '')
    const handler = await charger('shopify-order-webhook')
    const r = await handler(post('{}', { 'x-shopify-hmac-sha256': 'x' }))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'Webhook secret not configured' })
  })

  test('mauvaise signature, ou de longueur différente : 401', async () => {
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', SECRET)
    const handler = await charger('shopify-order-webhook')
    const corps = '{"email":"a@b.fr"}'
    const fausse = signer('autre corps')
    expect((await handler(post(corps, { 'x-shopify-hmac-sha256': fausse }))).status).toBe(401)
    expect((await handler(post(corps, { 'x-shopify-hmac-sha256': 'court' }))).status).toBe(401)
  })

  test('bonne signature : la commande est lue (ici sans e-mail, donc 200 sans appel réseau)', async () => {
    vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', SECRET)
    const handler = await charger('shopify-order-webhook')
    const corps = '{}'
    const r = await handler(post(corps, { 'x-shopify-hmac-sha256': signer(corps) }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ error: 'No email in order' })
  })
})

// Une fois la garde passée, chaque fonction réagit à sa façon à un corps vide : ce statut prouve qu'on est entré.
const APRES_LA_GARDE: [string, string, number][] = [
  ['shopify-batch-tags', '{"items":[]}', 200],
  ['shopify-sync-tags', '{}', 400],
]

describe.each(APRES_LA_GARDE)('%s : réservé aux admins', (nom, corps, statutAdmin) => {
  test('sans jeton : 401, rien n’est appelé', async () => {
    const appels = simulerReseau('admin')
    const handler = await charger(nom)
    const r = await handler(post(corps))
    expect(r.status).toBe(401)
    expect(appels).toEqual([])
  })

  test('session invalide : 401', async () => {
    simulerReseau('admin', false)
    const handler = await charger(nom)
    const r = await handler(post(corps, { Authorization: 'Bearer perime' }))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'Invalid session' })
  })

  test('un joueur : 403', async () => {
    simulerReseau('player')
    const handler = await charger(nom)
    const r = await handler(post(corps, { Authorization: 'Bearer jwt' }))
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'Forbidden — admin only' })
  })

  test('un admin passe la garde', async () => {
    simulerReseau('admin')
    const handler = await charger(nom)
    const r = await handler(post(corps, { Authorization: 'Bearer jwt' }))
    expect(r.status).toBe(statutAdmin)
  })

  test('la pré-requête autorise l’en-tête Authorization', async () => {
    const handler = await charger(nom)
    const r = await handler(new Request('http://localhost/fonction', { method: 'OPTIONS' }))
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })
})

describe('la boutique est fixe', () => {
  test('shopify-callback : le secret client ne part que chez Runes de Chêne', async () => {
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'id')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret-client')
    const appels = simulerReseau('admin')
    const handler = await charger('shopify-callback')
    await handler(new Request('http://localhost/cb?code=abc&shop=evil.example.com'))
    expect(appels).toEqual([`https://${BOUTIQUE}/admin/oauth/access_token`])
  })

  test('shopify-proxy : le paramètre shop est ignoré', async () => {
    const appels = simulerReseau('admin')
    const handler = await charger('shopify-proxy')
    await handler(
      new Request('http://localhost/p?endpoint=shop.json&shop=evil.example.com', {
        headers: { Authorization: 'Bearer jwt' },
      }),
    )
    const shopify = appels.filter((u) => u.includes('/admin/api/'))
    expect(shopify).toEqual([`https://${BOUTIQUE}/admin/api/2026-01/shop.json`])
  })

  test('shopify-sync : le champ shop du corps est ignoré', async () => {
    const appels = simulerReseau('admin')
    const handler = await charger('shopify-sync')
    await handler(post('{"shop":"evil.example.com"}', { Authorization: 'Bearer jwt' }))
    const shopify = appels.filter((u) => u.includes('/admin/api/'))
    expect(shopify.length).toBeGreaterThan(0)
    expect(shopify.every((u) => u.startsWith(`https://${BOUTIQUE}/`))).toBe(true)
  })
})

describe('shopify-sync : liaison des clients existants', () => {
  const clients = [1, 2, 3].map((n) => ({ id: n, email: `c${String(n)}@x.fr`, first_name: null, last_name: null, orders_count: 0, tags: '', created_at: '2026-01-01' }))
  const comptes = [1, 2, 3].map((n) => ({ id: `u${String(n)}`, email_address: `c${String(n)}@x.fr`, shopify_customer_id: null, account_source: 'app' }))

  const LIER = '/rest/v1/rpc/synchro_lier_clients'

  // Shopify donne trois clients, la base trois comptes à relier ; `pageDesComptes` et `lier` règlent les pannes.
  function simuler(pageDesComptes: unknown, lier: (lignes: unknown[]) => Response) {
    const lots: unknown[][] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('/admin/api/')) return Promise.resolve(Response.json({ customers: clients }))
      if (url.endsWith(LIER)) {
        const lignes = (JSON.parse(String(init?.body)) as { p: unknown[] }).p
        lots.push(lignes)
        return Promise.resolve(lier(lignes))
      }
      return Promise.resolve(Response.json(pageDesComptes))
    }))
    return lots
  }

  test('toutes les fiches à relier partent en un seul appel, et le compte rendu dit combien', async () => {
    const lots = simuler(comptes, (lignes) => Response.json(lignes.length))
    const handler = await charger('shopify-sync')
    const corps = (await (await handler(post('{}', { Authorization: 'Bearer jwt' }))).json()) as { updated: number }
    expect(lots).toHaveLength(1)
    expect(lots[0]).toEqual([
      { id: 'u1', shopify_customer_id: 1 }, { id: 'u2', shopify_customer_id: 2 }, { id: 'u3', shopify_customer_id: 3 },
    ])
    expect(corps.updated).toBe(3)
  })

  test('un lot refusé n’est pas compté et l’erreur est nommée dans les journaux', async () => {
    simuler(comptes, () => new Response('permission denied', { status: 403 }))
    const handler = await charger('shopify-sync')
    const corps = (await (await handler(post('{}', { Authorization: 'Bearer jwt' }))).json()) as { updated: number; toUpdateCount: number; logs: string[] }
    expect(corps.toUpdateCount).toBe(3)
    expect(corps.updated).toBe(0)
    expect(corps.logs.some((l) => l.startsWith('❌') && l.includes('403'))).toBe(true)
  })

  test('l’accord aux nouvelles suit Shopify quand il y est plus récent, même pour un compte déjà relié', async () => {
    const abonne = { state: 'subscribed', consent_updated_at: '2026-10-23T10:00:00Z' }
    const corpsPatch: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('/admin/api/')) {
        return Promise.resolve(Response.json({ customers: [{ ...clients[0], email_marketing_consent: abonne }] }))
      }
      if (url.endsWith(LIER)) {
        for (const ligne of (JSON.parse(String(init?.body)) as { p: { id: string }[] }).p) corpsPatch[ligne.id] = ligne
        return Promise.resolve(Response.json(1))
      }
      return Promise.resolve(Response.json([{ ...comptes[0], shopify_customer_id: 1, accord_nouvelles: false, accord_nouvelles_le: null }]))
    }))
    const handler = await charger('shopify-sync')
    await handler(post('{}', { Authorization: 'Bearer jwt' }))
    expect(corpsPatch.u1).toEqual({
      id: 'u1',
      accord_nouvelles: true,
      accord_nouvelles_le: '2026-10-23T10:00:00Z',
      accord_nouvelles_porte: 'shopify',
    })
  })

  test('un abonné Shopify sans date de consentement est repris, daté de la création du client', async () => {
    const corpsPatch: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('/admin/api/')) {
        return Promise.resolve(Response.json({ customers: [{ ...clients[0], email_marketing_consent: { state: 'subscribed', consent_updated_at: null } }] }))
      }
      if (url.endsWith(LIER)) {
        for (const ligne of (JSON.parse(String(init?.body)) as { p: { id: string }[] }).p) corpsPatch[ligne.id] = ligne
        return Promise.resolve(Response.json(1))
      }
      return Promise.resolve(Response.json([{ ...comptes[0], shopify_customer_id: 1, accord_nouvelles: false, accord_nouvelles_le: null }]))
    }))
    const handler = await charger('shopify-sync')
    await handler(post('{}', { Authorization: 'Bearer jwt' }))
    expect(corpsPatch.u1).toMatchObject({ accord_nouvelles: true, accord_nouvelles_le: '2026-01-01' })
  })

  test('une page de comptes qui n’est pas une liste : 500 explicite, rien n’est lié', async () => {
    simuler({ message: 'JWT expired' }, () => Response.json(0))
    const handler = await charger('shopify-sync')
    const r = await handler(post('{}', { Authorization: 'Bearer jwt' }))
    expect(r.status).toBe(500)
    expect(((await r.json()) as { error: string }).error).toContain('JWT expired')
  })
})

describe('shopify-batch-tags : la requête GraphQL', () => {
  const item = { customerId: 5, email: 'a@b.fr', tags: 'source:app, il a dit "oui"' }

  // Admin valide ; Shopify répond `graphql` et on garde la requête reçue.
  function simuler(graphql: unknown) {
    const requetes: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      requetes.push(String(init?.body))
      return Promise.resolve(Response.json(graphql))
    }))
    return requetes
  }

  test('une étiquette avec un guillemet reste une chaîne valide', async () => {
    const requetes = simuler({ data: { c0: { customer: { id: 'x' }, userErrors: [] } } })
    const handler = await charger('shopify-batch-tags')
    await handler(post(JSON.stringify({ items: [item] }), { Authorization: 'Bearer jwt' }))
    const { query } = JSON.parse(requetes[0] ?? '{}') as { query: string }
    expect(query).toContain('tags: ["source:app", "il a dit \\"oui\\""]')
  })

  test('Shopify répond sans data : ses erreurs remontent, pas « Throttled »', async () => {
    simuler({ errors: [{ message: 'Access denied for customerUpdate field' }] })
    const handler = await charger('shopify-batch-tags')
    const r = await handler(post(JSON.stringify({ items: [item] }), { Authorization: 'Bearer jwt' }))
    expect(r.status).toBe(500)
    expect(((await r.json()) as { error: string }).error).toContain('Access denied')
  })
})

describe('shopify-article : l’image de l’article', () => {
  // Admin valide, un blog configuré ; on garde le corps envoyé à Shopify.
  function simuler() {
    const envoyes: { methode: string | undefined; corps: { article: Record<string, unknown> } }[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('app_settings')) return Promise.resolve(Response.json([{ value: '99' }]))
      envoyes.push({ methode: init?.method, corps: JSON.parse(String(init?.body)) as { article: Record<string, unknown> } })
      return Promise.resolve(Response.json({ article: { id: 7 } }))
    }))
    return envoyes
  }
  const appeler = async (annonce: object, id: string | null) => {
    const handler = await charger('shopify-article')
    return handler(post(JSON.stringify({ announcement: annonce, shopify_article_id: id }), { Authorization: 'Bearer jwt' }))
  }

  test('sans couverture, la mise à jour envoie image: null : Shopify retire l’ancienne', async () => {
    const envoyes = simuler()
    const r = await appeler({ title: 'T', body_html: '<p>x</p>', cover_image: '', type: 'app' }, '7')
    expect(r.status).toBe(200)
    expect(envoyes[0]?.methode).toBe('PUT')
    expect(envoyes[0]?.corps.article).toHaveProperty('image', null)
  })

  test('avec une couverture, l’image part avec son adresse', async () => {
    const envoyes = simuler()
    await appeler({ title: 'T', body_html: '', cover_image: 'https://x/c.png', type: 'app' }, null)
    expect(envoyes[0]?.methode).toBe('POST')
    expect(envoyes[0]?.corps.article).toHaveProperty('image', { src: 'https://x/c.png' })
  })
})

describe('flyer-create-account : publique, donc freinée', () => {
  const IP = '203.0.113.7'

  // `essais` : ce que la table flyer_signup_log rend pour cette IP sur la dernière heure.
  function simuler(
    essais: number,
    shopify: Response = new Response('{}', { status: 500 }),
    comptes: Response = Response.json([]),
  ) {
    const appels: { url: string; methode: string }[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? 'GET' })
      if (url.includes('/rest/v1/flyer_signup_log?')) {
        return Promise.resolve(Response.json(Array.from({ length: essais }, (_, i) => ({ id: i }))))
      }
      if (url.includes('/rest/v1/users?email_address')) return Promise.resolve(comptes.clone())
      if (url.includes('/customers/search.json')) return Promise.resolve(Response.json({ customers: [] }))
      if (url.includes('/admin/api/')) return Promise.resolve(shopify.clone())
      return Promise.resolve(new Response(null, { status: 201 }))
    }))
    return appels
  }
  const demander = (corps: string) =>
    post(corps, { 'x-nf-client-connection-ip': IP, 'Content-Type': 'application/json' })

  test('sans e-mail valide : 400, rien n’est appelé, la valeur reçue n’est pas renvoyée', async () => {
    const appels = simuler(0)
    const handler = await charger('flyer-create-account')
    const r = await handler(demander('{"email":"pas-un-email"}'))
    expect(r.status).toBe(400)
    expect(JSON.stringify(await r.json())).not.toContain('pas-un-email')
    expect(appels).toEqual([])
  })

  test.each([
    ['un espace', '{"email":"claire @exemple.fr"}'],
    ['une requête Shopify glissée', '{"email":"claire@exemple.fr OR email:x@y.fr"}'],
  ])('un e-mail avec %s : 400, rien n’est appelé', async (_, corps) => {
    const appels = simuler(0)
    const handler = await charger('flyer-create-account')
    const r = await handler(demander(corps))
    expect(r.status).toBe(400)
    expect(appels).toEqual([])
  })

  test('compte déjà connu ou tout juste créé : la même réponse, rien ne dit lequel', async () => {
    simuler(0, Response.json({ customer: { id: 42 } }))
    const handler = await charger('flyer-create-account')
    const cree = await handler(demander('{"email":"claire@exemple.fr"}'))
    simuler(0, undefined, Response.json([{ id: 'u1' }]))
    const connu = await (await charger('flyer-create-account'))(demander('{"email":"claire@exemple.fr"}'))
    expect(cree.status).toBe(200)
    expect(await cree.json()).toEqual({ success: true, promoCode: 'CONFRERIE' })
    expect(await connu.json()).toEqual({ success: true, promoCode: 'CONFRERIE' })
  })

  test('ni CORS ouvert ni pré-requête : seul POST passe', async () => {
    simuler(0)
    const handler = await charger('flyer-create-account')
    const options = await handler(new Request('http://localhost/fonction', { method: 'OPTIONS' }))
    expect(options.status).toBe(405)
    const r = await handler(demander('{"email":"pas-un-email"}'))
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  test('la 16ᵉ demande de la même IP dans l’heure : 429, ni Shopify ni compte', async () => {
    const appels = simuler(15)
    const handler = await charger('flyer-create-account')
    const r = await handler(demander('{"email":"claire@exemple.fr"}'))
    expect(r.status).toBe(429)
    expect(typeof ((await r.json()) as { error: unknown }).error).toBe('string')
    expect(appels[0]?.url).toContain(`ip=eq.${IP}`)
    expect(appels.some((a) => a.url.includes('/admin/api/'))).toBe(false)
    expect(appels.some((a) => a.methode === 'POST')).toBe(false)
  })

  test('la 15ᵉ passe le frein et ne parle qu’à la boutique Runes de Chêne', async () => {
    const appels = simuler(14)
    const handler = await charger('flyer-create-account')
    await handler(demander('{"email":"claire@exemple.fr"}'))
    const shopify = appels.filter((a) => a.url.includes('/admin/api/'))
    expect(shopify.length).toBeGreaterThan(0)
    expect(shopify.every((a) => a.url.startsWith(`https://${BOUTIQUE}/`))).toBe(true)
  })

  test('un refus de Shopify ne renvoie ni l’e-mail ni le texte de Shopify', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    simuler(0, new Response('{"errors":{"email":["claire@exemple.fr is invalid"]}}', { status: 422 }))
    const handler = await charger('flyer-create-account')
    const r = await handler(demander('{"email":"claire@exemple.fr"}'))
    expect(r.status).toBe(500)
    expect(JSON.stringify(await r.json())).not.toContain('claire@exemple.fr')
    expect(JSON.stringify(journal.mock.calls)).not.toContain('claire@exemple.fr')
    journal.mockRestore()
  })

  test('une réponse illisible de Supabase à la recherche du compte : 500 en JSON, pas la page de Netlify', async () => {
    simuler(0, undefined, new Response('<html>Bad gateway</html>', { status: 502 }))
    const handler = await charger('flyer-create-account')
    const r = await handler(demander('{"email":"claire@exemple.fr"}'))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'Unexpected error' })
  })
})

describe('shopify-client-webhook : l’accord aux nouvelles venu de Shopify', () => {
  type Appel = { url: string; methode: string; corps: unknown }

  // `fiches` : ce que la base rend pour l'e-mail du client ; `parClient` : pour son identifiant Shopify.
  function simuler(fiches: unknown[], parClient: unknown[] = []) {
    const appels: Appel[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/rest/v1/users?shopify_customer_id')) return Promise.resolve(Response.json(parClient))
      if (url.includes('/rest/v1/users?email_address')) return Promise.resolve(Response.json(fiches))
      return Promise.resolve(new Response(null, { status: 201 }))
    }))
    return appels
  }

  function client(etat: string, le: string | null) {
    return JSON.stringify({
      id: 42,
      email: 'Claire@Exemple.fr',
      first_name: 'Claire',
      created_at: '2025-03-01T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      email_marketing_consent: { state: etat, opt_in_level: 'single_opt_in', consent_updated_at: le },
    })
  }

  function recevoir(corps: string, sujet: string, signature = signer(corps)) {
    return post(corps, { 'x-shopify-hmac-sha256': signature, 'x-shopify-topic': sujet })
  }

  beforeEach(() => vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', SECRET))

  test('sans signature : 401, rien n’est appelé', async () => {
    const appels = simuler([])
    const handler = await charger('shopify-client-webhook')
    const r = await handler(post(client('subscribed', '2026-10-23T10:00:00Z'), { 'x-shopify-topic': 'customers/create' }))
    expect(r.status).toBe(401)
    expect(appels).toEqual([])
  })

  test('signature fausse : 401', async () => {
    simuler([])
    const handler = await charger('shopify-client-webhook')
    const r = await handler(recevoir(client('subscribed', '2026-10-23T10:00:00Z'), 'customers/create', signer('autre')))
    expect(r.status).toBe(401)
  })

  test('un inscrit à la newsletter du site, inconnu : sa fiche naît avec l’accord, porte « site »', async () => {
    const appels = simuler([])
    const handler = await charger('shopify-client-webhook')
    const r = await handler(recevoir(client('subscribed', '2026-10-23T10:00:00Z'), 'customers/create'))
    expect(r.status).toBe(200)
    const creation = appels.find((a) => a.methode === 'POST')
    // Le stand et le flyer créent la même fiche au même moment : la première arrivée garde la place.
    expect(creation?.url).toContain('on_conflict=id')
    expect(creation?.corps).toMatchObject({
      id: 'shopify-42',
      email_address: 'claire@exemple.fr',
      account_source: 'shopify',
      accord_nouvelles: true,
      accord_nouvelles_le: '2026-10-23T10:00:00Z',
      accord_nouvelles_porte: 'site',
    })
  })

  test('un désabonnement Shopify plus récent que l’accord de la fiche l’emporte', async () => {
    const appels = simuler([{ id: 'u1', accord_nouvelles: true, accord_nouvelles_le: '2026-10-01T10:00:00Z' }])
    const handler = await charger('shopify-client-webhook')
    await handler(recevoir(client('unsubscribed', '2026-10-23T10:00:00Z'), 'customers/update'))
    const maj = appels.find((a) => a.methode === 'PATCH')
    expect(maj?.url).toContain('id=eq.u1')
    expect(maj?.corps).toEqual({
      accord_nouvelles: false,
      accord_nouvelles_le: '2026-10-23T10:00:00Z',
      accord_nouvelles_porte: 'shopify',
    })
  })

  test('une fiche à l’e-mail en casse mixte se retrouve par son client Shopify : pas de seconde fiche', async () => {
    const appels = simuler([], [{ id: 'u1', accord_nouvelles: false, accord_nouvelles_le: null }])
    const handler = await charger('shopify-client-webhook')
    await handler(recevoir(client('subscribed', '2026-10-23T10:00:00Z'), 'customers/update'))
    expect(appels.some((a) => a.methode === 'POST')).toBe(false)
    expect(appels.find((a) => a.methode === 'PATCH')?.url).toContain('id=eq.u1')
  })

  test('un abonné Shopify sans date de consentement est repris, daté de sa dernière mise à jour', async () => {
    const appels = simuler([{ id: 'u1', accord_nouvelles: false, accord_nouvelles_le: null }])
    const handler = await charger('shopify-client-webhook')
    await handler(recevoir(client('subscribed', null), 'customers/update'))
    expect(appels.find((a) => a.methode === 'PATCH')?.corps).toEqual({
      accord_nouvelles: true,
      accord_nouvelles_le: '2026-10-20T10:00:00Z',
      accord_nouvelles_porte: 'shopify',
    })
  })

  test('un choix Shopify plus ancien que celui de la fiche ne change rien', async () => {
    const appels = simuler([{ id: 'u1', accord_nouvelles: false, accord_nouvelles_le: '2026-10-23T10:00:00Z' }])
    const handler = await charger('shopify-client-webhook')
    const r = await handler(recevoir(client('subscribed', '2026-10-01T10:00:00Z'), 'customers/update'))
    expect(r.status).toBe(200)
    expect(appels.some((a) => a.methode !== 'GET')).toBe(false)
  })
})

describe('flyer-create-account : la case des nouvelles', () => {
  test('case cochée : la fiche naît avec l’accord, porte « flyer »', async () => {
    const appels: { url: string; methode: string; corps: unknown }[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/rest/v1/flyer_signup_log?')) return Promise.resolve(Response.json([]))
      if (url.includes('/rest/v1/users?email_address')) return Promise.resolve(Response.json([]))
      if (url.includes('/customers/search.json')) return Promise.resolve(Response.json({ customers: [] }))
      if (url.includes('/customers.json')) return Promise.resolve(Response.json({ customer: { id: 42 } }))
      return Promise.resolve(new Response(null, { status: 201 }))
    }))
    const handler = await charger('flyer-create-account')
    await handler(post('{"email":"claire@exemple.fr","newsletter":true}', { 'x-nf-client-connection-ip': '1.2.3.4' }))
    const fiche = appels.find((a) => a.methode === 'POST' && a.url.includes('/rest/v1/users'))
    expect(fiche?.url).toContain('on_conflict=id')
    expect(fiche?.corps).toMatchObject({ id: 'shopify-42', accord_nouvelles: true, accord_nouvelles_porte: 'flyer' })
  })
})

// L'essai vit dans netlify/missives (empaqueté au build, voir le README des fonctions).
async function chargerEssai(): Promise<Fonction> {
  vi.resetModules()
  return ((await import('./missives/missives-essai.ts')) as { default: Fonction }).default
}

describe('missives-essai : la Missive part tout de suite, à l’admin seulement', () => {
  test('sans jeton : 401 ; un joueur : 403 ; un admin sans Missive désignée : 400', async () => {
    const appels = simulerReseau('admin')
    expect((await (await chargerEssai())(post('{}'))).status).toBe(401)
    expect(appels).toEqual([])
    simulerReseau('player')
    expect((await (await chargerEssai())(post('{}', { Authorization: 'Bearer jwt' }))).status).toBe(403)
    simulerReseau('admin')
    expect((await (await chargerEssai())(post('{}', { Authorization: 'Bearer jwt' }))).status).toBe(400)
  })

  test('l’admin la reçoit à son adresse, objet préfixé « [Essai] »', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_cle')
    vi.stubEnv('MISSIVES_JETON_SECRET', 'cle-des-jetons')
    const { EXEMPLES } = await import('@runes/missives')
    const envois: { to: string[]; subject: string }[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('/rest/v1/users?select=email_address')) {
        return Promise.resolve(Response.json([{ email_address: 'uriel@exemple.fr', first_name: 'Uriel' }]))
      }
      if (url.includes('/rest/v1/missives?')) {
        return Promise.resolve(Response.json([{
          id: 7, modele: 'carnet', objet: 'Sur la route', apercu: 'Le camion repart',
          couleurs: { fond: '#1e231b', titres: '#d8bc8a', rupture: '#8a4528' }, contenu: EXEMPLES.carnet,
        }]))
      }
      if (url === 'https://api.resend.com/emails/batch') {
        envois.push(...(JSON.parse(String(init?.body)) as typeof envois))
        return Promise.resolve(Response.json({ data: [{ id: 're_1' }] }))
      }
      return Promise.resolve(new Response('{}', { status: 500 }))
    }))
    const handler = await chargerEssai()
    const r = await handler(post('{"id":7}', { Authorization: 'Bearer jwt' }))
    expect(r.status).toBe(200)
    expect(envois).toEqual([expect.objectContaining({ to: ['uriel@exemple.fr'], subject: '[Essai] Sur la route' })])
  })
})

describe('metriques', () => {
  const get = (q: string, entetes: Record<string, string> = {}) =>
    new Request(`http://localhost/.netlify/functions/metriques?${q}`, { headers: entetes })

  test('sans METRIQUES_JETON configuré : refus, même avec un en-tête', async () => {
    const appels = simulerReseau('admin')
    const handler = await charger('metriques')
    const r = await handler(get('debut=2026-11-01&fin=2026-11-30', { Authorization: 'Bearer ' }))
    expect(r.status).toBe(401)
    expect(appels).toEqual([])
  })

  test('mauvais jeton : 401, Shopify jamais appelé', async () => {
    vi.stubEnv('METRIQUES_JETON', 'le-bon')
    const appels = simulerReseau('admin')
    const handler = await charger('metriques')
    const r = await handler(get('debut=2026-11-01&fin=2026-11-30', { Authorization: 'Bearer le-faux' }))
    expect(r.status).toBe(401)
    expect(appels).toEqual([])
  })

  test('dates mal formées : 400', async () => {
    vi.stubEnv('METRIQUES_JETON', 'le-bon')
    simulerReseau('admin')
    const handler = await charger('metriques')
    const r = await handler(get('debut=hier&fin=2026-11-30', { Authorization: 'Bearer le-bon' }))
    expect(r.status).toBe(400)
  })

  test('bon jeton : somme le CA sur toutes les pages, boutique fixe', async () => {
    vi.stubEnv('METRIQUES_JETON', 'le-bon')
    const pages = [
      { nodes: [{ currentTotalPriceSet: { shopMoney: { amount: '40.50' } }, currentSubtotalLineItemsQuantity: 3 }], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
      { nodes: [{ currentTotalPriceSet: { shopMoney: { amount: '9.50' } }, currentSubtotalLineItemsQuantity: 1 }], pageInfo: { hasNextPage: false, endCursor: null } },
    ]
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      urls.push(url)
      if (url.includes('/rest/v1/scans')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/12' } }))
      if (url.includes('not.like') && !url.includes('account_source')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/9' } }))
      if (url.includes('not.like')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/2' } }))
      if (url.includes('eq.flyer')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/3' } }))
      if (url.includes('eq.app')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/4' } }))
      if (url.includes('eq.shopify')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/5' } }))
      if (url.includes('/rest/v1/users')) return Promise.resolve(new Response(null, { headers: { 'Content-Range': '0-0/7' } }))
      return Promise.resolve(Response.json({ data: { orders: pages.shift() } }))
    }))
    const handler = await charger('metriques')
    const r = await handler(get('debut=2026-11-01&fin=2026-11-30', { Authorization: 'Bearer le-bon' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      debut: '2026-11-01', fin: '2026-11-30', ca: 50, commandes: 2, pieces: 4,
      inscriptions_stand: 7, activations_stand: 2, scans: 12,
      comptes_stand: 7, comptes_flyer: 3, comptes_app: 4, comptes_boutique: 5, membres: 9,
    })
    expect(urls.filter((u) => !u.startsWith('http://supabase.test/')).every((u) => u.startsWith(`https://${BOUTIQUE}/`))).toBe(true)
    // Les jours de Paris : novembre en heure d'hiver, borne de fin exclue.
    const users = urls.find((u) => u.includes('/rest/v1/users'))!
    expect(users).toContain('created_at=gte.2026-10-31T23:00:00.000Z')
    expect(users).toContain('created_at=lt.2026-11-30T23:00:00.000Z')
  })

  test('minuit à Paris, en hiver comme en été', async () => {
    const { minuitParis } = await import('./functions/metriques')
    expect(minuitParis('2026-11-01')).toBe('2026-10-31T23:00:00.000Z')
    expect(minuitParis('2026-07-01')).toBe('2026-06-30T22:00:00.000Z')
    expect(minuitParis('2027-03-28')).toBe('2027-03-27T23:00:00.000Z')
  })
})
