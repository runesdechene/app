/**
 * QUOI     — la fiche d'une Compagnie : son bouton selon ma place, qui la mène (rôles accordés),
 *            ses lieux, « Gérer » pour le Chef et les Officiers, « Quitter » pour un membre.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheCompagnie as Fiche } from '../api/lireCompagnies'
import { FicheCompagnie } from './FicheCompagnie'

const api = vi.hoisted(() => ({
  fetchCompagnie: vi.fn(),
  rejoindre: vi.fn(() => Promise.resolve('demande' as const)),
  quitter: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/compagnies', () => api)

const FICHE: Fiche = {
  id: 'f-lys',
  nom: 'Le Lys de Fer',
  devise: 'Les forteresses de l’Est.',
  mission: 'Arpenter les forteresses du Jura aux Vosges.',
  couleur: '#5f6f86',
  avatar: null,
  privee: false,
  fondeeLe: '2026-06-12T10:00:00Z',
  roles: {
    chefM: 'Seigneur au Lys',
    chefF: 'Dame au Lys',
    officierM: 'Paladin',
    officierF: 'Paladine',
  },
  monRole: null,
  demandee: false,
  nbMembres: 3,
  membres: [
    { id: 'u1', nom: 'Uriel', avatar: null, role: 'chef', genre: 'm', niveau: 20, titre: null },
    { id: 'u2', nom: 'Luna', avatar: null, role: 'officier', genre: 'f', niveau: 15, titre: null },
    {
      id: 'u3',
      nom: 'Rémy',
      avatar: null,
      role: 'membre',
      genre: 'm',
      niveau: 11,
      titre: 'Arpenteur du Jura',
    },
  ],
  lieux: [
    {
      id: 'l1',
      nom: 'Château de Joux',
      imageUrl: 'https://exemple.test/joux.webp',
      latitude: null,
      longitude: null,
      categorie: null,
      auteur: { nom: 'Gautier', avatarUrl: null },
    },
  ],
  demandes: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

function monter(fiche: Fiche | null) {
  api.fetchCompagnie.mockResolvedValue(fiche)
  const router = createMemoryRouter(
    [{ path: '/messages/compagnie/:id', element: <FicheCompagnie id="f-lys" /> }],
    {
      initialEntries: ['/messages/compagnie/f-lys'],
    },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('la fiche : devise, mission, qui la mène avec son rôle accordé, ses lieux', async () => {
  monter(FICHE)
  expect(await screen.findByRole('heading', { name: 'Le Lys de Fer' })).toBeInTheDocument()
  expect(screen.getByText('Les forteresses de l’Est.')).toBeInTheDocument()
  expect(screen.getByText('Seigneur au Lys')).toBeInTheDocument()
  expect(screen.getByText('Paladine')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Château de Joux/ })).toHaveAttribute(
    'href',
    '/messages/lieu/l1',
  )
  expect(screen.queryByRole('link', { name: /Gérer la Compagnie/ })).not.toBeInTheDocument()
})

test('chaque membre avec son niveau et son titre, vers son profil', async () => {
  monter(FICHE)
  expect(await screen.findByRole('heading', { name: 'Les membres · 1' })).toBeInTheDocument()
  const remy = screen.getByRole('link', { name: /Rémy/ })
  expect(remy).toHaveTextContent('Niveau 11 · Arpenteur du Jura')
  expect(remy).toHaveAttribute('href', '/messages/explorateur/u3')
})

test('au-delà de huit membres, « Voir les autres » déplie le reste', async () => {
  const membres = Array.from({ length: 11 }, (_, i) => ({
    id: `m${String(i)}`,
    nom: `Membre ${String(i)}`,
    avatar: null,
    role: 'membre' as const,
    genre: 'm' as const,
    niveau: 3,
    titre: null,
  }))
  monter({ ...FICHE, membres })
  expect(await screen.findByText('Membre 7')).toBeInTheDocument()
  expect(screen.queryByText('Membre 8')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Voir les 3 autres ⌄' }))
  expect(screen.getByText('Membre 10')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Voir les/ })).not.toBeInTheDocument()
})

test('le bouton selon ma place', async () => {
  monter(FICHE)
  expect(await screen.findByRole('button', { name: 'Rejoindre la Compagnie' })).toBeEnabled()
})

test('une privée se demande ; une demande envoyée attend', async () => {
  monter({ ...FICHE, privee: true })
  await userEvent.click(await screen.findByRole('button', { name: 'Demander à rejoindre' }))
  expect(api.rejoindre).toHaveBeenCalledWith('f-lys')
})

test('une privée vue du dehors : le nombre de membres, pas leurs noms', async () => {
  monter({ ...FICHE, privee: true, membres: [] })
  expect(await screen.findByText(/3 membres/)).toBeInTheDocument()
  expect(screen.queryByText('Uriel')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Qui la mène' })).not.toBeInTheDocument()
})

test('un geste refusé le dit', async () => {
  api.rejoindre.mockRejectedValueOnce(new Error('réseau'))
  monter(FICHE)
  await userEvent.click(await screen.findByRole('button', { name: 'Rejoindre la Compagnie' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réessaie dans un instant')
})

test('une demande déjà envoyée', async () => {
  monter({ ...FICHE, privee: true, demandee: true })
  expect(await screen.findByRole('button', { name: 'Demande envoyée' })).toBeDisabled()
})

test('un membre ouvre le canal et peut quitter ; un officier gère', async () => {
  monter({ ...FICHE, monRole: 'officier' })
  expect(await screen.findByRole('link', { name: 'Ouvrir le canal' })).toHaveAttribute(
    'href',
    '/messages?canal=f-lys',
  )
  expect(screen.getByRole('link', { name: /Gérer la Compagnie/ })).toHaveAttribute(
    'href',
    '/messages/compagnie/f-lys/gerer',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Quitter la Compagnie' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Quitter' }))
  expect(api.quitter).toHaveBeenCalledWith('f-lys')
})

test('une Compagnie disparue le dit', async () => {
  monter(null)
  expect(await screen.findByText('Cette Compagnie n’existe plus.')).toBeInTheDocument()
})
