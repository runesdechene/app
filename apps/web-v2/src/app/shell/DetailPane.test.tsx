/**
 * QUOI     — les détails s'ouvrent par-dessus l'onglet et se ferment sans jamais quitter l'app ;
 *            l'onglet Compte montre mon profil, Préférences et Déconnexion.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '@/features/compte/api/lireProfil'
import { routes } from '../router'
import { DetailPane } from './DetailPane'

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
vi.mock('@/features/compte/api/passeport', () => ({
  fetchPasseport: () => Promise.resolve(null),
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
  nbVisites: 0,
  envies: [],
  signe: null,
  fragmentsADecouvrir: null,
  compagnies: [],
  connaissances: [],
  polymathe: null,
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

test('l’onglet Compte montre mon profil', async () => {
  renderAt('/compte')
  expect(await screen.findByText('Uriel')).toBeInTheDocument()
  // Préférences et la sortie sont dans le menu du profil (07/10), plus sur la page.
  expect(screen.queryByRole('navigation', { name: 'Mon compte' })).toBeNull()
})

test('le profil d’un autre s’intitule « Profil »', async () => {
  renderAt('/carte/explorateur/u2')
  expect(await screen.findByRole('heading', { name: 'Profil' })).toBeInTheDocument()
  expect(await screen.findByText('Claire')).toBeInTheDocument()
})

test('ouvert à froid, fermer remplace par la racine sans quitter l’app', async () => {
  const router = renderAt('/messages/explorateur/u2')
  await userEvent.click(await screen.findByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/messages')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('le retour système ferme la feuille « Ajouter »', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un lieu' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/carte')
  // router.navigate agit hors du cycle de rendu de React : on attend le rendu suivant.
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Ajouter sur la carte' })).not.toBeInTheDocument()
  })
})

test('la feuille déjà ouverte : « Ajouter » ne l’empile pas une seconde fois', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un lieu' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter un lieu' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/carte')
})

test('revenir sur un onglet rouvre sa dernière adresse', async () => {
  const router = renderAt('/carte/explorateur/u2')
  await screen.findByText('Claire')
  await userEvent.click(screen.getByRole('button', { name: 'Messages' }))
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(router.state.location.pathname).toBe('/carte/explorateur/u2')
})

test('fermer la feuille rend le focus au bouton qui l’a ouverte', async () => {
  renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un lieu' }))
  await screen.findByRole('dialog', { name: 'Ajouter sur la carte' })
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Ajouter un lieu' })).toHaveFocus()
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

test('Préférences s’ouvre depuis le menu du profil, et fermer ramène à Compte', async () => {
  const router = renderAt('/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Compte' }))
  await userEvent.click(
    within(await screen.findByRole('dialog', { name: 'Mon menu' })).getByRole('button', {
      name: /Préférences/,
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Préférences' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(router.state.location.pathname).toBe('/compte')
})

test('sur une image (la fiche d’un lieu) : la flèche est posée sur la photo, le titre reste pour les lecteurs d’écran', () => {
  render(
    <MemoryRouter>
      <DetailPane title="Château de Jonjeac" surImage>
        <p>contenu</p>
      </DetailPane>
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  const titre = screen.getByRole('heading', { name: 'Château de Jonjeac' })
  expect(titre.className).toMatch(/masque/)
  expect(screen.getByRole('complementary').className).toMatch(/surImage/)
})
