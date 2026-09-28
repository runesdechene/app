/**
 * QUOI     — les Grands Explorateurs : cinq d'abord, puis les dix sur demande ; ma place
 *            toujours visible, avec ce qui me manque ; le choix du classement (visités ou
 *            ajoutés, ce mois-ci ou depuis toujours).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { GrandsExplorateurs } from './GrandsExplorateurs'

const api = vi.hoisted(() => ({ fetchGrandsExplorateurs: vi.fn() }))
vi.mock('../api/accueil', () => api)

const tete = Array.from({ length: 10 }, (_, i) => ({
  rang: i + 1,
  id: `u${String(i + 1)}`,
  nom: `Explorateur ${String(i + 1)}`,
  avatar: null,
  niveau: 10,
  titre: i === 0 ? 'Chevalier errant' : null,
  lieux: 20 - i,
}))
const MOI = { id: 'moi', nom: 'Uriel', avatar: null, niveau: 12, titre: null }

beforeEach(() => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: 14, lieux: 3 },
    dixieme: 11,
  })
})

function monter() {
  const router = createMemoryRouter([{ path: '*', element: <GrandsExplorateurs /> }], {
    initialEntries: ['/accueil'],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('cinq premiers en chiffres romains ; « Voir tout le classement » montre les dix', async () => {
  monter()
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  const lignes = within(liste).getAllByRole('listitem')
  expect(lignes).toHaveLength(5)
  expect(lignes[0]).toHaveTextContent('I')
  expect(lignes[0]).toHaveTextContent('Explorateur 1')
  expect(lignes[0]).toHaveTextContent('Chevalier errant · niveau 10')
  expect(lignes[0]).toHaveTextContent('20 lieux')
  await userEvent.click(screen.getByRole('button', { name: 'Voir tout le classement' }))
  expect(within(liste).getAllByRole('listitem')).toHaveLength(10)
})

test('ma place, hors des cinq : une ligne comme les autres, avec ce qui me manque', async () => {
  monter()
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('XIV')
  expect(moi).toHaveTextContent('Toi')
  expect(moi).toHaveTextContent('Encore 9 lieux pour entrer dans les dix')
  expect(moi).toHaveTextContent('3 lieux')
})

test('pas encore classé : une invitation, pas un rang', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: null, lieux: 0 },
    dixieme: 11,
  })
  monter()
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('Une visite ce mois-ci te fait entrer au classement')
})

test('dans les cinq premiers : ma ligne dit « Toi », pas de ligne en plus', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: 2, lieux: 19 },
    dixieme: 11,
  })
  monter()
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  const maLigne = within(liste).getAllByRole('listitem')[1]
  expect(maLigne).toHaveAttribute('data-moi')
  expect(maLigne).toHaveTextContent('Toi')
  expect(screen.queryByLabelText('Ma place')).toBeNull()
})

test('on choisit le classement : les lieux ajoutés, depuis toujours', async () => {
  monter()
  await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('visites', 'mois')
  await userEvent.click(screen.getByRole('radio', { name: 'Ajoutés' }))
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('ajouts', 'mois')
  await userEvent.click(screen.getByRole('button', { name: 'Depuis toujours' }))
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('ajouts', 'toujours')
})

test('personne encore ce mois-ci : une phrase, pas un bloc vide', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete: [],
    moi: { ...MOI, rang: null, lieux: 0 },
    dixieme: null,
  })
  monter()
  expect(
    await screen.findByText('Personne encore ce mois-ci : à toi d’ouvrir la marche.'),
  ).toBeInTheDocument()
})
