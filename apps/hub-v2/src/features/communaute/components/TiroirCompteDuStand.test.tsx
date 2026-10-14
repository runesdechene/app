import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirCompteDuStand } from './TiroirCompteDuStand'

const creer = vi.hoisted(() => vi.fn())
vi.mock('../api/compteDuStand', () => ({ creerCompteDuStand: creer }))

beforeEach(() => { vi.clearAllMocks() })

function monter() {
  const router = createMemoryRouter(
    [{ path: '/communaute/comptes/nouveau', Component: TiroirCompteDuStand }, { path: '/communaute/comptes/:id', element: <p>La fiche</p> }],
    { initialEntries: ['/communaute/comptes/nouveau'] },
  )
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
}

test('sans e-mail valide : un message, aucun appel', async () => {
  monter()
  await userEvent.type(screen.getByLabelText('E-mail'), 'pas-un-mail')
  await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
  expect(screen.getByText('Une adresse e-mail est nécessaire.')).toBeInTheDocument()
  expect(creer).not.toHaveBeenCalled()
})

test('un envoi réussi ouvre la fiche ; la newsletter part décochée', async () => {
  creer.mockResolvedValue('shopify-42')
  monter()
  expect(screen.getByRole('checkbox', { name: /newsletter/ })).not.toBeChecked()
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
  expect(creer).toHaveBeenCalledWith({ email: 'a@b.fr', prenom: '', newsletter: false })
  expect(await screen.findByText('La fiche')).toBeInTheDocument()
})

test('l’erreur de la fonction s’affiche sous le formulaire', async () => {
  creer.mockRejectedValue(new Error('Shopify not connected'))
  monter()
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Shopify not connected')
})
