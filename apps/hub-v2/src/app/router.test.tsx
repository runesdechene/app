/**
 * QUOI     — le routeur monte et l'adresse inconnue renvoie à l'accueil.
 */
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from './router'

vi.mock('./entree/PorteDEntree', () => ({
  PorteDEntree: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/features/accueil/hooks/useOuverture', () => ({
  useOuverture: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}))

vi.mock('@/features/accueil/hooks/useSanteBoutique', () => ({
  useSanteBoutique: () => ({ shopify: undefined, shopifyErreur: null, fiches: undefined }),
}))

vi.mock('@/features/accueil/hooks/useFil', () => ({
  useFil: () => ({ activites: [], voirPlus: vi.fn(), aDAutres: false, isError: false }),
}))

test('une adresse inconnue renvoie à l’accueil', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nulle-part'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Bonjour Uriel')).toBeInTheDocument()
})

vi.mock('@/features/communaute/hooks/useComptes', () => ({
  useComptes: () => ({ data: undefined, isError: false }),
  exporterComptes: vi.fn(),
}))

test('/communaute/comptes ouvre l’écran des comptes, pas « bientôt »', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/communaute/comptes'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByRole('heading', { name: 'Les comptes' })).toBeInTheDocument()
})
