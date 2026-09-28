/**
 * QUOI     — les Grands Explorateurs : les trois premiers, puis les dix sur demande ; ma place
 *            toujours visible, avec ce qui me manque pour entrer dans les dix.
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

beforeEach(() => {
  api.fetchGrandsExplorateurs.mockResolvedValue({ tete, moi: { rang: 14, lieux: 3 }, dixieme: 11 })
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

test('les trois premiers en chiffres romains ; « Voir tout le classement » montre les dix', async () => {
  monter()
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  const lignes = within(liste).getAllByRole('listitem')
  expect(lignes).toHaveLength(3)
  expect(lignes[0]).toHaveTextContent('I')
  expect(lignes[0]).toHaveTextContent('Explorateur 1')
  expect(lignes[0]).toHaveTextContent('Chevalier errant · niveau 10')
  expect(lignes[0]).toHaveTextContent('20 lieux')
  await userEvent.click(screen.getByRole('button', { name: 'Voir tout le classement' }))
  expect(within(liste).getAllByRole('listitem')).toHaveLength(10)
})

test('ma place, hors des dix : mon rang et ce qui me manque', async () => {
  monter()
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('XIV')
  expect(moi).toHaveTextContent('Toi')
  expect(moi).toHaveTextContent('Encore 9 lieux pour entrer dans les dix')
  expect(moi).toHaveTextContent('3 lieux')
})

test('pas encore de lieu ce mois-ci : une invitation, pas un rang', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({ tete, moi: null, dixieme: 11 })
  monter()
  const moi = await screen.findByLabelText('Ma place')
  expect(moi).toHaveTextContent('Une visite ce mois-ci te fait entrer au classement')
})

test('dans les trois premiers : ma ligne se distingue, pas de ligne en plus', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({
    tete,
    moi: { rang: 2, lieux: 19 },
    dixieme: 11,
  })
  monter()
  const liste = await screen.findByRole('list', { name: 'Les Grands Explorateurs' })
  expect(within(liste).getAllByRole('listitem')[1]).toHaveAttribute('data-moi')
  expect(screen.queryByLabelText('Ma place')).toBeNull()
})

test('personne n’a encore marché ce mois-ci : le bloc ne s’affiche pas', async () => {
  api.fetchGrandsExplorateurs.mockResolvedValue({ tete: [], moi: null, dixieme: null })
  monter()
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('list', { name: 'Les Grands Explorateurs' })).toBeNull()
})
