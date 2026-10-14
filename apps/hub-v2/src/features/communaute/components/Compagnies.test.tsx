import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Compagnies } from './Compagnies'
import { TiroirCompagnie } from './TiroirCompagnie'

const api = vi.hoisted(() => ({ lireCompagnies: vi.fn(), lireCompagnie: vi.fn(), modifierCompagnie: vi.fn() }))
vi.mock('../api/compagnies', () => api)

const cairns = { id: 'cairns', nom: 'Compagnie des Cairns', couleur: '#46493c', devise: 'Pierre sur pierre', privee: false, retiree: false, membres: 12, chef: 'Ombre', fondee: '2026-06-24T10:00:00Z' }

function monter(adresse: string) {
  const router = createMemoryRouter(
    [{ path: '/communaute/compagnies', Component: Compagnies, children: [{ path: ':id', Component: TiroirCompagnie }] }],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

test('la liste des Compagnies', async () => {
  api.lireCompagnies.mockResolvedValue([cairns, { ...cairns, id: 'old', nom: 'Les Anciens', retiree: true, membres: 0, chef: null }])
  monter('/communaute/compagnies')
  expect(await screen.findByRole('link', { name: /Compagnie des Cairns/ })).toHaveAttribute('href', '/communaute/compagnies/cairns')
  expect(screen.getByText('Retirée')).toBeInTheDocument()
})

test('un nom pris : le message s’affiche, la saisie reste', async () => {
  api.lireCompagnies.mockResolvedValue([cairns])
  api.lireCompagnie.mockResolvedValue({ ...cairns, mission: 'Bâtir.', avatar: null, membres: [] })
  api.modifierCompagnie.mockRejectedValue(new Error('Ce nom est déjà pris'))
  monter('/communaute/compagnies/cairns')
  const nom = await screen.findByRole('textbox', { name: 'Nom' })
  await userEvent.clear(nom)
  await userEvent.type(nom, 'Les Veilleurs')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Ce nom est déjà pris')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Les Veilleurs')
})

test('une couleur invalide est refusée avant d’envoyer', async () => {
  api.lireCompagnies.mockResolvedValue([cairns])
  api.lireCompagnie.mockResolvedValue({ ...cairns, mission: '', avatar: null, membres: [] })
  monter('/communaute/compagnies/cairns')
  const couleur = await screen.findByRole('textbox', { name: 'Couleur' })
  await userEvent.clear(couleur)
  await userEvent.type(couleur, 'rouge')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(screen.getByText('La couleur est un code #RRGGBB')).toBeInTheDocument()
  expect(api.modifierCompagnie).not.toHaveBeenCalled()
})

test('ouvrir une fiche garde l’adresse de la liste, la fermer y ramène', async () => {
  api.lireCompagnies.mockResolvedValue([cairns])
  api.lireCompagnie.mockResolvedValue(null)
  const router = monter('/communaute/compagnies?filtre=porteurs&page=3')
  await userEvent.click(await screen.findByRole('link', { name: /Compagnie des Cairns/ }))
  expect(router.state.location.pathname).toBe('/communaute/compagnies/cairns')
  expect(router.state.location.search).toBe('?filtre=porteurs&page=3')
  await userEvent.click(await screen.findByRole('link', { name: '✕ Fermer' }))
  expect(router.state.location.pathname).toBe('/communaute/compagnies')
  expect(router.state.location.search).toBe('?filtre=porteurs&page=3')
})
