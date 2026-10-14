import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AccesShopifyRefuse } from '../api/shopify'
import type { EcouteDUnFragment } from '../api/ecoutes'
import { Ecoutes } from './Ecoutes'

const api = vi.hoisted(() => ({ lireEcoutes: vi.fn(), lireInventaireAudio: vi.fn(), lireProduitsSansIllustration: vi.fn() }))
vi.mock('../api/ecoutes', () => ({ lireEcoutes: api.lireEcoutes }))
vi.mock('../api/shopify', async (original) => ({
  ...(await original<typeof import('../api/shopify')>()),
  lireInventaireAudio: api.lireInventaireAudio,
  lireProduitsSansIllustration: api.lireProduitsSansIllustration,
}))

const ligne = (handle: string, ecoutes: number, surcharge: Partial<EcouteDUnFragment> = {}): EcouteDUnFragment => ({
  illustration_handle: handle, ecoutes, completions: 1, taux: 50, progression: 40, mesurables: ecoutes,
  ecoutes_motif: ecoutes - 1, ecoutes_produit: 1, derniere_ecoute: '2026-10-12T10:00:00Z', ...surcharge,
})
const jamais = () => new Promise<never>(() => undefined)
const inventaire = {
  illustrations: [
    { handle: 'loup', nom: 'Le Loup', aAudio: true },
    { handle: 'ours', nom: 'L’Ours', aAudio: true },
    { handle: 'muet', nom: 'La Muette', aAudio: false },
  ],
  tronque: false,
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><Ecoutes /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  api.lireEcoutes.mockResolvedValue([ligne('loup', 12)])
  api.lireInventaireAudio.mockResolvedValue(inventaire)
  api.lireProduitsSansIllustration.mockResolvedValue({ produits: [{ handle: 'p', titre: 'Pendentif seul' }], tronque: false })
})

test('12 écoutes : pas encore de quoi trancher', async () => {
  afficher()
  expect(await screen.findByText(/Pas encore de quoi trancher : 12 écoutes réelles/)).toBeInTheDocument()
})

test('assez d’écoutes : le verdict chiffré', async () => {
  api.lireEcoutes.mockResolvedValue([ligne('loup', 30, { completions: 15, taux: 50 })])
  afficher()
  expect(await screen.findByText(/50 % des écoutes vont jusqu’au bout, sur 30 écoutes réelles de 1 Fragment\./)).toBeInTheDocument()
  expect(screen.getByText(/parcourent 40 % du récit en moyenne, sur 30 écoutes mesurées\./)).toBeInTheDocument()
})

test('aucune écoute : le compteur démarre à la première', async () => {
  api.lireEcoutes.mockResolvedValue([])
  afficher()
  expect(await screen.findByText(/Le compteur démarre à la première écoute/)).toBeInTheDocument()
  expect(screen.getByText('Personne n’a encore écouté de Fragment.')).toBeInTheDocument()
})

test('l’inventaire en cours : « Lecture de l’inventaire… » et aucun 0 dans les relevés', async () => {
  api.lireInventaireAudio.mockImplementation(jamais)
  api.lireProduitsSansIllustration.mockImplementation(jamais)
  afficher()
  await screen.findByText(/Pas encore de quoi trancher/)
  expect(screen.getAllByText('Lecture de l’inventaire…')).toHaveLength(3)
  const releves = screen.getByRole('region', { name: 'Couverture' })
  expect(within(releves).queryByText('0')).not.toBeInTheDocument()
})

test('une portée refusée : son relevé le dit, les écoutes restent', async () => {
  api.lireInventaireAudio.mockRejectedValue(new AccesShopifyRefuse('Required access: `read_metaobjects` access scope.'))
  afficher()
  expect(await screen.findAllByText('Inventaire indisponible : la portée read_metaobjects manque à l’app Shopify.')).toHaveLength(2)
  expect(screen.getByText('loup')).toBeInTheDocument()
  expect(await screen.findByText('Pendentif seul')).toBeInTheDocument()
})

test('une erreur de lireEcoutes : son message', async () => {
  api.lireEcoutes.mockRejectedValue(new Error('permission denied'))
  afficher()
  expect(await screen.findByRole('alert')).toHaveTextContent('Lecture des écoutes impossible : permission denied')
  expect(await screen.findByText('La Muette')).toBeInTheDocument()
})

test('la couverture : sans voix off, jamais écoutés, produits muets', async () => {
  afficher()
  expect(await screen.findByText('La Muette')).toBeInTheDocument()
  expect(screen.getByText('L’Ours')).toBeInTheDocument()
  expect(screen.getByText('Pendentif seul')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Illustrations sans voix off' })).toHaveTextContent('1')
})

test('par Fragment : le nom de l’inventaire, les mesures, « à confirmer » sous 20 écoutes', async () => {
  afficher()
  const ligneDuLoup = (await screen.findByText('Le Loup', { selector: 'strong' })).closest('div')
  expect(ligneDuLoup).toHaveTextContent('12 écoutes · 1 au bout')
  expect(ligneDuLoup).toHaveTextContent('50 % · à confirmer')
  expect(ligneDuLoup).toHaveTextContent('40 % du récit')
  expect(ligneDuLoup).toHaveTextContent('11 motif · 1 produit')
  expect(ligneDuLoup).toHaveTextContent('12/10/2026')
})

test('progression absente ou partielle', async () => {
  api.lireEcoutes.mockResolvedValue([ligne('a', 5, { progression: null, mesurables: 0 }), ligne('b', 5, { mesurables: 3 })])
  afficher()
  expect(await screen.findByText('pas encore mesurée')).toBeInTheDocument()
  expect(screen.getByText('40 % du récit · 3/5 mesurées')).toBeInTheDocument()
})
