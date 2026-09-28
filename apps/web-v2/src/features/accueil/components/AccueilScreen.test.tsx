/**
 * QUOI     — l'Accueil (maquette 27:2) : les lieux ajoutés ouvrent leur fiche, le fil dit qui a
 *            fait quoi, et l'on y salue.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AccueilScreen } from './AccueilScreen'

const api = vi.hoisted(() => ({
  fetchBanniere: vi.fn(),
  fetchAjoutes: vi.fn(),
  fetchPresDeMoi: vi.fn(),
  fetchGrandsExplorateurs: vi.fn(),
  fetchChemins: vi.fn(),
  saluer: vi.fn(),
}))
vi.mock('../api/accueil', () => api)

// La position du téléphone : accordée, sauf là où un test la refuse.
const position = vi.hoisted(() => ({ positionSiAutorisee: vi.fn() }))
vi.mock('@/shared/lib/position', () => position)

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
  api.fetchBanniere.mockResolvedValue({
    image: 'celtes.jpg',
    titre: 'Les Mystères Celtes',
    sousTitre: 'Au cœur de la première Europe',
    lien: 'https://runesdechene.com/celtes',
    voile: { couleur: '#e3d5b1', opacite: 0.85 },
    couleurs: { tag: '#3b4a78', titre: '#5b4949', sousTitre: '#69604f' },
    ombre: { couleur: '#000000', force: 0 },
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
  position.positionSiAutorisee.mockResolvedValue({ latitude: 48.1, longitude: -1.6 })
  api.fetchGrandsExplorateurs.mockResolvedValue({ tete: [], moi: null, dixieme: null })
  api.fetchPresDeMoi.mockResolvedValue([
    {
      id: 'l7',
      nom: 'Dolmen de la Roche-aux-Fées',
      imageUrl: 'd.jpg',
      type: { nom: 'Mégalithe', icone: 'm.svg', couleur: '#80974e' },
      metres: 4200,
    },
  ])
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

test('une bannière de la boutique, tirée au hasard, mène à la boutique', async () => {
  monter()
  const banniere = await screen.findByRole('link', { name: /Les Mystères Celtes/ })
  expect(banniere).toHaveAttribute('href', 'https://runesdechene.com/celtes')
  expect(banniere).toHaveTextContent('Boutique')
  expect(banniere).toHaveTextContent('Au cœur de la première Europe')
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
  // Le fil relu après le salut : la base compte le cœur.
  api.fetchChemins.mockResolvedValue([{ ...VISITE, saluts: 3, salue: true }])
  await userEvent.click(saluer)
  expect(api.saluer).toHaveBeenCalledWith('visite:l1:u2')
  expect(await within(visite).findByRole('button', { name: /Saluer Luna/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(ajout).queryByRole('button')).toBeNull()
})

test('le fil montre cinq lignes ; « Afficher plus » montre le reste', async () => {
  api.fetchChemins.mockResolvedValue(
    Array.from({ length: 8 }, (_, i) => ({ ...VISITE, id: `visite:l${String(i)}:u2` })),
  )
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  expect(within(fil).getAllByRole('listitem')).toHaveLength(5)
  await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }))
  expect(within(fil).getAllByRole('listitem')).toHaveLength(8)
  expect(screen.queryByRole('button', { name: 'Afficher plus' })).toBeNull()
})

test('sans salut, le cœur est seul : pas de « 0 »', async () => {
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  const arrivee = within(fil).getAllByRole('listitem')[2]
  if (!arrivee) throw new Error('ligne absente')
  expect(within(arrivee).getByRole('button', { name: /Saluer Claire/ })).toHaveTextContent(/^$/)
})

test('on salue à volonté : chaque toucher envoie un cœur, et en fait s’envoler un', async () => {
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  const visite = within(fil).getAllByRole('listitem')[0]
  if (!visite) throw new Error('ligne absente')
  const saluer = within(visite).getByRole('button', { name: /Saluer Luna/ })
  await userEvent.click(saluer)
  await userEvent.click(saluer)
  await userEvent.click(saluer)
  expect(api.saluer).toHaveBeenCalledTimes(3)
  expect(saluer.querySelectorAll('[data-envol]')).toHaveLength(3)
})

test('un lieu ajouté porte la bille de son type, dans sa couleur', async () => {
  api.fetchChemins.mockResolvedValue([
    {
      ...VISITE,
      id: 'ajout:l3',
      type: 'ajout',
      lieu: {
        id: 'l3',
        nom: 'Menhir de Kerloas',
        region: 'Finistère',
        type: { icone: 'menhir.svg', couleur: '#80974e' },
      },
    },
  ])
  monter()
  const fil = await screen.findByRole('list', { name: 'Sur les chemins' })
  const bille = fil.querySelector<HTMLElement>('[data-bille-type]')
  if (!bille) throw new Error('bille du type absente')
  expect(bille.style.getPropertyValue('--type')).toBe('#80974e')
})

test('près de toi : les lieux proches, leur type et leur distance ; un lieu ouvre sa fiche', async () => {
  const router = monter()
  const pres = await screen.findByRole('list', { name: 'À explorer près de toi' })
  expect(pres).toHaveTextContent('Dolmen de la Roche-aux-Fées')
  expect(pres).toHaveTextContent('Mégalithe')
  expect(pres).toHaveTextContent('4 km')
  expect(pres.querySelector('[data-bille-type]')).not.toBeNull()
  expect(api.fetchPresDeMoi).toHaveBeenCalledWith({ latitude: 48.1, longitude: -1.6 })
  await userEvent.click(within(pres).getByRole('link', { name: /Dolmen/ }))
  expect(router.state.location.pathname).toBe('/accueil/lieu/l7')
})

test('sans position partagée, pas de « Près de toi »', async () => {
  position.positionSiAutorisee.mockResolvedValue(null)
  monter()
  await screen.findByRole('list', { name: 'Sur les chemins' })
  expect(screen.queryByRole('list', { name: 'À explorer près de toi' })).toBeNull()
  expect(api.fetchPresDeMoi).not.toHaveBeenCalled()
})
