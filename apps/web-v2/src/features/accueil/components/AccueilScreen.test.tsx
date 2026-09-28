/**
 * QUOI     — l'Accueil (maquette 27:2) : la nouveauté de la marque mène à la boutique, les lieux
 *            ajoutés ouvrent leur fiche, le fil dit qui a fait quoi, et l'on y salue.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AccueilScreen } from './AccueilScreen'

const api = vi.hoisted(() => ({
  fetchNouveaute: vi.fn(),
  fetchAjoutes: vi.fn(),
  fetchChemins: vi.fn(),
  saluer: vi.fn(),
}))
vi.mock('../api/accueil', () => api)

const LUNA = { id: 'u2', nom: 'Luna', avatar: null }
const VISITE = {
  id: 'visite:l1:u2',
  type: 'visite',
  quand: new Date().toISOString(),
  qui: LUNA,
  lieu: { id: 'l1', nom: 'Pointe du Becquet', region: 'Manche' },
  moi: false,
  saluts: 2,
  salue: false,
}

beforeEach(() => {
  api.fetchNouveaute.mockResolvedValue({
    titre: 'La loutre',
    image: 'loutre.jpg',
    lien: 'https://runesdechene.com/loutre',
  })
  api.fetchAjoutes.mockResolvedValue([
    {
      id: 'l9',
      nom: 'Château de Jonjeac',
      imageUrl: null,
      latitude: null,
      longitude: null,
      categorie: null,
      auteur: { nom: 'Luna', avatarUrl: null },
    },
  ])
  api.fetchChemins.mockResolvedValue([
    VISITE,
    {
      ...VISITE,
      id: 'ajout:l3',
      type: 'ajout',
      moi: true,
      qui: { ...LUNA, id: 'u1', nom: 'Uriel' },
      lieu: { id: 'l3', nom: 'Menhir de Kerloas', region: 'Finistère' },
    },
    {
      ...VISITE,
      id: 'arrivee:u4',
      type: 'arrivee',
      qui: { ...LUNA, id: 'u4', nom: 'Claire' },
      lieu: null,
      saluts: 0,
    },
  ])
  api.saluer.mockResolvedValue({ saluts: 3, salue: true })
})

function monter() {
  const router = createMemoryRouter([{ path: '*', element: <AccueilScreen /> }], {
    initialEntries: ['/accueil'],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('la nouveauté de la marque mène à la boutique', async () => {
  monter()
  const lien = await screen.findByRole('link', { name: /La loutre/ })
  expect(lien).toHaveAttribute('href', 'https://runesdechene.com/loutre')
})

test('un lieu ajouté récemment ouvre sa fiche dans l’Accueil', async () => {
  const router = monter()
  await userEvent.click(await screen.findByRole('link', { name: /Château de Jonjeac/ }))
  expect(router.state.location.pathname).toBe('/accueil/lieu/l9')
})

test('le fil dit qui a fait quoi, où et quand', async () => {
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  const [visite, ajout, arrivee] = within(fil).getAllByRole('listitem')
  expect(visite).toHaveTextContent('Luna a visité Pointe du Becquet')
  expect(visite).toHaveTextContent('Manche, à l’instant')
  expect(ajout).toHaveTextContent('Uriel a ajouté Menhir de Kerloas')
  expect(arrivee).toHaveTextContent('Claire a rejoint les Explorateurs')
})

test('on salue la ligne d’un autre ; la sienne ne se salue pas', async () => {
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  const [visite, ajout] = within(fil).getAllByRole('listitem')
  if (!visite || !ajout) throw new Error('lignes absentes')
  const saluer = within(visite).getByRole('button', { name: /Saluer Luna/ })
  expect(saluer).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(saluer)
  expect(api.saluer).toHaveBeenCalledWith('visite:l1:u2')
  expect(await within(visite).findByRole('button', { name: /Saluer Luna/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(ajout).queryByRole('button')).toBeNull()
})
