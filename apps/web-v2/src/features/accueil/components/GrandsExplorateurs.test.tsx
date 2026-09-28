/**
 * QUOI     — les Grands Explorateurs sur l'Accueil : les visites du mois, trois lignes, ma place,
 *            et « Voir tout le classement » qui ouvre la page du classement dans l'Accueil.
 *            La page : le choix du classement et toute la liste.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { GrandsExplorateurs } from './GrandsExplorateurs'
import { PageClassement } from './PageClassement'

const api = vi.hoisted(() => ({ fetchGrandsExplorateurs: vi.fn() }))
vi.mock('../api/accueil', () => api)

const tete = Array.from({ length: 12 }, (_, i) => ({
  rang: i + 1,
  id: `u${String(i + 1)}`,
  nom: `Explorateur ${String(i + 1)}`,
  avatar: null,
  niveau: 10,
  titre: i === 0 ? 'Chevalier errant' : null,
  lieux: 30 - i,
}))
const MOI = { id: 'moi', nom: 'Uriel', avatar: null, niveau: 12, titre: null }

beforeEach(() => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: 14, lieux: 3 },
    dixieme: 21,
  })
})

function monter(element: ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/accueil'] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('sur l’Accueil : les visites du mois, trois premiers en chiffres romains', async () => {
  monter(<GrandsExplorateurs />)
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  const lignes = within(liste).getAllByRole('listitem')
  expect(lignes).toHaveLength(3)
  expect(lignes[0]).toHaveTextContent('I')
  expect(lignes[0]).toHaveTextContent('Explorateur 1')
  expect(lignes[0]).toHaveTextContent('Chevalier errant · niveau 10')
  expect(lignes[0]).toHaveTextContent('30 lieux')
  expect(api.fetchGrandsExplorateurs).toHaveBeenCalledWith('visites', 'mois')
  expect(screen.queryByRole('radiogroup')).toBeNull()
})

test('« Voir tout le classement » ouvre la page du classement dans l’Accueil', async () => {
  const router = monter(<GrandsExplorateurs />)
  await userEvent.click(await screen.findByRole('link', { name: 'Voir tout le classement' }))
  expect(router.state.location.pathname).toBe('/accueil/classement')
})

test('ma place, hors des lignes : une ligne comme les autres, avec ce qui me manque', async () => {
  monter(<GrandsExplorateurs />)
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('XIV')
  expect(moi).toHaveTextContent('Toi')
  expect(moi).toHaveTextContent('Encore 19 lieux pour entrer dans les dix')
  expect(moi).toHaveTextContent('3 lieux')
})

test('pas encore classé : une invitation, pas un rang', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: null, lieux: 0 },
    dixieme: 21,
  })
  monter(<GrandsExplorateurs />)
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('Une visite ce mois-ci te fait entrer au classement')
})

test('dans les lignes affichées : ma ligne dit « Toi », pas de ligne en plus', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { ...MOI, rang: 2, lieux: 29 },
    dixieme: 21,
  })
  monter(<GrandsExplorateurs />)
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  const maLigne = within(liste).getAllByRole('listitem')[1]
  expect(maLigne).toHaveAttribute('data-moi')
  expect(maLigne).toHaveTextContent('Toi')
  expect(screen.queryByLabelText('Ma place')).toBeNull()
})

test('personne n’a encore marché ce mois-ci : pas de bloc sur l’Accueil', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete: [],
    moi: { ...MOI, rang: null, lieux: 0 },
    dixieme: null,
  })
  monter(<GrandsExplorateurs />)
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('list', { name: 'Les Grands Explorateurs' })).toBeNull()
})

test('la page : toute la liste, et le choix du classement', async () => {
  monter(<PageClassement />)
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  expect(within(liste).getAllByRole('listitem')).toHaveLength(12)
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('visites', 'mois')
  await userEvent.click(screen.getByRole('radio', { name: 'Ajoutés' }))
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('ajouts', 'mois')
  await userEvent.click(screen.getByRole('button', { name: 'Depuis toujours' }))
  expect(api.fetchGrandsExplorateurs).toHaveBeenLastCalledWith('ajouts', 'toujours')
})

test('la page, classement vide : une phrase, pas une liste vide', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete: [],
    moi: { ...MOI, rang: null, lieux: 0 },
    dixieme: null,
  })
  monter(<PageClassement />)
  expect(
    await screen.findByText('Personne encore ce mois-ci : à toi d’ouvrir la marche.'),
  ).toBeInTheDocument()
})
