import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Fragment } from '../api/fragments'
import type { Illustration } from '../api/shopify'
import { Fragments } from './Fragments'

const api = vi.hoisted(() => ({
  lireFragments: vi.fn(),
  synchroniserFragments: vi.fn(),
  ajouterFragment: vi.fn(),
  lireIllustrations: vi.fn(),
  lireScans: vi.fn(),
  recalculerEmpreintes: vi.fn(),
}))
vi.mock('../api/fragments', () => ({
  lireFragments: api.lireFragments,
  synchroniserFragments: api.synchroniserFragments,
  ajouterFragment: api.ajouterFragment,
}))
vi.mock('../api/shopify', () => ({ lireIllustrations: api.lireIllustrations }))
vi.mock('../api/scan', () => ({ lireScans: api.lireScans, recalculerEmpreintes: api.recalculerEmpreintes }))

const fragment = (id: number, name: string, surcharge: Partial<Fragment> = {}): Fragment => ({
  id, name, link_url: null, visible: true, shopify_handle: name.toLowerCase(), resume: null, histoire: null,
  illustration_url: `https://cdn/${name}.png`, illustration_sombre_url: null, audio_url: null, artiste: null,
  narrateur: null, heritage: null, synchronise_le: null, origine_lat: null, origine_lng: null,
  origine_nom: null, theme: null, ...surcharge,
})
const motif = (handle: string, collection: string): Illustration => ({
  handle, nom: handle, collection, resume: '', histoire: '', illustration_url: '', illustration_sombre_url: '',
  fond_url: '', audio_url: '', artiste: '', narrateur: '', heritage: '',
})

const hoplite = fragment(1, 'Hoplite') // visible, origine à poser, sans vue : à filmer
const loup = fragment(2, 'Loup', { visible: false })
const runes = fragment(3, 'Runes', { origine_nom: 'Rome', origine_lat: 41, origine_lng: 12 })

function afficher() {
  const router = createMemoryRouter(
    [
      { path: '/boutique/fragments', Component: Fragments },
      { path: '/boutique/fragments/:id', element: <p>fiche</p> },
    ],
    { initialEntries: ['/boutique/fragments'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.resetAllMocks()
  api.lireFragments.mockResolvedValue([hoplite, loup, runes])
  api.lireScans.mockResolvedValue([
    { id: 1, illustrations: 1, vues: [], scans7: 0, scans30: 0 },
    { id: 3, illustrations: 1, vues: [{ id: 9, le: '2026-10-01', par: null }], scans7: 0, scans30: 0 },
  ])
  api.lireIllustrations.mockResolvedValue([])
})

test('la liste dit ce qui est masqué, sans origine et à filmer', async () => {
  afficher()
  expect(await screen.findByText('Masqué')).toBeInTheDocument()
  expect(screen.getByText('Origine à poser')).toBeInTheDocument()
  expect(screen.getByText('Rome')).toBeInTheDocument()
  expect(await screen.findByText('À filmer')).toBeInTheDocument()
  expect(screen.getAllByText('À filmer')).toHaveLength(1)
  expect(screen.getByText(/3 Fragments · contenu tiré de Shopify, jamais synchronisé · 1 à filmer pour le scan/)).toBeInTheDocument()
})

test('la synchro lit Shopify, met à jour, puis recalcule les empreintes des Fragments visibles seulement', async () => {
  api.synchroniserFragments.mockResolvedValue(2)
  api.recalculerEmpreintes.mockResolvedValue(4)
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Synchroniser depuis Shopify' }))
  expect(await screen.findByText('2 Fragments mis à jour depuis Shopify · empreintes de scan recalculées')).toBeInTheDocument()
  expect(api.lireIllustrations).toHaveBeenCalled()
  expect(api.synchroniserFragments).toHaveBeenCalledOnce()
  expect(api.recalculerEmpreintes.mock.calls.map((appel) => (appel[0] as Fragment).id)).toEqual([1, 3])
})

test('un échec de calcul n’arrête pas les autres et nomme le Fragment', async () => {
  api.synchroniserFragments.mockResolvedValue(2)
  api.recalculerEmpreintes.mockImplementation((f: Fragment) => (f.id === 1 ? Promise.reject(new Error('image refusée')) : Promise.resolve(4)))
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Synchroniser depuis Shopify' }))
  expect(await screen.findByText('2 Fragments mis à jour depuis Shopify · empreintes de scan : 1 / 2, échec pour Hoplite')).toBeInTheDocument()
  expect(api.recalculerEmpreintes).toHaveBeenCalledTimes(2)
})

test('Shopify qui refuse : le message reçu, rien n’est synchronisé', async () => {
  api.lireIllustrations.mockRejectedValue(new Error('Forbidden — admin only'))
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Synchroniser depuis Shopify' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Shopify ne répond pas : Forbidden — admin only')
  expect(api.synchroniserFragments).not.toHaveBeenCalled()
})

test('un motif sans collection ne peut pas devenir un Fragment ; un autre, si', async () => {
  api.lireIllustrations.mockResolvedValue([motif('hoplite', ''), motif('ancien', ''), motif('corbeau', 'corbeau')])
  api.ajouterFragment.mockResolvedValue(7)
  const router = afficher()
  expect(await screen.findByRole('heading', { name: 'Motifs Shopify sans Fragment' })).toBeInTheDocument()
  const boutons = screen.getAllByRole('button', { name: 'En faire un Fragment' })
  expect(boutons).toHaveLength(2) // « hoplite » est déjà un Fragment
  expect(boutons[0]).toBeDisabled()
  expect(screen.getByText('Relie d’abord une collection à ce métaobjet dans Shopify')).toBeInTheDocument()
  await userEvent.click(boutons[1] as HTMLElement)
  await waitFor(() => { expect(router.state.location.pathname).toBe('/boutique/fragments/7') })
  expect(api.ajouterFragment).toHaveBeenCalledWith(expect.objectContaining({ handle: 'corbeau' }))
})

test('tout est trié quand chaque motif est un Fragment', async () => {
  api.lireIllustrations.mockResolvedValue([motif('hoplite', '')])
  afficher()
  expect(await screen.findByText('Tout est trié : chaque Illustration de Shopify est un Fragment.')).toBeInTheDocument()
})
