import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirBanniere } from './TiroirBanniere'

const mockFrom = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom } }))

const equinoxe = {
  id: 1, image_url: 'https://x/storage/v1/object/public/home-banners/banner-1.png', title: 'Equinoxe', subtitle: null,
  link_url: 'https://runesdechene.com/c/equinoxe', active: true, created_at: '',
  overlay_color: '#000000', overlay_opacity: 0.85, tag_color: '#ffffff', title_color: '#ffffff', subtitle_color: '#ffffff',
  shadow_color: '#000000', shadow_strength: 0.5,
}

function monter(adresse: string, echecSuppression = false) {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [equinoxe], error: null }) } }
  mockFrom.mockReturnValue({
    select: () => lecture,
    update: mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
    delete: mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: echecSuppression ? { message: 'refusé' } : null }) }),
  })
  mockEnvoyer.mockResolvedValue('https://x/storage/v1/object/public/home-banners/banner-2.png')
  mockRetirer.mockResolvedValue(undefined)
  const router = createMemoryRouter([{ path: '/jeu/bannieres', children: [{ path: ':id', Component: TiroirBanniere }] }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => { vi.clearAllMocks() })

test('un lien sans http:// ni https:// est refusé, rien n’est écrit', async () => {
  monter('/jeu/bannieres/1')
  const lien = await screen.findByLabelText('Lien')
  await userEvent.clear(lien)
  await userEvent.type(lien, 'runesdechene.com')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Le lien doit commencer par http:// ou https://')
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('enregistrer : update de tous les champs, puis « Enregistré. »', async () => {
  monter('/jeu/bannieres/1')
  await userEvent.type(await screen.findByLabelText('Sous-titre'), 'Nouvelle collection')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(mockUpdate).toHaveBeenCalledWith({
    title: 'Equinoxe', subtitle: 'Nouvelle collection', link_url: 'https://runesdechene.com/c/equinoxe', active: true,
    overlay_color: '#000000', overlay_opacity: 0.85, tag_color: '#ffffff', title_color: '#ffffff', subtitle_color: '#ffffff',
    shadow_color: '#000000', shadow_strength: 0.5,
  })
})

test('l’aperçu suit le titre saisi', async () => {
  monter('/jeu/bannieres/1')
  const titre = await screen.findByLabelText('Titre')
  await userEvent.clear(titre)
  await userEvent.type(titre, 'Solstice')
  expect(screen.getByTestId('apercu')).toHaveTextContent('Solstice')
})

test('un fichier de 6 Mo est refusé, le message reste, rien n’est envoyé', async () => {
  monter('/jeu/bannieres/1')
  const gros = new File(['x'], 'g.png', { type: 'image/png' })
  Object.defineProperty(gros, 'size', { value: 6 * 1024 * 1024 })
  await userEvent.upload(await screen.findByLabelText("Changer l'image"), gros)
  expect(await screen.findByRole('alert')).toHaveTextContent('Le fichier dépasse 5 Mo.')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('changer l’image : update, puis retrait de l’ancien fichier', async () => {
  monter('/jeu/bannieres/1')
  await userEvent.upload(await screen.findByLabelText("Changer l'image"), new File(['x'], 'a.png', { type: 'image/png' }))
  await vi.waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('home-banners', equinoxe.image_url) })
  expect(mockUpdate).toHaveBeenCalledWith({ image_url: 'https://x/storage/v1/object/public/home-banners/banner-2.png' })
})

test('supprimer demande confirmation : rien avant, puis la ligne, puis le fichier', async () => {
  const router = monter('/jeu/bannieres/1')
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  expect(mockDelete).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  await vi.waitFor(() => { expect(router.state.location.pathname).toBe('/jeu/bannieres') })
  expect(mockDelete).toHaveBeenCalled()
  expect(mockRetirer).toHaveBeenCalledWith('home-banners', equinoxe.image_url)
})

test('si la ligne ne part pas, le fichier reste et l’erreur s’affiche', async () => {
  monter('/jeu/bannieres/1', true)
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('refusé')
  expect(mockRetirer).not.toHaveBeenCalled()
})

test('une adresse qui n’est pas un numéro : introuvable', async () => {
  monter('/jeu/bannieres/abc')
  expect(await screen.findByText('Bannière introuvable.')).toBeInTheDocument()
})
