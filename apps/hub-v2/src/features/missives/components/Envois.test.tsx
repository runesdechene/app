import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Envois } from './Envois'

const mockRpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const ENVOIS = [
  { id: 3, objet: 'Pour Noël', liste: 'tous', statut: 'programmee', date: '2026-12-07T17:00:00Z', envoyes: 0, echecs: 0, ouverts: 0, clics: 0 },
  { id: 2, objet: 'Hécate est là', liste: 'porteurs', statut: 'brouillon', date: '2026-10-23T09:00:00Z', envoyes: 0, echecs: 0, ouverts: 0, clics: 0 },
  { id: 1, objet: 'Sur la route', liste: 'meilleurs', statut: 'envoyee', date: '2026-10-20T16:00:00Z', envoyes: 80, echecs: 1, ouverts: 40, clics: 9 },
]

function monter() {
  mockRpc.mockResolvedValue({ data: ENVOIS, error: null })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Envois />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('une ligne par Missive, et ce qu’il en est advenu', async () => {
  monter()
  const partie = await screen.findByRole('row', { name: /Sur la route/ })
  expect(within(partie).getByText('80')).toBeInTheDocument()
  expect(within(partie).getByText('40 · 50 %')).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(4)
})

test('une Missive programmée dit quand elle partira, à l’heure de Paris', async () => {
  monter()
  const programmee = await screen.findByRole('row', { name: /Pour Noël/ })
  expect(within(programmee).getByText('Programmée pour le 7 décembre, 18 h')).toBeInTheDocument()
})

test('un brouillon s’ouvre dans « Écrire »', async () => {
  monter()
  expect(await screen.findByRole('link', { name: 'Hécate est là' })).toHaveAttribute('href', '/missives/ecrire/2')
  expect(screen.queryByRole('link', { name: 'Sur la route' })).not.toBeInTheDocument()
})
