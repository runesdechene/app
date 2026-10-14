import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Natures } from './Natures'

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom, rpc: mockRpc } }))

test('une ligne par nature : nom, nombre de lieux, « Hors époque »', async () => {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [
    { id: 'monts', title: 'Monts', color: '#708d44', background: '#F1FCEF', icon: null, order: 1, hors_epoque: false },
    { id: 'reves', title: 'Lieux de rêve', color: '#000000', background: '#ffffff', icon: null, order: 2, hors_epoque: true },
  ], error: null }) } }
  mockFrom.mockReturnValue({ select: () => lecture })
  mockRpc.mockResolvedValue({ data: [{ id: 'monts', nom: 'Monts', nombre: 12 }], error: null })
  const router = createMemoryRouter([{ path: '/jeu/natures', Component: Natures }], { initialEntries: ['/jeu/natures'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  expect(await screen.findByText('12 lieux')).toBeInTheDocument()
  expect(screen.getByText('0 lieu')).toBeInTheDocument()
  expect(screen.getByText('Hors époque')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '+ Nouvelle nature' })).toBeInTheDocument()
})

test('la lecture de plan 2 (autre forme, même préfixe) ne se mélange pas : la liste lit ses propres natures', async () => {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [
    { id: 'monts', title: 'Monts', color: '#708d44', background: '#F1FCEF', icon: null, order: 1, hors_epoque: false },
  ], error: null }) } }
  mockFrom.mockReturnValue({ select: () => lecture })
  mockRpc.mockResolvedValue({ data: [{ id: 'monts', nom: 'Monts', nombre: 12 }], error: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['hub-natures'], [{ id: 'monts', title: 'Monts', color: '#708d44', background: '#F1FCEF' }])
  const router = createMemoryRouter([{ path: '/jeu/natures', Component: Natures }], { initialEntries: ['/jeu/natures'] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  expect(await screen.findByText('12 lieux')).toBeInTheDocument()
})
