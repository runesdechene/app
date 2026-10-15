import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Bannieres } from './Bannieres'

const mockFrom = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom } }))

const ligne = (id: number, titre: string, active: boolean) => ({
  id, image_url: `https://x/${String(id)}.png`, title: titre, subtitle: null, link_url: 'https://x', active, created_at: '',
  overlay_color: '#000000', overlay_opacity: 0.85, tag_color: '#ffffff', title_color: '#ffffff', subtitle_color: '#ffffff',
  shadow_color: '#000000', shadow_strength: 0.5,
})

function monter(insertion: { data: { id: number } | null; error: { message: string } | null } = { data: { id: 9 }, error: null }) {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [ligne(1, 'Equinoxe', true), ligne(2, 'Solstice', false)], error: null }) } }
  mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve(insertion) }) })
  mockFrom.mockReturnValue({ select: () => lecture, insert: mockInsert })
  mockEnvoyer.mockResolvedValue('https://x/neuve.png')
  mockRetirer.mockResolvedValue(undefined)
  const router = createMemoryRouter([
    { path: '/jeu/bannieres', Component: Bannieres, children: [{ path: ':id', element: <p>fiche</p> }] },
  ], { initialEntries: ['/jeu/bannieres'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => { vi.clearAllMocks() })

test('la phrase compte les actives, une carte par bannière avec Active / Inactive', async () => {
  monter()
  expect(await screen.findByText('1 actives sur 2 — tirées au hasard sur l’Accueil d’Explore.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Equinoxe/ })).toHaveAttribute('href', '/jeu/bannieres/1')
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(screen.getByText('Inactive')).toBeInTheDocument()
})

test('un fichier de 6 Mo est refusé avant l’envoi', async () => {
  monter()
  const gros = new File(['x'], 'g.png', { type: 'image/png' })
  Object.defineProperty(gros, 'size', { value: 6 * 1024 * 1024 })
  await userEvent.upload(await screen.findByLabelText('+ Nouvelle bannière'), gros)
  expect(await screen.findByRole('alert')).toHaveTextContent('Le fichier dépasse 5 Mo.')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('une nouvelle bannière naît inactive, puis sa fiche s’ouvre', async () => {
  const router = monter()
  await userEvent.upload(await screen.findByLabelText('+ Nouvelle bannière'), new File(['x'], 'a.png', { type: 'image/png' }))
  await vi.waitFor(() => { expect(router.state.location.pathname).toBe('/jeu/bannieres/9') })
  expect(mockInsert).toHaveBeenCalledWith({ image_url: 'https://x/neuve.png', title: '', link_url: '', active: false })
})

test('si l’insertion échoue, le fichier envoyé est retiré', async () => {
  monter({ data: null, error: { message: 'refusé' } })
  await userEvent.upload(await screen.findByLabelText('+ Nouvelle bannière'), new File(['x'], 'a.png', { type: 'image/png' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('refusé')
  expect(mockRetirer).toHaveBeenCalledWith('home-banners', 'https://x/neuve.png')
})
