import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Titres } from './Titres'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom } }))

const ligne = (id: number, name: string, type: string, condition: object) =>
  ({ id, name, name_f: null, description: null, icon: '⚜️', type, condition, order: id })

test('trois sections ; les titres de Compagnie ne sont pas montrés, un mot les compte', async () => {
  const lecture = {
    order: () => lecture,
    then: (ok: (v: unknown) => void) => {
      ok({
        data: [
          ligne(1, 'Compagnon', 'general', { stat: 'level', min: 5 }),
          ligne(2, 'Novice', 'general', { stat: 'level', min: 1 }),
          ligne(3, 'Sage nordique', 'general', { stat: 'connaissance', theme: 'nordique', palier: 3 }),
          ligne(4, 'Polymathe', 'general', { stat: 'polymathe' }),
          ligne(5, 'Chef de Compagnie', 'faction', { stat: 'rank' }),
          ligne(6, 'Second de Compagnie', 'faction', { stat: 'rank' }),
        ],
        error: null,
      })
    },
  }
  mockFrom.mockReturnValue({ select: () => lecture })
  const router = createMemoryRouter([{ path: '/jeu/titres', Component: Titres }], { initialEntries: ['/jeu/titres'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  expect(await screen.findByRole('heading', { name: 'Les chemins' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Les connaissances' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Autres' })).toBeInTheDocument()
  // Dans un chemin, par seuil croissant.
  const noms = screen.getAllByRole('link').map((l) => l.textContent)
  expect(noms.findIndex((t) => t.includes('Novice'))).toBeLessThan(noms.findIndex((t) => t.includes('Compagnon')))
  expect(screen.queryByText(/Chef de Compagnie/)).not.toBeInTheDocument()
  expect(screen.getByText('2 titres de Compagnie de la V1 ne sont plus utilisés.')).toBeInTheDocument()
})
