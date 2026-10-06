/**
 * QUOI     — page 2 (une page par territoire) et page 3 (un territoire, mois par mois).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Passeport } from '../api/lirePasseport'
import { PasseportOuvert } from './PasseportOuvert'
import { PasseportTerritoire } from './PasseportTerritoire'

const api = vi.hoisted(() => ({ fetchPasseport: vi.fn() }))
vi.mock('../api/passeport', () => api)

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const T = (id: string, quand: string, o: Record<string, unknown> = {}) => ({
  id,
  nom: `Lieu ${id}`,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand,
  ...o,
})

const AM = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => T(id, `2026-10-0${String(6 - i)}`))
const PASSEPORT: Passeport = {
  auJour: true,
  natures: [NATURE],
  tampons: [
    ...AM,
    T('g', '2026-09-12'),
    T('h', '2026-08-03'),
    T('i', '2026-07-01', { departement: 'Côtes-d’Armor' }),
    T('j', '2026-06-01', { departement: null, pays: null }),
  ],
}

beforeEach(() => {
  api.fetchPasseport.mockResolvedValue(PASSEPORT)
})

function afficher(url: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/:tab/explorateur/:id/passeport" element={<PasseportOuvert id="u1" />} />
          <Route
            path="/:tab/explorateur/:id/passeport/:territoire"
            element={<TerritoireDepuisUrl />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Comme la route de app/ : le paramètre arrive décodé par react-router.
function TerritoireDepuisUrl() {
  const { territoire = '' } = useParams()
  return <PasseportTerritoire id="u1" territoire={territoire} />
}

test('page 2 : une page par territoire, 4 tampons au plus et « +N »', async () => {
  afficher('/compte/explorateur/u1/passeport')
  const am = await screen.findByRole('link', { name: /Alpes-Maritimes/ })
  expect(within(am).getAllByRole('img')).toHaveLength(4)
  expect(within(am).getByText('+4 ›')).toBeInTheDocument()
  expect(am).toHaveAttribute('href', '/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(screen.getByRole('link', { name: /Ailleurs/ })).toBeInTheDocument()
})

test('page 2 : un nom avec apostrophe s’encode dans l’adresse', async () => {
  afficher('/compte/explorateur/u1/passeport')
  expect(await screen.findByRole('link', { name: /Côtes-d’Armor/ })).toHaveAttribute(
    'href',
    `/compte/explorateur/u1/passeport/${encodeURIComponent('Côtes-d’Armor')}`,
  )
})

test('page 3 : résumé, deux mois ouverts, les autres repliés et dépliables', async () => {
  afficher('/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(
    await screen.findByText(/8 tampons · 1 nature sur 1 · depuis le 3 août 2026/),
  ).toBeInTheDocument()
  const octobre = screen.getByRole('region', { name: /octobre 2026/i })
  expect(within(octobre).getAllByRole('link')).toHaveLength(6)
  expect(within(octobre).getByText('6 oct.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /septembre 2026/i })).toBeInTheDocument()
  const aout = screen.getByRole('button', { name: /août 2026 · 1 tampon/i })
  expect(screen.queryByRole('link', { name: /Lieu h/ })).not.toBeInTheDocument()
  await userEvent.click(aout)
  expect(screen.getByRole('link', { name: /Lieu h/ })).toBeInTheDocument()
})

test('page 3 : chez un autre, pas de pastille du jour', async () => {
  api.fetchPasseport.mockResolvedValue({
    ...PASSEPORT,
    auJour: false,
    tampons: PASSEPORT.tampons.map((t) => ({ ...t, quand: `${t.quand.slice(0, 7)}-01` })),
  })
  afficher('/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(await screen.findByText(/depuis août 2026/)).toBeInTheDocument()
  expect(screen.queryByText(/^\d+ oct\.$/)).not.toBeInTheDocument()
})

test('page 3 : Ailleurs et nom avec apostrophe se rouvrent depuis l’adresse', async () => {
  afficher('/compte/explorateur/u1/passeport/Ailleurs')
  expect(await screen.findByRole('link', { name: /Lieu j/ })).toBeInTheDocument()
})

test('page 3 : un territoire inconnu', async () => {
  afficher('/compte/explorateur/u1/passeport/Atlantide')
  expect(await screen.findByText('Ce territoire n’est pas dans le passeport.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '‹ Le passeport' })).toHaveAttribute(
    'href',
    '/compte/explorateur/u1/passeport',
  )
})
