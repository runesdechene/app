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

test('une adresse inconnue renvoie à l’accueil', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nulle-part'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Accueil du Hub')).toBeInTheDocument()
})
