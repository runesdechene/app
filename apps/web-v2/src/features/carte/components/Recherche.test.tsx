import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rendre, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { Recherche } from './Recherche'

const api = vi.hoisted(() => ({ fetchExplorateurs: vi.fn() }))
vi.mock('../api/carte', () => api)

// La recherche cherche aussi les membres (TanStack Query) et ouvre leur profil (un lien).
function render(ui: ReactNode) {
  return rendre(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function lieu(l: Partial<LieuCarte>): LieuCarte {
  return {
    id: l.nom ?? 'a',
    nom: 'Lieu',
    lat: 44,
    lng: 7,
    nature: 'lieu',
    icone: null,
    couleur: null,
    etat: 'connu',
    revendication: null,
    natures: [],
    epoque: null,
    ajoute: false,
    ...l,
  }
}

test('chercher un lieu par son nom propose le lieu, le toucher y va', async () => {
  const aller = vi.fn()
  render(
    <Recherche
      lieux={[lieu({ nom: 'Trophée des Alpes', lat: 43.74, lng: 7.43 })]}
      onAller={aller}
    />,
  )
  await userEvent.type(screen.getByRole('searchbox', { name: 'Un lieu, une ville…' }), 'troph')
  await userEvent.click(screen.getByRole('option', { name: 'Trophée des Alpes' }))
  expect(aller).toHaveBeenCalledWith({ lat: 43.74, lng: 7.43 })
})

test('la recherche ignore les accents et la casse', async () => {
  render(<Recherche lieux={[lieu({ nom: 'Église Saint-Jean' })]} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox'), 'eglise')
  expect(screen.getByRole('option', { name: 'Église Saint-Jean' })).toBeInTheDocument()
})

test('dix résultats au plus', async () => {
  const lieux = Array.from({ length: 15 }, (_, i) =>
    lieu({ id: String(i), nom: `Tour ${String(i)}` }),
  )
  render(<Recherche lieux={lieux} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox'), 'tour')
  expect(screen.getAllByRole('option')).toHaveLength(10)
})

test('avec un compte, les Explorateurs dont le nom commence ainsi s’ajoutent, vers leur profil', async () => {
  api.fetchExplorateurs.mockResolvedValue([
    { id: 'g1', nom: 'Gautier de Bilskirnir', avatar: null },
  ])
  render(<Recherche lieux={[lieu({ nom: 'Gaudissart' })]} onAller={vi.fn()} membres />)
  await userEvent.type(screen.getByRole('searchbox', { name: 'Un lieu, un Explorateur…' }), 'gau')
  const membre = await screen.findByRole('link', { name: /Gautier de Bilskirnir/ })
  expect(membre).toHaveAttribute('href', '/carte/explorateur/g1')
  expect(api.fetchExplorateurs).toHaveBeenLastCalledWith('gau')
  expect(screen.getByRole('option', { name: 'Gaudissart' })).toBeInTheDocument()
})

test('sans compte (la carte des visiteurs), on ne cherche que les lieux', async () => {
  api.fetchExplorateurs.mockClear()
  render(<Recherche lieux={[lieu({ nom: 'Gaudissart' })]} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox', { name: 'Un lieu, une ville…' }), 'gau')
  expect(await screen.findByRole('option', { name: 'Gaudissart' })).toBeInTheDocument()
  expect(api.fetchExplorateurs).not.toHaveBeenCalled()
})
