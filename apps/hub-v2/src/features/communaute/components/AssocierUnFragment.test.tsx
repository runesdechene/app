import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { AssocierUnFragment } from './AssocierUnFragment'

const m = vi.hoisted(() => ({
  comptes: vi.fn(), compte: vi.fn(), shopify: vi.fn(), creer: vi.fn(), associer: vi.fn(), retirer: vi.fn(),
}))
vi.mock('../api/comptes', () => ({ lireComptes: m.comptes, lireCompte: m.compte }))
vi.mock('../api/clientShopify', () => ({ lireClientShopify: m.shopify }))
vi.mock('../api/compteDuStand', () => ({ creerCompteDuStand: m.creer }))
vi.mock('../api/fragmentsDuCompte', () => ({
  lireFragmentsAssociables: () => Promise.resolve([{ id: 7, nom: 'Hoplite', image: null }, { id: 9, nom: 'Kelpie', image: null }]),
  associerFragment: m.associer, retirerFragment: m.retirer,
}))

const camille = {
  id: 'u1', nom: 'Camille', email: 'camille@gmail.com', avatar: null, client: true, fragments: 1,
  inscrit: '2025-08-12T10:00:00Z', derniere_visite: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  m.comptes.mockResolvedValue({ lignes: [] })
})

function monter(adresse = '/boutique/associer') {
  const router = createMemoryRouter([{ path: '/boutique/associer', element: <AssocierUnFragment maintenant={new Date('2026-10-16T10:00:00Z')} /> }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
}

const champ = () => screen.getByRole('searchbox', { name: 'Prénom ou e-mail du client' })

test('une fin d’e-mail complète l’adresse ; sans compte, « Créer ce compte » apparaît', async () => {
  monter()
  await userEvent.type(champ(), 'lea.dubois')
  expect(screen.queryByRole('button', { name: 'Créer ce compte' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '@gmail.com' }))
  expect(champ()).toHaveValue('lea.dubois@gmail.com')
  expect(await screen.findByRole('button', { name: 'Créer ce compte' })).toBeInTheDocument()
  expect(screen.getByText(/Personne n’a encore l’adresse lea.dubois@gmail.com/)).toBeInTheDocument()
})

test('une adresse déjà prise : pas de « Créer ce compte », le client se choisit et sa fiche dit s’il est client en ligne', async () => {
  m.comptes.mockResolvedValue({ lignes: [camille] })
  m.compte.mockResolvedValue({ ...camille, fragments: [{ id: 7, nom: 'Hoplite', image: null, source: 'manual', quand: null }] })
  m.shopify.mockResolvedValue({
    commandes: 4, depense: 312, devise: 'EUR', depuis: '2024-03-02T10:00:00Z', auStand: 2, commandesLues: true,
    derniereEnLigne: { numero: '#1042', date: '2026-10-02T10:00:00Z', produits: ['T-shirt Yggdrasil'] },
  })
  monter()
  await userEvent.type(champ(), 'camille@gmail.com')
  await userEvent.click(await screen.findByRole('button', { name: /Camille/ }))
  expect(screen.queryByRole('button', { name: 'Créer ce compte' })).not.toBeInTheDocument()
  expect(await screen.findByText('Cliente en ligne')).toBeInTheDocument()
  expect(screen.getByText(/Dernière commande en ligne le 2 octobre 2026 : T-shirt Yggdrasil/)).toBeInTheDocument()
  expect(screen.getByText('dont 2 au stand')).toBeInTheDocument()
  expect(m.shopify).toHaveBeenCalledWith('camille@gmail.com')
})

test('un Fragment activé demande « Retirer ? » avant de se retirer ; un autre s’active d’un toucher', async () => {
  m.compte.mockResolvedValue({ ...camille, fragments: [{ id: 7, nom: 'Hoplite', image: null, source: 'manual', quand: null }] })
  m.shopify.mockResolvedValue(null)
  m.associer.mockResolvedValue(undefined)
  m.retirer.mockResolvedValue(undefined)
  monter('/boutique/associer?compte=u1')
  const hoplite = await screen.findByRole('button', { name: /Hoplite/ })
  await userEvent.click(hoplite)
  expect(m.retirer).not.toHaveBeenCalled()
  expect(hoplite).toHaveTextContent('Retirer ?')
  await userEvent.click(hoplite)
  expect(m.retirer).toHaveBeenCalledWith('u1', 7)
  await userEvent.click(screen.getByRole('button', { name: /Kelpie/ }))
  expect(m.associer).toHaveBeenCalledWith('u1', 9)
  expect(screen.getByText(/Inconnu de la boutique/)).toBeInTheDocument()
})

test('créer ce compte : le prénom, les Fragments choisis d’avance, un seul bouton', async () => {
  m.creer.mockResolvedValue('u9')
  m.associer.mockResolvedValue(undefined)
  monter()
  await userEvent.type(champ(), 'lea@gmail.com')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer ce compte' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Son prénom' }), 'Léa')
  await userEvent.click(await screen.findByRole('button', { name: /Kelpie/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Créer le compte de Léa · 1 Fragment' }))
  expect(m.creer).toHaveBeenCalledWith({ email: 'lea@gmail.com', prenom: 'Léa', newsletter: false })
  expect(m.associer).toHaveBeenCalledWith('u9', 9)
})
