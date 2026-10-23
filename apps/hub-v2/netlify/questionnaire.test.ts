/**
 * QUOI     — la fonction du questionnaire « Dis-nous qui tu es » : lire, répondre, demander son lien.
 * ATTENTION — `fetch` est simulé : la base et Resend ne sont pas touchés.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signer } from './functions/lib/jeton'

type Fonction = (request: Request) => Promise<Response>
type Appel = { url: string; methode: string; corps: unknown }

async function charger(): Promise<Fonction> {
  vi.resetModules()
  return ((await import('./missives/questionnaire.ts')) as { default: Fonction }).default
}

// La base connaît u1 (Kelpie, kelpie@exemple.fr). `dejaDemande` : une demande de lien récente pour cette adresse.
function simuler({ dejaDemande = false } = {}) {
  const appels: Appel[] = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const brut = init?.body ? String(init.body) : null
    appels.push({ url, methode: init?.method ?? 'GET', corps: brut ? JSON.parse(brut) : null })
    if (url.includes('/rest/v1/users?id=eq.u1')) return Promise.resolve(Response.json([{ first_name: 'Kelpie' }]))
    if (url.includes('/rest/v1/users?email_address=ilike.kelpie')) return Promise.resolve(Response.json([{ id: 'u1', first_name: 'Kelpie' }]))
    if (url.includes('/rest/v1/users?email_address')) return Promise.resolve(Response.json([]))
    if (url.includes('/rest/v1/portraits')) return Promise.resolve(Response.json([]))
    if (url.includes('/rest/v1/questionnaire_demandes') && (init?.method ?? 'GET') === 'GET') {
      return Promise.resolve(Response.json(dejaDemande ? [{ le: new Date().toISOString() }] : []))
    }
    if (url.startsWith('https://api.resend.com')) return Promise.resolve(Response.json({ data: [{ id: 're_1' }] }))
    return Promise.resolve(new Response(null, { status: 204 }))
  }))
  return appels
}

const poster = (corps: unknown) =>
  new Request('http://localhost/fonction', { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('RESEND_API_KEY', 're_cle')
  vi.stubEnv('MISSIVES_JETON_SECRET', 'cle-des-jetons')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('questionnaire', () => {
  test('un lien de désabonnement n’ouvre pas le questionnaire', async () => {
    const appels = simuler()
    const handler = await charger()
    const r = await handler(poster({ jeton: signer('u1'), reponses: { epoques: ['celtes'] } }))
    expect(r.status).toBe(403)
    expect(appels.some((a) => a.url.includes('questionnaire_repondre'))).toBe(false)
  })

  test('des réponses hors liste sont refusées avant la base', async () => {
    const appels = simuler()
    const handler = await charger()
    const r = await handler(poster({ jeton: signer('u1', 'questionnaire'), reponses: { epoques: ['atlantide'] } }))
    expect(r.status).toBe(400)
    expect(appels.some((a) => a.url.includes('/rest/v1/'))).toBe(false)
  })

  test('des réponses valables s’écrivent pour la personne du lien, et la page salue son prénom', async () => {
    const appels = simuler()
    const handler = await charger()
    const r = await handler(poster({ jeton: signer('u1', 'questionnaire'), reponses: { epoques: ['celtes'], anniv_jour: 12, anniv_mois: 3 } }))
    expect(await r.json()).toEqual({ ok: true, prenom: 'Kelpie' })
    const ecrit = appels.find((a) => a.url.endsWith('/rest/v1/rpc/questionnaire_repondre'))
    expect(ecrit?.corps).toMatchObject({ p_user: 'u1', p: { epoques: ['celtes'], anniv_jour: 12, anniv_mois: 3 } })
  })

  test('lire : le prénom de la personne du lien', async () => {
    simuler()
    const handler = await charger()
    const r = await handler(new Request(`http://localhost/fonction?j=${encodeURIComponent(signer('u1', 'questionnaire'))}`))
    expect(await r.json()).toEqual({ prenom: 'Kelpie', portrait: null })
  })

  test('une adresse inconnue : même réponse, aucun e-mail', async () => {
    const appels = simuler()
    const handler = await charger()
    const r = await handler(poster({ email: 'personne@exemple.fr' }))
    expect(await r.json()).toEqual({ ok: true })
    expect(appels.some((a) => a.url.startsWith('https://api.resend.com'))).toBe(false)
  })

  test('une adresse connue reçoit un lien au jeton du questionnaire, jamais à celui du désabonnement', async () => {
    const appels = simuler()
    const handler = await charger()
    await handler(poster({ email: 'Kelpie@exemple.fr' }))
    const envoi = appels.find((a) => a.url.startsWith('https://api.resend.com'))
    const html = JSON.stringify(envoi?.corps)
    expect(html).toContain(encodeURIComponent(signer('u1', 'questionnaire')))
    expect(html).not.toContain(encodeURIComponent(signer('u1')))
  })

  test('deux demandes en dix minutes : un seul e-mail', async () => {
    const appels = simuler({ dejaDemande: true })
    const handler = await charger()
    expect(await (await handler(poster({ email: 'kelpie@exemple.fr' }))).json()).toEqual({ ok: true })
    expect(appels.some((a) => a.url.startsWith('https://api.resend.com'))).toBe(false)
  })
})
