import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Coquille } from './Coquille'

vi.mock('./useAttente', () => ({
  useAttente: () => ({ photos: 12, lieux: 0, signalementsLieu: 2, signalementsEnigme: 1, achats: 4 }),
}))

function monter(adresse: string) {
  const router = createMemoryRouter(
    [{ path: '/', Component: Coquille, children: [{ path: '*', element: <p>Écran</p> }, { index: true, element: <p>Écran</p> }] }],
    { initialEntries: [adresse] },
  )
  render(<RouterProvider router={router} />)
}

test('le lien de l’écran ouvert est marqué', () => {
  monter('/communaute/comptes')
  expect(screen.getAllByRole('link', { name: 'Comptes' })[0]).toHaveAttribute('aria-current', 'page')
})

test('une file non vide montre sa pastille, une file vide n’en montre pas', () => {
  monter('/')
  expect(screen.getAllByRole('link', { name: /Photos et avis/ })[0]).toHaveTextContent('12')
  expect(screen.getAllByRole('link', { name: /Lieux à modérer/ })[0]).not.toHaveTextContent('0')
})
