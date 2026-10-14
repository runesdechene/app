import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { vi } from 'vitest'
import { TiroirEnigme } from './TiroirEnigme'

const mockEnregistrer = vi.hoisted(() => vi.fn())
const mockLireEnigme = vi.hoisted(() => vi.fn())
vi.mock('../api/enigmes', async (orig) => ({
  ...(await orig<typeof import('../api/enigmes')>()),
  enregistrerEnigme: mockEnregistrer,
  lireEnigme: mockLireEnigme,
  lireCultures: () => Promise.resolve([{ id: 'nordique', label: 'Nordique', active: true }]),
}))

function Adresse() {
  const { pathname, search } = useLocation()
  return <><p data-testid="adresse">{pathname + search}</p><Outlet /></>
}

function monter(adresse: string) {
  const router = createMemoryRouter(
    [
      { path: '/jeu/enigmes', element: <Adresse />, children: [
        { path: 'nouvelle', Component: TiroirEnigme }, { path: ':id', Component: TiroirEnigme },
      ] },
    ],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
}

const fiche = {
  id: 7, culture: null, difficulte: 'medium', recit: 'Au nord', question: 'Qui ?', format: 'qcm', choix: ['Odin', 'Thor'],
  reponse: 'Thor', variantes: [], explication: 'Parce que.', active: true, cree_le: '2026-10-01T00:00:00Z',
  reponses: 12, percees: 8, signalements: 1,
}

async function remplirUnQcm(reponse: string) {
  await userEvent.type(screen.getByLabelText('Question'), 'Qui porte le marteau ?')
  await userEvent.type(screen.getByLabelText('Choix 1'), 'Odin')
  await userEvent.type(screen.getByLabelText('Choix 2'), 'Thor')
  await userEvent.type(screen.getByLabelText('Réponse'), reponse)
}

beforeEach(() => { vi.clearAllMocks() })

test('une QCM dont la réponse n’est pas un choix : le message, rien n’est envoyé', async () => {
  monter('/jeu/enigmes/nouvelle')
  await remplirUnQcm('Loki')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('La réponse doit être l’un des choix')).toBeInTheDocument()
  expect(mockEnregistrer).not.toHaveBeenCalled()
})

test('une création valide : enregistrerEnigme(null, …) puis l’adresse devient celle de la fiche, recherche gardée', async () => {
  mockEnregistrer.mockResolvedValue(42)
  monter('/jeu/enigmes/nouvelle?q=marteau')
  await remplirUnQcm('Thor')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => { expect(screen.getByTestId('adresse')).toHaveTextContent('/jeu/enigmes/42?q=marteau') })
  expect(mockEnregistrer).toHaveBeenCalledWith(null, expect.objectContaining({ question: 'Qui porte le marteau ?', choix: ['Odin', 'Thor'], reponse: 'Thor', culture: null }))
})

test('l’erreur de la base s’affiche', async () => {
  mockEnregistrer.mockRejectedValue(new Error('Réservé à l’équipe'))
  monter('/jeu/enigmes/nouvelle')
  await remplirUnQcm('Thor')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réservé à l’équipe')
})

test('une fiche existante : champs remplis, compteurs, « Enregistré. » puis effacé à la frappe', async () => {
  mockLireEnigme.mockResolvedValue(fiche)
  mockEnregistrer.mockResolvedValue(7)
  monter('/jeu/enigmes/7?q=x')
  expect(await screen.findByDisplayValue('Qui ?')).toBeInTheDocument()
  expect(screen.getByText('12 réponses · 8 percées · 1 signalement')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '✕ Fermer' })).toHaveAttribute('href', '/jeu/enigmes?q=x')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(mockEnregistrer).toHaveBeenCalledWith(7, expect.objectContaining({ reponse: 'Thor' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Explication'), '!')
  expect(screen.queryByText('Enregistré.')).not.toBeInTheDocument()
})

test('une énigme inconnue : « Énigme introuvable » et un lien vers la liste', async () => {
  mockLireEnigme.mockResolvedValue(null)
  monter('/jeu/enigmes/999')
  expect(await screen.findByText('Énigme introuvable.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la liste' })).toHaveAttribute('href', '/jeu/enigmes')
})
