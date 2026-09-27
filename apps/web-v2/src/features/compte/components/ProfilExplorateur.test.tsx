/**
 * QUOI     — le profil public : le sien (« Modifier mon profil »), celui d'un autre (« Envoyer un
 *            murmure »), des envies masquées, un Explorateur introuvable.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '../api/lireProfil'
import { ProfilExplorateur } from './ProfilExplorateur'

const fetchExplorateur = vi.hoisted(() =>
  vi.fn<(id: string) => Promise<ExplorateurProfile | null>>(),
)
vi.mock('../api/explorateur', () => ({ fetchExplorateur }))

const PROFIL: ExplorateurProfile = {
  id: 'u1',
  nom: 'Uriel',
  avatarUrl: null,
  niveau: 12,
  titres: [{ id: 1, nom: 'Chevalier errant' }],
  bio: 'Fondateur de @runesdechene',
  instagram: 'uriel.runesdechene',
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: true,
  role: 'admin',
  attache: 'Noble représentant des Alpes-Maritimes',
  fragments: [{ id: 3, nom: 'Hoplite', imageUrl: null }],
  ajoutes: [{ id: 'p1', nom: 'Dolmen de la Pierre Levée', imageUrl: null }],
  visites: [{ id: 'p2', nom: 'Abbaye du Thoronet', imageUrl: null }],
  envies: [{ id: 'p3', nom: 'Mont Bégo', imageUrl: null }],
  estMoi: true,
}

function afficher(profil: ExplorateurProfile | null) {
  fetchExplorateur.mockResolvedValue(profil)
  const router = createMemoryRouter(
    [{ path: '/:tab/explorateur/:id', element: <ProfilExplorateur id="u1" /> }],
    { initialEntries: ['/carte/explorateur/u1'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('mon profil : « Modifier mon profil », jamais de murmure', async () => {
  afficher(PROFIL)
  expect(await screen.findByRole('button', { name: 'Modifier mon profil' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /murmure/ })).toBeNull()
})

test('le profil d’un autre : « Envoyer un murmure », jamais « Modifier »', async () => {
  afficher({ ...PROFIL, estMoi: false })
  expect(await screen.findByRole('button', { name: /Envoyer un murmure/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Modifier mon profil' })).toBeNull()
})

test('l’en-tête dit qui il est', async () => {
  afficher(PROFIL)
  expect(await screen.findByText('Uriel')).toBeInTheDocument()
  expect(screen.getByText('Niveau 12')).toBeInTheDocument()
  expect(screen.getByText('Chevalier errant')).toBeInTheDocument()
  expect(screen.getByText('Noble représentant des Alpes-Maritimes')).toBeInTheDocument()
  expect(screen.getByText('Explorateur depuis le 30 septembre 2024')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '@runesdechene' })).toHaveAttribute(
    'href',
    'https://www.instagram.com/runesdechene/',
  )
})

test('le badge Porteur vérifié s’explique au toucher', async () => {
  afficher(PROFIL)
  await userEvent.click(await screen.findByRole('button', { name: /Porteur vérifié/ }))
  expect(screen.getByRole('dialog', { name: 'Porteur vérifié' })).toHaveTextContent('client')
})

test('envies masquées : pas d’onglet « Envie d’y aller » du tout', async () => {
  afficher({ ...PROFIL, estMoi: false, envies: null })
  await screen.findByRole('tab', { name: /Ajoutés/ })
  expect(screen.queryByRole('tab', { name: /Envie d’y aller/ })).toBeNull()
})

test('changer d’onglet change la grille', async () => {
  afficher(PROFIL)
  expect(await screen.findByText('Dolmen de la Pierre Levée')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /Visités/ }))
  expect(screen.getByText('Abbaye du Thoronet')).toBeInTheDocument()
  expect(screen.queryByText('Dolmen de la Pierre Levée')).toBeNull()
})

test('Explorateur introuvable : un message, jamais un écran vide', async () => {
  afficher(null)
  expect(await screen.findByText('Cet Explorateur est introuvable')).toBeInTheDocument()
})
