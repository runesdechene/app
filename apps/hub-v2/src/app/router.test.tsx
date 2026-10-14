/**
 * QUOI     — le routeur monte et l'adresse inconnue renvoie à l'accueil.
 */
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './router'

test('une adresse inconnue renvoie à l’accueil', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nulle-part'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Accueil du Hub')).toBeInTheDocument()
})
