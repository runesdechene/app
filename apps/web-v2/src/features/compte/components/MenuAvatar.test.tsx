/**
 * QUOI     — le menu avatar : Mon profil, Préférences, Déconnexion.
 * POURQUOI — « Mon profil » et « Préférences » REMPLACENT le menu dans l'historique : le retour
 *            depuis le profil ramène à l'onglet, pas au menu.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { MenuAvatar } from './MenuAvatar'

const session = vi.hoisted(() => ({
  monIdentifiant: vi.fn(() => Promise.resolve('u1')),
  seDeconnecter: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/session', () => session)
vi.mock('../api/explorateur', () => ({ fetchExplorateur: () => Promise.resolve(null) }))

function ouvrir(onFermer = vi.fn()) {
  const router = createMemoryRouter(
    [
      { path: '/:tab', element: null },
      { path: '/:tab/menu', element: <MenuAvatar onFermer={onFermer} /> },
      { path: '/:tab/explorateur/:id', element: <p>profil</p> },
      { path: '/:tab/preferences', element: <p>préférences</p> },
    ],
    { initialEntries: ['/carte', '/carte/menu'], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, onFermer }
}

test('Mon profil remplace le menu par mon profil', async () => {
  const { router } = ouvrir()
  await userEvent.click(await screen.findByRole('button', { name: /Mon profil/ }))
  expect(router.state.location.pathname).toBe('/carte/explorateur/u1')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('Préférences remplace le menu par les préférences', async () => {
  const { router } = ouvrir()
  await userEvent.click(await screen.findByRole('button', { name: 'Préférences' }))
  expect(router.state.location.pathname).toBe('/carte/preferences')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('Déconnexion déconnecte', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }))
  expect(session.seDeconnecter).toHaveBeenCalledOnce()
})

test('Échap ferme le menu', async () => {
  const { onFermer } = ouvrir()
  await screen.findByRole('dialog', { name: 'Mon compte' })
  await userEvent.keyboard('{Escape}')
  expect(onFermer).toHaveBeenCalled()
})
