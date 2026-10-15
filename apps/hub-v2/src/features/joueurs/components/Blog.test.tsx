import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { oublierLesArticlesCrees } from '../hooks/useBlog'
import { Blog } from './Blog'
import { TiroirArticle } from './TiroirArticle'

const mockRpc = vi.hoisted(() => vi.fn())
const mockAppeler = vi.hoisted(() => vi.fn())
const mockLire = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))
vi.mock('@/shared/lib/fonctions', () => ({ appelerFonction: mockAppeler, lireReponse: mockLire }))

const brouillon = {
  id: 'a1', slug: 'x', type: 'produit', title: 'Le nouveau jeu', cover_image: null as string | null, body: '**Salut**\n\n- un\n- deux',
  push_text: null, insta_caption: null, cta_url: 'https://runesdechene.com', cta_label: 'Voir', status: 'draft', audience: 'all',
  shopify_article_id: null as string | null, channels: {}, published_at: null, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
}
const enLigne = { ...brouillon, id: 'a2', title: 'Déjà en ligne', type: 'app', shopify_article_id: '42' }

const appels: string[] = []
function monter(adresse: string, liste = [brouillon, enLigne]) {
  mockRpc.mockImplementation((nom: string, args: { p_id?: string }) => {
    appels.push(nom)
    if (nom === 'list_announcements_admin') return Promise.resolve({ data: liste, error: null })
    if (nom === 'create_announcement') return Promise.resolve({ data: { ...brouillon, id: 'a3', title: 'Neuf' }, error: null })
    return Promise.resolve({ data: liste.find((a) => a.id === args.p_id), error: null })
  })
  mockAppeler.mockImplementation(() => { appels.push('fonction'); return Promise.resolve(new Response('{}')) })
  mockLire.mockResolvedValue({ article_id: '77' })
  const router = createMemoryRouter([
    { path: '/joueurs/blog', Component: Blog, children: [{ path: 'nouveau', Component: TiroirArticle }, { path: ':id', Component: TiroirArticle }] },
  ], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => {
  vi.clearAllMocks(); appels.length = 0; oublierLesArticlesCrees()
  mockEnvoyer.mockImplementation(() => { appels.push('envoi'); return Promise.resolve('https://x/nouvelle.png') })
  mockRetirer.mockImplementation(() => { appels.push('retrait'); return Promise.resolve() })
  URL.createObjectURL = vi.fn(() => 'blob:apercu')
  URL.revokeObjectURL = vi.fn()
})

test('la liste montre titre, type et « Brouillon » ou « Sur la boutique »', async () => {
  monter('/joueurs/blog')
  const premiere = await screen.findByRole('link', { name: /Le nouveau jeu/ })
  expect(premiere).toHaveTextContent('Brouillon')
  expect(premiere).toHaveTextContent('produit')
  expect(screen.getByRole('link', { name: /Déjà en ligne/ })).toHaveTextContent('Sur la boutique')
})

test('sans article Shopify le bouton dit « Publier sur la boutique »', async () => {
  monter('/joueurs/blog/a1')
  expect(await screen.findByRole('button', { name: 'Publier sur la boutique' })).toBeEnabled()
})

test('avec un article Shopify le bouton dit « Mettre à jour l’article »', async () => {
  monter('/joueurs/blog/a2')
  expect(await screen.findByRole('button', { name: 'Mettre à jour l’article' })).toBeEnabled()
})

test('la fonction part d’abord, puis le canal est marqué publié avec l’article rendu', async () => {
  monter('/joueurs/blog/a1')
  await userEvent.click(await screen.findByRole('button', { name: 'Publier sur la boutique' }))
  await waitFor(() => { expect(appels).toContain('set_announcement_channel') })
  expect(appels.indexOf('fonction')).toBeLessThan(appels.indexOf('set_announcement_channel'))
  const corps = (mockAppeler.mock.calls[0] as [string, { corps: { announcement: { body_html: string }; shopify_article_id: string | null } }])[1].corps
  expect(corps.announcement.body_html).toContain('<strong>Salut</strong>')
  expect(corps.announcement.body_html).toContain('href="https://runesdechene.com"')
  expect(corps.shopify_article_id).toBeNull()
  expect(mockRpc).toHaveBeenCalledWith('set_announcement_channel', { p_id: 'a1', p_channel: 'blog', p_state: 'published', p_shopify_article_id: '77' })
})

test('la fonction en panne : son message s’affiche et le canal n’est pas touché', async () => {
  monter('/joueurs/blog/a1')
  mockLire.mockRejectedValue(new Error('Shopify refuse'))
  await userEvent.click(await screen.findByRole('button', { name: 'Publier sur la boutique' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Shopify refuse')
  expect(appels).not.toContain('set_announcement_channel')
})

test('set_announcement_channel en échec : son erreur s’affiche', async () => {
  monter('/joueurs/blog/a1')
  mockRpc.mockImplementation((nom: string, args: { p_id?: string }) => {
    if (nom === 'list_announcements_admin') return Promise.resolve({ data: [brouillon], error: null })
    if (nom === 'set_announcement_channel') return Promise.resolve({ data: null, error: { message: 'admin_only' } })
    return Promise.resolve({ data: args.p_id === 'a1' ? brouillon : null, error: null })
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Publier sur la boutique' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('admin_only')
})

test('un nouvel article se crée avec son type et son titre, puis s’ouvre', async () => {
  const router = monter('/joueurs/blog/nouveau')
  await userEvent.type(await screen.findByLabelText('Titre'), 'Neuf')
  await userEvent.click(screen.getByRole('radio', { name: 'app' }))
  await userEvent.click(screen.getByRole('button', { name: 'Créer le brouillon' }))
  await waitFor(() => { expect(router.state.location.pathname).toBe('/joueurs/blog/a3') })
  expect(mockRpc).toHaveBeenCalledWith('create_announcement', { p_type: 'app', p_title: 'Neuf' })
})

test('set_announcement_channel en échec puis nouvel essai : jamais deux articles Shopify', async () => {
  const router = monter('/joueurs/blog/a1')
  let canalEnPanne = true
  mockRpc.mockImplementation((nom: string, args: { p_id?: string }) => {
    if (nom === 'list_announcements_admin') return Promise.resolve({ data: [brouillon], error: null })
    if (nom === 'set_announcement_channel' && canalEnPanne) return Promise.resolve({ data: null, error: { message: 'admin_only' } })
    return Promise.resolve({ data: args.p_id === 'a1' ? brouillon : null, error: null })
  })
  await userEvent.click(await screen.findByRole('button', { name: 'Publier sur la boutique' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('admin_only')
  // Le tiroir se ferme puis se rouvre : le formulaire repart de zéro.
  await router.navigate('/joueurs/blog')
  await userEvent.click(await screen.findByRole('link', { name: /Le nouveau jeu/ }))
  canalEnPanne = false
  await userEvent.click(screen.getByRole('button', { name: 'Publier sur la boutique' }))
  await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent('Publié') })
  const envoyes = mockAppeler.mock.calls as [string, { corps: { shopify_article_id: string | null } }][]
  expect(envoyes[0]?.[1].corps.shopify_article_id).toBeNull()
  expect(envoyes.slice(1).every((c) => c[1].corps.shopify_article_id === '77')).toBe(true)
})

test('l’aperçu rend le Markdown tapé', async () => {
  monter('/joueurs/blog/a1')
  const texte = await screen.findByLabelText('Texte')
  await userEvent.clear(texte)
  await userEvent.type(texte, '**gras**')
  expect(screen.getByTestId('apercu').querySelector('strong')).toHaveTextContent('gras')
})

test('un type inconnu reste tel quel à l’enregistrement', async () => {
  monter('/joueurs/blog/a1', [{ ...brouillon, type: 'autre' }])
  await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(mockRpc).toHaveBeenCalledWith('update_announcement', expect.objectContaining({ p_type: 'autre' })) })
})

test('une couverture choisie ne part qu’à l’enregistrement : un envoi, après quoi l’ancienne est retirée', async () => {
  monter('/joueurs/blog/a1', [{ ...brouillon, cover_image: 'https://x/ancienne.png' }])
  const champ = await screen.findByLabelText(/Changer la couverture/)
  await userEvent.upload(champ, new File(['x'], 'c.png', { type: 'image/png' }))
  expect(mockEnvoyer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('announcement-covers', 'https://x/ancienne.png') })
  expect(mockEnvoyer).toHaveBeenCalledTimes(1)
  expect(appels.indexOf('envoi')).toBeLessThan(appels.indexOf('update_announcement'))
  expect(appels.indexOf('update_announcement')).toBeLessThan(appels.indexOf('retrait'))
  expect(mockRpc).toHaveBeenCalledWith('update_announcement', expect.objectContaining({ p_cover_image: 'https://x/nouvelle.png' }))
})
