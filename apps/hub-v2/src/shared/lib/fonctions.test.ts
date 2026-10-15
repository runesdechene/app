import { vi } from 'vitest'
import { appelerFonction, lireReponse } from './fonctions'

const session = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { auth: { getSession: session } } }))

test('le jeton part avec l’appel, les paramètres dans l’adresse', async () => {
  session.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  const f = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', f)
  await appelerFonction('shopify-proxy', { methode: 'POST', corps: { a: 1 }, parametres: { endpoint: 'graphql.json' } })
  expect(f).toHaveBeenCalledWith('/.netlify/functions/shopify-proxy?endpoint=graphql.json', {
    method: 'POST',
    body: '{"a":1}',
    headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
  })
})
test('sans session : on le dit', async () => {
  session.mockResolvedValue({ data: { session: null } })
  await expect(appelerFonction('shopify-health-check')).rejects.toThrow('Session expirée : reconnecte-toi.')
})
test('du HTML au lieu de JSON : un message lisible', async () => {
  await expect(lireReponse(new Response('<!doctype html>', { status: 404 })))
    .rejects.toThrow('Les fonctions Netlify ne répondent pas (HTTP 404).')
})
test('une erreur de la fonction remonte telle quelle', async () => {
  await expect(lireReponse(new Response('{"error":"Forbidden — admin only"}', { status: 403 }))).rejects.toThrow('Forbidden — admin only')
})
test('un échec relayé en JSON n’est jamais une réussite', async () => {
  await expect(lireReponse(new Response('{"errors":"Not Found"}', { status: 500 }))).rejects.toThrow('Not Found')
  await expect(lireReponse(new Response('{}', { status: 502 }))).rejects.toThrow('HTTP 502')
})
test('un corps JSON est rendu', async () => {
  await expect(lireReponse<{ ok: boolean }>(new Response('{"ok":true}'))).resolves.toEqual({ ok: true })
})
