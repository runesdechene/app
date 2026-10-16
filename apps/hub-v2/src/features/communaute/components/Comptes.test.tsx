import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { exporterComptes } from '../hooks/useComptes'
import { Comptes } from './Comptes'
import { TiroirCompte } from './TiroirCompte'

const mockUseComptes = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useComptes', () => ({ useComptes: mockUseComptes, exporterComptes: vi.fn() }))
vi.mock('../hooks/useCompte', () => ({ useCompte: () => ({ data: null, isPending: false }), useChangerRole: vi.fn() }))

const liste = {
  total: 2,
  compteurs: { comptes: 4750, actifs: 312, reactives: 1412, sommeil: 2459, jamais: 96 },
  provenances: ['app', 'flyer'], departements: ['Aude'],
  lignes: [
    { id: 'u1', nom: 'Kelpie', email: 'k@x.fr', avatar: null, role: 'user', provenance: 'flyer', inscrit: '2026-10-14T09:00:00Z',
      derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:00:00Z', client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2 },
    { id: 'u2', nom: 'Un Voyageur', email: null, avatar: null, role: 'user', provenance: null, inscrit: '2024-02-01T00:00:00Z',
      derniere_visite: null, entree_v2: null, client: false, departement: null, code: null, fragments: 0 },
  ],
}

function monter(adresse = '/communaute/comptes') {
  const router = createMemoryRouter(
    [{ path: '/communaute/comptes', Component: Comptes, children: [{ path: ':id', Component: TiroirCompte }] }],
    { initialEntries: [adresse] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('les cinq chiffres, les lignes et leurs balises', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter()
  expect(screen.getByText('4 750')).toBeInTheDocument()
  expect(screen.getByText('96')).toBeInTheDocument()
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

test('le filtre « Jamais connectés » existe', async () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  const router = monter()
  await userEvent.click(screen.getByRole('radio', { name: 'Jamais connectés' }))
  expect(router.state.location.search).toBe('?filtre=jamais')
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

test('ouvrir une fiche garde le filtre et la page, la fermer y ramène', async () => {
  mockUseComptes.mockReturnValue({ data: { ...liste, total: 500 }, isError: false })
  const router = monter('/communaute/comptes?filtre=porteurs&page=3')
  await userEvent.click(screen.getByRole('link', { name: /Kelpie/ }))
  expect(router.state.location.pathname).toBe('/communaute/comptes/u1')
  expect(router.state.location.search).toBe('?filtre=porteurs&page=3')
  await userEvent.click(screen.getByRole('link', { name: '✕ Fermer' }))
  expect(router.state.location.pathname).toBe('/communaute/comptes')
  expect(router.state.location.search).toBe('?filtre=porteurs&page=3')
})

test('« + Compte du stand » mène à /nouveau en gardant les critères de la liste', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter('/communaute/comptes?filtre=porteurs')
  expect(screen.getByRole('link', { name: '+ Compte du stand' })).toHaveAttribute('href', '/communaute/comptes/nouveau?filtre=porteurs')
})

test('l’inscription au jour près, et la liste triée par inscription par défaut', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter()
  expect(screen.getByText('14/10/2026')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Trier' })).toHaveValue('inscription')
  expect(mockUseComptes).toHaveBeenLastCalledWith(expect.objectContaining({ tri: 'inscription' }))
})
