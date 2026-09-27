/**
 * QUOI     — l'avatar ouvre le menu ; le menu ouvre le profil ; tout se ferme sans jamais
 *            quitter l'app, et le retour ne rouvre jamais le menu.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '@/features/compte/api/lireProfil'
import { routes } from '../router'

vi.mock('../access/useV2Access', () => ({
  useV2Access: () => ({
    state: { status: 'ready', hasSession: true, hasAccess: true },
    retry: () => undefined,
  }),
}))

vi.mock('@/features/compte/api/session', () => ({
  monIdentifiant: () => Promise.resolve('u1'),
  seDeconnecter: () => Promise.resolve(),
}))

vi.mock('@/features/compte/api/monProfil', () => ({
  titresDebloques: () => Promise.resolve([]),
  choisirSigne: () => Promise.resolve(),
}))
vi.mock('@/features/compte/api/preferences', () => ({
  mesPreferences: () => Promise.resolve({ titleGender: 'm' }),
}))

const profil = (id: string): ExplorateurProfile => ({
  id,
  nom: id === 'u1' ? 'Uriel' : 'Claire',
  avatarUrl: null,
  niveau: 3,
  titres: [],
  bio: null,
  instagram: null,
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: false,
  role: null,
  attache: null,
  fragments: [],
  ajoutes: [],
  visites: [],
  envies: [],
  signe: null,
  estMoi: id === 'u1',
})
vi.mock('@/features/compte/api/explorateur', () => ({
  fetchExplorateur: (id: string) => Promise.resolve(profil(id)),
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

async function ouvrirMonProfil(router: ReturnType<typeof renderAt>) {
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(await screen.findByRole('button', { name: /Mon profil/ }))
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte/explorateur/u1')
  })
}

test('l’avatar ouvre le menu par-dessus l’onglet courant', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  expect(router.state.location.pathname).toBe('/carte/menu')
  expect(screen.getByRole('dialog', { name: 'Mon compte' })).toBeInTheDocument()
  expect(screen.getByText('La Carte est à venir')).toBeInTheDocument()
})

test('Mon profil : le détail s’ouvre, titré « Mon profil »', async () => {
  const router = renderAt('/carte')
  await ouvrirMonProfil(router)
  expect(await screen.findByRole('heading', { name: 'Mon profil' })).toHaveFocus()
})

test('fermer mon profil ramène à l’onglet, pas au menu', async () => {
  const router = renderAt('/carte')
  await ouvrirMonProfil(router)
  await userEvent.click(await screen.findByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/carte')
})

test('le profil d’un autre s’intitule « Profil »', async () => {
  renderAt('/carte/explorateur/u2')
  expect(await screen.findByRole('heading', { name: 'Profil' })).toBeInTheDocument()
  expect(await screen.findByText('Claire')).toBeInTheDocument()
})

test('ouvert à froid, fermer remplace par la racine sans quitter l’app', async () => {
  const router = renderAt('/codex/explorateur/u2')
  await userEvent.click(await screen.findByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/codex')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('le retour système ferme le menu', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/accueil')
  // router.navigate agit hors du cycle de rendu de React : on attend le rendu suivant.
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Mon compte' })).not.toBeInTheDocument()
  })
})

test('le menu déjà ouvert : l’avatar ne l’empile pas une seconde fois', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/carte')
})

test('revenir sur un onglet rouvre sa dernière adresse', async () => {
  const router = renderAt('/carte')
  await ouvrirMonProfil(router)
  await userEvent.click(screen.getByRole('button', { name: 'Codex' }))
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(router.state.location.pathname).toBe('/carte/explorateur/u1')
})

test('fermer le menu rend le focus à l’avatar', async () => {
  renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await screen.findByRole('dialog', { name: 'Mon compte' })
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Mon compte' })).toHaveFocus()
  })
})

test('/modifier d’un autre : redirigé vers son profil, jamais le formulaire', async () => {
  const router = renderAt('/carte/explorateur/u2/modifier')
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/carte/explorateur/u2')
  })
  expect(screen.queryByRole('heading', { name: 'Modifier mon profil' })).toBeNull()
})

test('/modifier de mon profil : le formulaire', async () => {
  renderAt('/carte/explorateur/u1/modifier')
  expect(await screen.findByRole('heading', { name: 'Modifier mon profil' })).toBeInTheDocument()
})

test('Préférences s’ouvre depuis le menu, et le retour ramène à l’onglet', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Mon compte' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Préférences' }))
  expect(await screen.findByRole('heading', { name: 'Préférences' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/carte')
})
