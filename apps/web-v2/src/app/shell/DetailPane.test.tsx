/**
 * QUOI     — le Compte s'ouvre par l'avatar et se ferme sans jamais quitter l'app.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '../router'

vi.mock('../access/useV2Access', () => ({
  useV2Access: () => ({
    state: { status: 'ready', hasSession: true, hasAccess: true },
    retry: () => undefined,
  }),
}))

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('l’avatar ouvre le Compte par-dessus l’onglet courant', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  expect(router.state.location.pathname).toBe('/carte/compte')
  expect(screen.getByRole('heading', { name: 'Compte' })).toHaveFocus()
  expect(screen.getByText('La Carte est à venir')).toBeInTheDocument()
})

test('fermer après ouverture = retour à l’onglet', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/carte')
})

test('ouvert à froid, fermer remplace par la racine sans quitter l’app', async () => {
  const router = renderAt('/codex/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/codex')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('le retour système ferme le détail', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/accueil')
  // router.navigate agit hors du cycle de rendu de React : on attend le rendu suivant.
  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: 'Compte' })).not.toBeInTheDocument()
  })
})

test('revenir sur un onglet rouvre sa dernière adresse', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(screen.getByRole('button', { name: 'Codex' }))
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(router.state.location.pathname).toBe('/carte/compte')
})

test('le Compte déjà ouvert : l’avatar ne l’empile pas une seconde fois', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/carte')
})
