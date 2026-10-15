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

  // Shopify donne trois clients, la base trois comptes à relier ; `pageDesComptes` et `patch` règlent les pannes.
  function simuler(pageDesComptes: unknown, patch: (url: string) => Response) {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'u0' }))
      if (url.includes('/rest/v1/users?select=role')) return Promise.resolve(Response.json([{ role: 'admin' }]))
      if (url.includes('/admin/api/')) return Promise.resolve(Response.json({ customers: clients }))
      if (init?.method === 'PATCH') return Promise.resolve(patch(url))
      return Promise.resolve(Response.json(pageDesComptes))
    }))
  }

  test('seules les réponses ok comptent : un refus est compté en moins et nommé dans les journaux', async () => {
    simuler(comptes, (url) => (url.endsWith('id=eq.u2') ? new Response('permission denied', { status: 403 }) : new Response(null, { status: 204 })))
    const handler = await charger('shopify-sync')
    const r = await handler(post('{}', { Authorization: 'Bearer jwt' }))
    const corps = (await r.json()) as { updated: number; toUpdateCount: number; logs: string[] }
    expect(corps.toUpdateCount).toBe(3)
    expect(corps.updated).toBe(2)
    expect(corps.logs.some((l) => l.startsWith('❌') && l.includes('403'))).toBe(true)
  })

  test('une page de comptes qui n’est pas une liste : 500 explicite, rien n’est lié', async () => {
    simuler({ message: 'JWT expired' }, () => new Response(null, { status: 204 }))
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
  function simuler(essais: number, shopify: Response = new Response('{}', { status: 500 })) {
    const appels: { url: string; methode: string }[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? 'GET' })
      if (url.includes('/rest/v1/flyer_signup_log?')) {
        return Promise.resolve(Response.json(Array.from({ length: essais }, (_, i) => ({ id: i }))))
      }
      if (url.includes('/rest/v1/users?email_address')) return Promise.resolve(Response.json([]))
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
})
