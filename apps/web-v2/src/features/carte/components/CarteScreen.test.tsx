/**
 * QUOI     — l'écran Carte : si les lieux ne se chargent pas, la carte reste et propose de
 *            réessayer.
 * POURQUOI — MapLibre ne tourne pas dans jsdom : la fausse carte vient de `src/test/setup.ts`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { CarteScreen } from './CarteScreen'

vi.mock('../api/carte', () => ({
  fetchCarteLieux: vi.fn(() => Promise.reject(new Error('réseau'))),
  fetchLieuxEnCouleur: vi.fn(() => Promise.resolve(false)),
}))

test('si les lieux ne se chargent pas, la carte reste là et propose de réessayer', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Les lieux n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  expect(screen.getByTestId('carte')).toBeInTheDocument()
})
