/**
 * QUOI     — « Renommer » un territoire : le nom part sans ses espaces, et la feuille se referme.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { TerritoireRevendique } from '../api/lireCarte'
import { FeuilleRenommer } from './FeuilleRenommer'

const api = vi.hoisted(() => ({ renommerTerritoire: vi.fn(() => Promise.resolve()) }))
vi.mock('../api/carte', () => api)

const territoire: TerritoireRevendique = {
  id: 'lieu-1',
  nom: 'La Garde du Comté',
  moi: true,
  lieux: 5,
  ids: ['lieu-1', 'lieu-2'],
  morceaux: [],
  ancre: [7.27, 43.7],
}

function avecRouteur(element: React.ReactElement) {
  const router = createMemoryRouter(
    [
      { path: '/carte', element },
      { path: '*', element: null },
    ],
    { initialEntries: ['/carte'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('« Renommer » envoie le nom sans ses espaces, puis se referme', async () => {
  const fermer = vi.fn()
  avecRouteur(<FeuilleRenommer territoire={territoire} onFermer={fermer} />)
  const feuille = await screen.findByRole('dialog', { name: 'La Garde du Comté' })
  const champ = within(feuille).getByLabelText('Nom du territoire')
  await userEvent.clear(champ)
  await userEvent.type(champ, '  Les Marches du Nord ')
  await userEvent.click(within(feuille).getByRole('button', { name: 'Renommer' }))
  expect(api.renommerTerritoire).toHaveBeenCalledWith('lieu-1', 'Les Marches du Nord')
  await vi.waitFor(() => {
    expect(fermer).toHaveBeenCalled()
  })
})
