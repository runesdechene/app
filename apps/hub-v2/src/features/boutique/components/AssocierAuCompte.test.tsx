import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { Contribution } from '../api/contributions'
import type { Fragment } from '../api/fragments'
import { fragmentDuProduit } from '../lib/fragmentDuProduit'
import { AssocierAuCompte } from './AssocierAuCompte'

const m = vi.hoisted(() => ({ lire: vi.fn(), associer: vi.fn() }))
vi.mock('../api/fragments', () => ({ lireFragments: m.lire, associerAuCompte: m.associer }))

const fragment = (id: number, name: string): Fragment => ({
  id, name, link_url: null, visible: true, shopify_handle: null, resume: null, histoire: null, illustration_url: null,
  image_url: null, illustration_sombre_url: null, audio_url: null, artiste: null, narrateur: null, heritage: null,
  synchronise_le: null, origine_lat: null, origine_lng: null, origine_nom: null, theme: null,
})
const fragments = [fragment(1, 'Hoplite'), fragment(2, 'Yggdrasil')]
const contribution = (compte: string | null): Contribution => ({
  id: 'c1', quand: null, statut: 'pending', nom: 'Laure', email: null, instagram: null, role: 'client', compte, lieu: null,
  code_postal: null, departement: null, message: null, note_equipe: null, taille: null, produit: 'T-shirt Yggdrasil',
  hauteur: null, epaules: null, note_experience: null, note_produits: null, diffusion: false, recompensee_le: null,
  images: [], etiquettes: [],
})

function monter(c: Contribution) {
  render(<QueryClientProvider client={new QueryClient()}><AssocierAuCompte contribution={c} /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  m.lire.mockResolvedValue(fragments)
})

test('le Fragment se devine d’après le produit porté', () => {
  expect(fragmentDuProduit(fragments, 'T-shirt Yggdrasil')?.name).toBe('Yggdrasil')
  expect(fragmentDuProduit(fragments, 'Casquette')).toBeUndefined()
  expect(fragmentDuProduit(fragments, null)).toBeUndefined()
})

test('sans compte dans l’appli, le bouton est désactivé et dit pourquoi', () => {
  monter(contribution(null))
  const bouton = screen.getByRole('button', { name: 'Associer un Fragment' })
  expect(bouton).toBeDisabled()
  expect(bouton).toHaveAttribute('title', 'Pas de compte dans l’appli')
})

test('la fenêtre s’ouvre sur le Fragment du produit ; Valider l’associe au compte', async () => {
  m.associer.mockResolvedValue(undefined)
  monter(contribution('u7'))
  await userEvent.click(screen.getByRole('button', { name: 'Associer un Fragment' }))
  expect(screen.getByRole('dialog', { name: 'Associer un Fragment à Laure' })).toBeInTheDocument()
  expect(await screen.findByRole('option', { name: 'Yggdrasil', selected: true })).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fragment' }), 'Hoplite')
  await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
  expect(m.associer).toHaveBeenCalledWith('u7', 1)
  expect(await screen.findByRole('status')).toHaveTextContent('Hoplite est associé au compte de Laure.')
})
