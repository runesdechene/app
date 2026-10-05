/**
 * QUOI     — la page « Les Compagnies » : les miennes, Découvrir, la recherche, rejoindre ou demander,
 *            et « Fonder » qui mène un non-Porteur à « C'est réservé aux Porteurs ».
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ListeCompagnies } from '../api/lireCompagnies'
import { EcranFonder } from './EcranFonder'
import { PageCompagnies } from './PageCompagnies'

const api = vi.hoisted(() => ({
  fetchCompagnies: vi.fn(),
  rejoindre: vi.fn(() => Promise.resolve('membre' as const)),
}))
vi.mock('../api/compagnies', () => api)

const CARTE = {
  id: 'f-lys',
  nom: 'Le Lys de Fer',
  devise: 'Les forteresses de l’Est.',
  couleur: '#5f6f86',
  avatar: null,
  privee: false,
  membres: 35,
  role: null,
  demandee: false,
} as const

beforeEach(() => {
  vi.clearAllMocks()
})

function monter(liste: ListeCompagnies) {
  api.fetchCompagnies.mockResolvedValue(liste)
  const router = createMemoryRouter(
    [
      { path: '/compagnies', element: <PageCompagnies /> },
      { path: '/compagnies/compagnie/fonder', element: <EcranFonder /> },
    ],
    { initialEntries: ['/compagnies'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('mes Compagnies, puis Découvrir ; une privée se demande, une publique se rejoint', async () => {
  monter({
    porteur: true,
    miennes: [{ ...CARTE, role: 'chef' }],
    autres: [
      { ...CARTE, id: 'f-v', nom: 'Verte Guilde' },
      { ...CARTE, id: 'f-h', nom: 'Helvetia', privee: true },
    ],
  })
  expect(await screen.findByRole('heading', { name: 'Mes Compagnies' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Le Lys de Fer/ })).toHaveAttribute(
    'href',
    '/compagnies/compagnie/f-lys',
  )
  expect(screen.getByRole('button', { name: 'Demander à rejoindre Helvetia' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Rejoindre Verte Guilde' }))
  expect(api.rejoindre).toHaveBeenCalledWith('f-v')
})

test('une demande déjà envoyée attend', async () => {
  monter({ porteur: true, miennes: [], autres: [{ ...CARTE, privee: true, demandee: true }] })
  expect(await screen.findByRole('button', { name: 'Demande envoyée' })).toBeDisabled()
})

test('la recherche filtre par nom ou devise', async () => {
  monter({
    porteur: true,
    miennes: [],
    autres: [CARTE, { ...CARTE, id: 'f-v', nom: 'Verte Guilde', devise: 'Les cascades' }],
  })
  await userEvent.type(await screen.findByRole('searchbox'), 'cascade')
  expect(screen.queryByText('Le Lys de Fer')).not.toBeInTheDocument()
  expect(screen.getByText('Verte Guilde')).toBeInTheDocument()
})

test('un non-Porteur qui veut fonder lit pourquoi, et peut aller à la boutique', async () => {
  monter({ porteur: false, miennes: [], autres: [] })
  await userEvent.click(await screen.findByRole('link', { name: /Fonder une Compagnie/ }))
  expect(await screen.findByText('C’est réservé aux Porteurs')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Découvrir la boutique/ })).toHaveAttribute(
    'href',
    'https://runesdechene.com',
  )
})
