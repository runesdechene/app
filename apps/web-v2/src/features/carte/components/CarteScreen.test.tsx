/**
 * QUOI     — l'écran Carte : si les lieux ne se chargent pas, la carte reste et propose de
 *            réessayer ; sans position, « Ma position » le dit.
 * POURQUOI — MapLibre ne tourne pas dans jsdom : la fausse carte vient de `src/test/setup.ts`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { CarteScreen } from './CarteScreen'

vi.mock('../api/carte', () => ({
  fetchCarteLieux: vi.fn(() => Promise.reject(new Error('réseau'))),
  fetchLieuxEnCouleur: vi.fn(() => Promise.resolve(false)),
  fetchTerritoire: vi.fn(() => Promise.resolve({ territoire: null, pays: null })),
}))

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('si les lieux ne se chargent pas, la carte reste là et propose de réessayer', async () => {
  afficher()
  expect(await screen.findByText('Les lieux n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  expect(screen.getByTestId('carte')).toBeInTheDocument()
})

test('sans position, « Ma position » le dit sans planter', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (_ok: unknown, ko: (e: unknown) => void) => {
        ko({ code: 1 })
      },
    },
  })
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Ma position' }))
  expect(await screen.findByText('Position indisponible')).toBeInTheDocument()
  vi.unstubAllGlobals()
})
