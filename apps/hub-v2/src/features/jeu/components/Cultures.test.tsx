import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Cultures } from './Cultures'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const base = { couleur: '#aa0000', icone: null, zone: null, presentation: null, cercles: [], ordre: 1 }

test('une ligne par culture : nom, complément, chiffres, « Inactive »', async () => {
  mockRpc.mockResolvedValue({
    data: [
      { ...base, id: 'nordique', label: 'Nordique', complement: 'du Nord', active: true, stock: 10, total: 40, eveils: [{ lat: 1, lng: 2 }] },
      { ...base, id: 'celtique', label: 'Celtique', complement: null, active: false, stock: 0, total: 0, eveils: [] },
    ],
    error: null,
  })
  const router = createMemoryRouter([{ path: '/jeu/cultures', Component: Cultures }], { initialEntries: ['/jeu/cultures'] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  expect(await screen.findByText('Sage du Nord')).toBeInTheDocument()
  expect(screen.getByText('10 énigmes en stock · 40 points · 1 « ? » éveillés')).toBeInTheDocument()
  expect(screen.getByText('Inactive')).toBeInTheDocument()
})
