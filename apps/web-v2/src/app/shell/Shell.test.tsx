/**
 * QUOI     — la coquille navigue par URL et garde les quatre écrans montés.
 * POURQUOI — c'est la promesse centrale de la navigation (spec socle §4bis).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
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

// L'Accueil lit la base : une nouveauté suffit à le reconnaître.
vi.mock('@/features/accueil/api/accueil', () => ({
  fetchNouveaute: () => Promise.resolve({ titre: 'La loutre', image: null, lien: null }),
  fetchAjoutes: () => Promise.resolve([]),
  fetchChemins: () => Promise.resolve([]),
  saluer: () => Promise.resolve({ saluts: 0, salue: false }),
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

test('/ redirige vers l’Accueil', async () => {
  const router = renderAt('/')
  expect(await screen.findByText('La loutre')).toBeVisible()
  expect(router.state.location.pathname).toBe('/accueil')
})

test('un onglet inconnu redirige vers l’Accueil', async () => {
  const router = renderAt('/nimporte')
  await screen.findByText('La loutre')
  expect(router.state.location.pathname).toBe('/accueil')
})

test('changer d’onglet affiche le nouvel écran et garde l’ancien monté', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Carte' }))
  expect(router.state.location.pathname).toBe('/carte')
  expect(screen.getByTestId('carte')).toBeVisible()
  expect(screen.getByText('La loutre')).not.toBeVisible()
  expect(screen.getByText('La loutre')).toBeInTheDocument()
})

test('changer d’onglet ajoute une entrée : le retour ramène à l’onglet précédent', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Messages' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/accueil')
})

test('l’onglet actif est annoncé', async () => {
  renderAt('/messages')
  expect(await screen.findByRole('button', { name: 'Messages' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('un lien « Revenir V1 » est toujours visible pendant la construction', async () => {
  renderAt('/messages')
  expect(await screen.findByRole('link', { name: 'Revenir V1' })).toHaveAttribute('href', '/')
})

test('une barre oblique finale n’ouvre pas de détail', async () => {
  renderAt('/carte/')
  await screen.findByTestId('carte')
  expect(document.querySelector('[data-detail]')).toBeNull()
})

test('l’en-tête porte « Ajouter » et « Notifications », la barre porte le Compte', async () => {
  renderAt('/carte')
  expect(await screen.findByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Compte/ })).toBeInTheDocument()
})

test('« Ajouter » ouvre la feuille par-dessus l’onglet courant', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter' }))
  expect(router.state.location.pathname).toBe('/carte/ajouter')
  expect(await screen.findByRole('dialog', { name: 'Ajouter sur la carte' })).toBeInTheDocument()
})

test('sur l’Accueil, la carte reste montée derrière le tiroir (desktop)', async () => {
  renderAt('/accueil')
  await screen.findByText('La loutre')
  const carte = screen.getByRole('region', { name: 'Carte' })
  expect(carte).not.toHaveAttribute('hidden')
  expect(carte).toHaveAttribute('data-derriere')
  expect(document.querySelector('[data-ecran="messages"]')).toHaveAttribute('hidden')
})

function coquille() {
  const element = document.querySelector('main')?.parentElement
  if (!element) throw new Error('pas de coquille')
  return element
}

test('replier le panneau le masque sans changer d’adresse, et on peut le déplier', async () => {
  const router = renderAt('/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Replier le panneau' }))
  expect(router.state.location.pathname).toBe('/compte')
  expect(coquille()).not.toHaveAttribute('data-tiroir')
  await userEvent.click(screen.getByRole('button', { name: 'Déplier le panneau' }))
  expect(coquille()).toHaveAttribute('data-tiroir', 'open')
})

test('toucher un onglet déplie le panneau, même l’onglet déjà ouvert', async () => {
  renderAt('/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Replier le panneau' }))
  await userEvent.click(screen.getByRole('button', { name: 'Compte' }))
  expect(coquille()).toHaveAttribute('data-tiroir', 'open')
})

test('sur la Carte, déplier rouvre le dernier onglet du tiroir', async () => {
  const router = renderAt('/messages')
  await userEvent.click(await screen.findByRole('button', { name: 'Carte' }))
  expect(coquille()).not.toHaveAttribute('data-tiroir')
  await userEvent.click(screen.getByRole('button', { name: 'Déplier le panneau' }))
  expect(router.state.location.pathname).toBe('/messages')
})

function curseur() {
  return screen
    .getByRole('navigation', { name: 'Navigation principale' })
    .querySelector('[style*="--rang"]')
}

test('sur PC, le fond de l’onglet actif glisse d’un onglet à l’autre (Carte exclue)', async () => {
  renderAt('/messages')
  await screen.findByRole('button', { name: 'Messages' })
  expect(curseur()?.getAttribute('style')).toContain('--rang: 1')
  await userEvent.click(screen.getByRole('button', { name: 'Compte' }))
  expect(curseur()?.getAttribute('style')).toContain('--rang: 2')
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(curseur()).toBeNull()
})

test('sur PC, Préférences et Déconnexion sont dans la barre, sous la cloche', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Préférences' }))
  expect(router.state.location.pathname).toBe('/carte/preferences')
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
})
