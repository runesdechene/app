import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { RouteScan } from './scan'

const moi = vi.hoisted(() => ({ fetchMoi: vi.fn() }))
vi.mock('@/features/lieu/api/lieu', () => moi)
vi.mock('@/features/vitrine/hooks/useVitrine', () => ({ useConnecte: () => true }))
vi.mock('@/features/scan/components/ScanScreen', () => ({ ScanScreen: () => <p>Le scanner</p> }))

function monter() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Accueil</p> },
      { path: '/scan', Component: RouteScan },
    ],
    { initialEntries: ['/scan'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('le scanner est ouvert à tous, même sans session', async () => {
  moi.fetchMoi.mockRejectedValue(new Error('sans session'))
  const router = monter()
  expect(await screen.findByText('Le scanner')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/scan')
})
