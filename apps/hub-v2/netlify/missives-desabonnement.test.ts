/**
 * QUOI     — le désabonnement en un clic et le suivi des envois par le webhook de Resend.
 */
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signer } from './functions/lib/jeton'

type Fonction = (request: Request) => Promise<Response>
type Appel = { url: string; methode: string; corps: unknown }

async function charger(nom: string): Promise<Fonction> {
  vi.resetModules()
  return ((await import(`./functions/${nom}.ts`)) as { default: Fonction }).default
}

// La base et Shopify simulés : la fiche u1 est reliée au client Shopify 42. `envois` : ce que rend la
// recherche de l'envoi par resend_id ; `ecriture` : le statut d'une écriture sur la fiche.
function simuler(envois: unknown[] = [{ user_id: 'u1' }], ecriture = 204) {
  const appels: Appel[] = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const brut = init?.body ? String(init.body) : null
    appels.push({ url, methode: init?.method ?? 'GET', corps: brut ? JSON.parse(brut) : null })
    if (url.includes('/rest/v1/users?id=eq.u1&select')) return Promise.resolve(Response.json([{ shopify_customer_id: 42 }]))
    if (url.includes('/rest/v1/missive_envois?resend_id')) return Promise.resolve(Response.json(envois))
    if (url.includes('/rest/v1/users?id=eq.u1') && init?.method === 'PATCH') return Promise.resolve(new Response(null, { status: ecriture }))
    return Promise.resolve(Response.json({}))
  }))
  return appels
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('SHOPIFY_ACCESS_TOKEN', 'jeton-shopify')
  vi.stubEnv('MISSIVES_JETON_SECRET', 'cle-des-jetons')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('missives-desabonnement', () => {
  const depuisLaPage = (j: string) =>
    new Request('http://localhost/fonction', { method: 'POST', body: JSON.stringify({ j }), headers: { 'Content-Type': 'application/json' } })
  // RFC 8058 : la boîte de réception poste « List-Unsubscribe=One-Click » à l'adresse de l'en-tête.
  const enUnClic = (j: string) =>
    new Request(`http://localhost/fonction?j=${encodeURIComponent(j)}`, {
      method: 'POST',
      body: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

  test('un jeton faux : 400, rien n’est écrit', async () => {
    const appels = simuler()
    const handler = await charger('missives-desabonnement')
    const r = await handler(depuisLaPage('u1.faux'))
    expect(r.status).toBe(400)
    expect(appels).toEqual([])
  })

  test('un bon jeton : l’accord est retiré, porte « desabonnement », et Shopify suit', async () => {
    const appels = simuler()
    const handler = await charger('missives-desabonnement')
    const r = await handler(enUnClic(signer('u1')))
    expect(r.status).toBe(200)
    const fiche = appels.find((a) => a.methode === 'PATCH' && a.url.includes('/rest/v1/users?id=eq.u1'))
    expect(fiche?.corps).toMatchObject({ accord_nouvelles: false, accord_nouvelles_porte: 'desabonnement' })
    const shopify = appels.find((a) => a.url.includes('/customers/42.json'))
    expect(shopify?.corps).toMatchObject({ customer: { id: 42, email_marketing_consent: { state: 'unsubscribed' } } })
  })

  test('si la fiche n’a pas pu s’écrire, le désabonnement ne se dit pas fait', async () => {
    simuler(undefined, 500)
    const handler = await charger('missives-desabonnement')
    expect((await handler(depuisLaPage(signer('u1')))).status).toBe(500)
  })

  test('depuis la page, un second désabonnement répond 200 sans erreur', async () => {
    simuler()
    const handler = await charger('missives-desabonnement')
    expect((await handler(depuisLaPage(signer('u1')))).status).toBe(200)
    expect((await handler(depuisLaPage(signer('u1')))).status).toBe(200)
  })
})

describe('resend-webhook', () => {
  // Resend signe ses webhooks avec Svix : HMAC-SHA256 de « id.horodatage.corps », clé = le secret décodé.
  const CLE = Buffer.from('cle-du-webhook-de-resend').toString('base64')
  function signe(corps: string) {
    const id = 'msg_1'
    const horodatage = String(Math.floor(Date.now() / 1000))
    const signature = crypto.createHmac('sha256', Buffer.from(CLE, 'base64')).update(`${id}.${horodatage}.${corps}`).digest('base64')
    return new Request('http://localhost/fonction', {
      method: 'POST',
      body: corps,
      headers: { 'svix-id': id, 'svix-timestamp': horodatage, 'svix-signature': `v1,${signature}` },
    })
  }
  const evenement = (type: string, from = 'Uriel · Runes de Chêne <uriel@missives.runesdechene.com>') =>
    JSON.stringify({ type, created_at: '2026-10-23T10:00:00Z', data: { email_id: 're_1', from } })

  beforeEach(() => vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${CLE}`))

  test('sans signature : 401, rien n’est écrit', async () => {
    const appels = simuler()
    const handler = await charger('resend-webhook')
    const r = await handler(new Request('http://localhost/fonction', { method: 'POST', body: evenement('email.bounced') }))
    expect(r.status).toBe(401)
    expect(appels).toEqual([])
  })

  test('une signature fausse : 401', async () => {
    simuler()
    const handler = await charger('resend-webhook')
    const requete = signe(evenement('email.opened'))
    const fausse = new Request(requete, { body: evenement('email.bounced') })
    expect((await handler(fausse)).status).toBe(401)
  })

  test('un rebond signé : l’envoi passe « rebond » et l’accord est retiré, porte « rebond »', async () => {
    const appels = simuler()
    const handler = await charger('resend-webhook')
    const r = await handler(signe(evenement('email.bounced')))
    expect(r.status).toBe(200)
    const envoi = appels.find((a) => a.methode === 'PATCH' && a.url.includes('missive_envois?resend_id=eq.re_1'))
    expect(envoi?.corps).toEqual({ statut: 'rebond' })
    const fiche = appels.find((a) => a.methode === 'PATCH' && a.url.includes('users?id=eq.u1'))
    expect(fiche?.corps).toMatchObject({ accord_nouvelles: false, accord_nouvelles_porte: 'rebond' })
  })

  test('un rebond arrivé avant que l’envoi soit noté : 503, pour que Resend le renvoie', async () => {
    simuler([])
    const handler = await charger('resend-webhook')
    expect((await handler(signe(evenement('email.bounced')))).status).toBe(503)
  })

  test('un rebond d’un e-mail de service de l’appli (autre domaine) est ignoré, sans relance', async () => {
    const appels = simuler([])
    const handler = await charger('resend-webhook')
    const r = await handler(signe(evenement('email.bounced', 'Runes de Chêne <ne-pas-repondre@mail.runesdechene.com>')))
    expect(r.status).toBe(200)
    expect(appels).toEqual([])
  })

  test('une plainte retire l’accord jusque chez Shopify', async () => {
    const appels = simuler()
    const handler = await charger('resend-webhook')
    await handler(signe(evenement('email.complained')))
    const shopify = appels.find((a) => a.url.includes('/customers/42.json'))
    expect(shopify?.corps).toMatchObject({ customer: { email_marketing_consent: { state: 'unsubscribed' } } })
  })

  test('une ouverture signée : la première date d’ouverture est notée', async () => {
    const appels = simuler()
    const handler = await charger('resend-webhook')
    await handler(signe(evenement('email.opened')))
    const envoi = appels.find((a) => a.methode === 'PATCH')
    expect(envoi?.url).toContain('ouvert_le=is.null')
    expect(envoi?.corps).toEqual({ ouvert_le: '2026-10-23T10:00:00Z' })
  })
})
