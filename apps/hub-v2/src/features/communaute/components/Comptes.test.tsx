import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { exporterComptes } from '../hooks/useComptes'
import { Comptes } from './Comptes'

const mockUseComptes = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useComptes', () => ({ useComptes: mockUseComptes, exporterComptes: vi.fn() }))

const liste = {
  total: 2,
  compteurs: { comptes: 4750, actifs: 312, reactives: 1412, sommeil: 2459 },
  provenances: ['app', 'flyer'], departements: ['Aude'],
  lignes: [
    { id: 'u1', nom: 'Kelpie', email: 'k@x.fr', avatar: null, role: 'user', provenance: 'flyer', inscrit: '2026-10-14T09:00:00Z',
      derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:00:00Z', client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2 },
    { id: 'u2', nom: 'Un Voyageur', email: null, avatar: null, role: 'user', provenance: null, inscrit: '2024-02-01T00:00:00Z',
      derniere_visite: null, entree_v2: null, client: false, departement: null, code: null, fragments: 0 },
  ],
}

function monter(adresse = '/communaute/comptes') {
  const router = createMemoryRouter([{ path: '/communaute/comptes', Component: Comptes }], { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}

test('les quatre chiffres, les lignes et leurs balises', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter()
  expect(screen.getByText('4 750')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Kelpie/ })).toHaveAttribute('href', '/communaute/comptes/u1')
  expect(screen.getByText('Seine-et-Marne (77)')).toBeInTheDocument()
  expect(screen.getByText('En sommeil', { selector: '[data-teinte]' })).toBeInTheDocument()
  expect(screen.getByText('jamais')).toBeInTheDocument()
})

test('le filtre va dans l’adresse et repart de la première page', async () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  const router = monter('/communaute/comptes?page=2')
  await userEvent.click(screen.getByRole('radio', { name: 'En sommeil' }))
  expect(router.state.location.search).toBe('?filtre=sommeil')
})

test('un export qui échoue le dit', async () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  vi.mocked(exporterComptes).mockRejectedValueOnce(new Error('réseau'))
  monter()
  await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }))
  expect(await screen.findByText('L’export n’a pas pu se faire.')).toBeInTheDocument()
})

test('une page hors bornes ou illisible se ramène à une page qui existe', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  const router = monter('/communaute/comptes?page=9')
  expect(router.state.location.search).toBe('?page=1')
  expect(mockUseComptes).toHaveBeenLastCalledWith(expect.objectContaining({ decalage: 0 }))
})

test('une page non numérique vaut la première', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter('/communaute/comptes?page=abc')
  expect(mockUseComptes).toHaveBeenLastCalledWith(expect.objectContaining({ decalage: 0 }))
})
