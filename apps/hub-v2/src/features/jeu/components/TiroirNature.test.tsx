import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirNature } from './TiroirNature'

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({ ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer }))
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom, rpc: mockRpc } }))

const monts = { id: 'monts', title: 'Monts', color: '#708d44', background: '#F1FCEF', icon: null, order: 4, hors_epoque: false }

function monter(adresse: string) {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [monts], error: null }) } }
  mockFrom.mockReturnValue({
    select: () => lecture,
    insert: mockInsert.mockResolvedValue({ error: null }),
    update: mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
  })
  mockRpc.mockResolvedValue({ data: [], error: null })
  const router = createMemoryRouter([{ path: '/jeu/natures', children: [
    { path: 'nouvelle', Component: TiroirNature }, { path: ':id', Component: TiroirNature },
  ] }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => { vi.clearAllMocks() })

test('création : l’identifiant vient du nom, l’ordre est le maximum + 1, couleurs par défaut', async () => {
  const router = monter('/jeu/natures/nouvelle')
  await userEvent.type(await screen.findByLabelText('Nom'), 'Sources sacrées')
  expect(screen.getByLabelText('Identifiant')).toHaveValue('sources-sacrees')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(mockInsert).toHaveBeenCalledWith({
    id: 'sources-sacrees', title: 'Sources sacrées', color: '#C19A6B', background: '#F5E6D3', icon: null, order: 5, hors_epoque: false,
  })
  await vi.waitFor(() => { expect(router.state.location.pathname).toBe('/jeu/natures/sources-sacrees') })
})

test('une icône qui n’est pas un SVG : le message reste affiché, rien n’est envoyé', async () => {
  monter('/jeu/natures/monts')
  const champ = await screen.findByLabelText('Icône SVG')
  await userEvent.upload(champ, new File(['x'], 'a.png', { type: 'image/png' }), { applyAccept: false })
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce type de fichier n’est pas accepté (SVG)')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('enregistrer une nature : update avec updated_at et « Hors époque »', async () => {
  monter('/jeu/natures/monts')
  await userEvent.click(await screen.findByLabelText('Hors époque'))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(mockUpdate).toHaveBeenCalledWith({
    title: 'Monts', color: '#708d44', background: '#F1FCEF', icon: null, order: 4, hors_epoque: true, updated_at: expect.any(String) as string,
  })
})

test('une couleur mal écrite est refusée avant l’envoi', async () => {
  monter('/jeu/natures/monts')
  const couleur = await screen.findByLabelText('Couleur du texte')
  await userEvent.clear(couleur)
  await userEvent.type(couleur, 'vert')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('#RRGGBB')
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('une nature inconnue : introuvable', async () => {
  monter('/jeu/natures/autre')
  expect(await screen.findByText('Nature introuvable.')).toBeInTheDocument()
})

test('l’identifiant « nouvelle » est réservé : il porte la route de création', async () => {
  monter('/jeu/natures/nouvelle')
  await userEvent.type(await screen.findByLabelText('Nom'), 'Nouvelle')
  expect(screen.getByLabelText('Identifiant')).toHaveValue('nouvelle')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cet identifiant est réservé.')
  expect(mockInsert).not.toHaveBeenCalled()
})
