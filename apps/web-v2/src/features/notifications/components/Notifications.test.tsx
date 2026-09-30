/**
 * QUOI     — le tiroir des Notifications : rangé par moment, chaque phrase mène au lieu (ou au
 *            Registre) ; ouvrir le tiroir marque tout lu, sans éteindre le rose de la visite.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { Notifications } from './Notifications'

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchNonLues: vi.fn(() => Promise.resolve(0)),
  marquerLues: vi.fn(() => Promise.resolve()),
  ecouterNotifications: () => () => undefined,
}))
vi.mock('../api/notifications', () => api)

const maintenant = new Date()
const ilYa = (jours: number) => new Date(maintenant.getTime() - jours * 86_400_000).toISOString()

beforeEach(() => {
  api.marquerLues.mockClear()
  api.fetchNotifications.mockResolvedValue([
    {
      id: 1,
      type: 'like_contribution',
      quand: maintenant.toISOString(),
      lu: false,
      qui: { id: 'k', nom: 'Kelpie', avatar: null },
      lieu: { id: 'l1', nom: 'Château de Jonjeac' },
      nombre: null,
      extrait: null,
      evenement: null,
    },
    {
      id: 2,
      type: 'mention',
      quand: ilYa(10),
      lu: true,
      qui: { id: 'm', nom: 'Mathéo', avatar: null },
      lieu: null,
      nombre: null,
      extrait: '@Uriel tu passes samedi ?',
      evenement: null,
    },
    {
      id: 1,
      type: 'mise_a_jour',
      quand: maintenant.toISOString(),
      lu: false,
      qui: null,
      lieu: null,
      nombre: null,
      extrait: 'Filtrer la carte',
      evenement: null,
    },
  ])
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/accueil/notifications']}>
        <Routes>
          <Route path=":tab/notifications" element={<Notifications />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('rangées par moment ; une notification mène au lieu, une mention au Registre', async () => {
  afficher()
  const aujourdhui = await screen.findByRole('region', { name: 'Aujourd’hui' })
  const coeurs = within(aujourdhui).getByRole('link', {
    name: /Kelpie a envoyé des cœurs à Château de Jonjeac/,
  })
  expect(coeurs).toHaveAttribute('href', '/accueil/lieu/l1')
  expect(within(coeurs).getByRole('img', { name: 'Non lue' })).toBeInTheDocument()
  const plusTot = screen.getByRole('region', { name: 'Plus tôt' })
  expect(within(plusTot).getByRole('link', { name: /Mathéo t’a mentionné/ })).toHaveAttribute(
    'href',
    '/messages',
  )
})

test('une mise à jour mène aux Nouveautés', async () => {
  afficher()
  const aujourdhui = await screen.findByRole('region', { name: 'Aujourd’hui' })
  expect(
    within(aujourdhui).getByRole('link', { name: /Nouveautés d’Explore : Filtrer la carte/ }),
  ).toHaveAttribute('href', '/accueil/nouveautes')
})

test('ouvrir le tiroir marque tout lu, une seule fois', async () => {
  afficher()
  await screen.findByRole('region', { name: 'Aujourd’hui' })
  await waitFor(() => {
    expect(api.marquerLues).toHaveBeenCalledTimes(1)
  })
})

test('rien de nouveau : on le dit', async () => {
  api.fetchNotifications.mockResolvedValue([])
  afficher()
  expect(await screen.findByText('Rien de nouveau pour l’instant')).toBeInTheDocument()
  expect(api.marquerLues).not.toHaveBeenCalled()
})
