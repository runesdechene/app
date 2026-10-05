/**
 * QUOI     — fonder une Compagnie : nom, devise (son compteur), mission, couleur, publique/privée ;
 *            un nom pris le dit sous le champ.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FonderCompagnie } from './FonderCompagnie'

const api = vi.hoisted(() => ({
  fonder: vi.fn(() => Promise.resolve('f-neuve')),
  envoyerAvatar: vi.fn(),
}))
vi.mock('../api/compagnies', () => api)

let router: ReturnType<typeof createMemoryRouter>
beforeEach(() => {
  vi.clearAllMocks()
  router = createMemoryRouter(
    [
      { path: '/messages/compagnie/fonder', element: <FonderCompagnie /> },
      { path: '/messages/compagnie/:id', element: <p>la fiche</p> },
    ],
    { initialEntries: ['/messages/compagnie/fonder'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
})

test('fonder envoie la fiche, puis ouvre la Compagnie', async () => {
  const fonder = screen.getByRole('button', { name: 'Fonder la Compagnie' })
  expect(fonder).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox', { name: 'Son nom' }), 'Les Marcheurs du Vercors')
  await userEvent.type(screen.getByRole('textbox', { name: 'Sa devise' }), 'Les sommets, en bande')
  expect(screen.getByText('21 / 80')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Sa mission' }), 'Une sortie par mois.')
  await userEvent.click(screen.getByRole('button', { name: 'Couleur 2' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Privée' }))
  await userEvent.click(fonder)
  expect(api.fonder).toHaveBeenCalledWith({
    nom: 'Les Marcheurs du Vercors',
    devise: 'Les sommets, en bande',
    mission: 'Une sortie par mois.',
    couleur: '#4f7a4a',
    avatar: null,
    privee: true,
  })
  expect(await screen.findByText('la fiche')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/messages/compagnie/f-neuve')
})

test('un nom déjà pris se dit sous le champ', async () => {
  api.fonder.mockRejectedValueOnce(Object.assign(new Error('pris'), { hint: 'nom_pris' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Son nom' }), 'Le Lys de Fer')
  await userEvent.click(screen.getByRole('button', { name: 'Fonder la Compagnie' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce nom est déjà pris')
})
