import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Achat } from '../api/achats'
import { Achats } from './Achats'

const api = vi.hoisted(() => ({
  lireAchats: vi.fn(),
  associerAchat: vi.fn(),
  classerAchat: vi.fn(),
  lireFragments: vi.fn(),
}))
vi.mock('../api/achats', () => ({ lireAchats: api.lireAchats, associerAchat: api.associerAchat, classerAchat: api.classerAchat }))
vi.mock('../api/fragments', () => ({ lireFragments: api.lireFragments }))

const achat = (id: number, surcharge: Partial<Achat> = {}): Achat => ({
  id, quand: '2026-10-10T10:00:00Z', statut: 'no_match', email: `a${String(id)}@x.fr`, commande: String(1000 + id),
  tag: 'tags_found:folklore,yggdrasil|no_unlock_match', fragment: null, compte: { id: 'u1', nom: 'Aëlis' }, ...surcharge,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.lireFragments.mockResolvedValue([{ id: 7, name: 'Hoplite' }, { id: 8, name: 'Loup' }])
  api.associerAchat.mockResolvedValue(undefined)
  api.classerAchat.mockResolvedValue(undefined)
})

function afficher(achats: Achat[], adresse = '/boutique/fragments/achats') {
  api.lireAchats.mockResolvedValue(achats)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalider = vi.spyOn(client, 'invalidateQueries')
  const router = createMemoryRouter([{ path: '/boutique/fragments/achats', Component: Achats }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return invalider
}

test('une ligne no_match montre ses étiquettes, son compte et ses deux gestes', async () => {
  afficher([achat(41)])
  expect(await screen.findByText(/Commande n° 1041/)).toBeInTheDocument()
  expect(screen.getByText('folklore')).toBeInTheDocument()
  expect(screen.getByText('yggdrasil')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Aëlis' })).toHaveAttribute('href', '/communaute/comptes/u1')
  expect(screen.getByRole('button', { name: 'Associer un Fragment' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rien à débloquer' })).toBeInTheDocument()
})

test('« Rien à débloquer » classe l’achat et rafraîchit la file, l’ouverture et les comptes', async () => {
  const invalider = afficher([achat(41)])
  await userEvent.click(await screen.findByRole('button', { name: 'Rien à débloquer' }))
  await waitFor(() => { expect(api.classerAchat).toHaveBeenCalledWith(41) })
  await waitFor(() => {
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-achats'] })
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-compte'] })
  })
})

test('« Associer un Fragment » envoie le Fragment choisi', async () => {
  afficher([achat(41)])
  const associer = await screen.findByRole('button', { name: 'Associer un Fragment' })
  expect(associer).toBeDisabled()
  await screen.findByRole('option', { name: 'Loup' })
  await userEvent.selectOptions(screen.getByLabelText('Fragment à associer'), 'Loup')
  await userEvent.click(associer)
  await waitFor(() => { expect(api.associerAchat).toHaveBeenCalledWith(41, 8) })
})

test('un no_match sans compte n’a que « Rien à débloquer »', async () => {
  afficher([achat(42, { compte: null })])
  expect(await screen.findByText('aucun compte')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Associer un Fragment' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rien à débloquer' })).toBeInTheDocument()
})

test('un achat pending attend son inscription, sans geste', async () => {
  afficher([achat(43, { statut: 'pending', tag: 'fragment:hoplite' }), achat(44)], '/boutique/fragments/achats?statut=pending')
  expect(await screen.findByText('Attend son inscription')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Associer un Fragment' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Rien à débloquer' })).not.toBeInTheDocument()
})

test('l’erreur de la base s’affiche telle quelle', async () => {
  api.classerAchat.mockRejectedValue(new Error('Cet achat n’attend pas d’association'))
  afficher([achat(41)])
  await userEvent.click(await screen.findByRole('button', { name: 'Rien à débloquer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cet achat n’attend pas d’association')
})

test('rien à traiter : on le dit', async () => {
  afficher([])
  expect(await screen.findByText('Aucun achat n’attend.')).toBeInTheDocument()
})
