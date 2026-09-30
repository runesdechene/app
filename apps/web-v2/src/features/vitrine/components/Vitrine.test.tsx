/**
 * QUOI     — la vitrine, sans compte : les vrais chiffres, l'activité, une recherche qui mène à
 *            l'aperçu d'un lieu, une nature qui montre ses lieux ; puis l'aperçu, qui retient le
 *            lieu pour après l'inscription.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { reprendreLieu } from '@/shared/lib/apresEntree'
import { ApercuLieu } from './ApercuLieu'
import { Vitrine } from './Vitrine'

const api = vi.hoisted(() => ({
  fetchChiffres: vi.fn(),
  fetchNatures: vi.fn(),
  chercher: vi.fn(),
  fetchActivite: vi.fn(),
  fetchApercu: vi.fn(),
}))
vi.mock('../api/vitrine', () => api)

const DOLMENS = { id: 'n1', nom: 'Dolmens & mégalithes', icone: null, couleur: null }
const CHEVRESSE = {
  id: 'd1',
  nom: 'Dolmen de la Chevresse',
  region: 'Nièvre',
  nature: DOLMENS,
  vignette: null,
}

beforeEach(() => {
  api.fetchChiffres.mockResolvedValue({ lieux: 3473, explorateurs: 4750 })
  api.fetchNatures.mockResolvedValue([{ ...DOLMENS, nombre: 37 }])
  api.chercher.mockResolvedValue({ total: 37, lieux: [CHEVRESSE] })
  api.fetchActivite.mockResolvedValue([
    { sorte: 'decouverte', quand: new Date().toISOString(), lieu: 'Fort des Têtes' },
  ])
  api.fetchApercu.mockResolvedValue({
    id: 'd1',
    nom: 'Dolmen de la Chevresse',
    region: 'Nièvre',
    nature: DOLMENS,
    epoque: 'Néolithique',
    photo: null,
    photos: 3,
    explorateurs: 1,
    extrait: 'Posé sur la lande depuis cinq mille ans…',
    suite: true,
  })
})

function monter(depart: string) {
  const router = createMemoryRouter(
    [
      { path: '/bienvenue', element: <Vitrine /> },
      { path: '/bienvenue/lieu/:id', element: <ApercuLieu /> },
      { path: '/bienvenue/:etape', element: <p>l’onboarding</p> },
    ],
    { initialEntries: [depart] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('la vitrine dit les vrais chiffres et la dernière activité', async () => {
  monter('/bienvenue')
  // Les chiffres français se séparent par une espace fine insécable : on la lit en espace.
  const phrase = await screen.findByText(/hauts lieux/)
  expect(phrase.textContent.replace(/\s/g, ' ')).toContain('3 473 hauts lieux')
  expect(await screen.findByText(/vient de découvrir/)).toHaveTextContent(
    'Un Explorateur vient de découvrir Fort des Têtes',
  )
})

test('chercher un mot mène à l’aperçu du lieu', async () => {
  const router = monter('/bienvenue')
  await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher un lieu' }), 'dolm')
  const lieu = await screen.findByRole('link', { name: /Dolmen de la Chevresse/ })
  expect(api.chercher).toHaveBeenLastCalledWith('dolm', null)
  expect(screen.getByText(/Et 36 autres lieux/)).toBeInTheDocument()

  await userEvent.click(lieu)
  expect(router.state.location.pathname).toBe('/bienvenue/lieu/d1')
})

test('toucher une nature montre ses lieux', async () => {
  monter('/bienvenue')
  const nature = await screen.findByRole('button', { name: 'Dolmens & mégalithes' })
  await userEvent.click(nature)
  expect(nature).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByRole('link', { name: /Dolmen de la Chevresse/ })).toBeInTheDocument()
  expect(api.chercher).toHaveBeenLastCalledWith('', 'n1')
})

test('l’aperçu montre le début du lieu, et retient le lieu pour après l’inscription', async () => {
  const router = monter('/bienvenue/lieu/d1')
  expect(await screen.findByRole('heading', { name: 'Dolmen de la Chevresse' })).toBeInTheDocument()
  expect(screen.getByText('Nièvre · Néolithique')).toBeInTheDocument()
  expect(screen.getByText('3 photos · 1 Explorateur y est passé')).toBeInTheDocument()

  await userEvent.click(
    screen.getByRole('link', { name: 'Crée ton compte pour découvrir ce lieu' }),
  )
  expect(router.state.location.pathname).toBe('/bienvenue/preambule')
  expect(reprendreLieu()).toBe('d1')
})

test('un lieu qui ne se montre pas sans compte le dit', async () => {
  api.fetchApercu.mockResolvedValue(null)
  monter('/bienvenue/lieu/cache')
  expect(await screen.findByText('Ce lieu ne se montre qu’aux Explorateurs.')).toBeInTheDocument()
})
