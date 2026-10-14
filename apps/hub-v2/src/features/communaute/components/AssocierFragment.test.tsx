import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AssocierFragment } from './AssocierFragment'

const m = vi.hoisted(() => ({ lire: vi.fn(), associer: vi.fn(), retirer: vi.fn() }))
vi.mock('../api/fragmentsDuCompte', () => ({
  lireFragmentsAssociables: m.lire, associerFragment: m.associer, retirerFragment: m.retirer,
}))

const fragments = [{ id: 7, nom: 'Hoplite', image: null, source: 'shopify', quand: '2026-10-14T10:00:00Z' }]

beforeEach(() => {
  vi.clearAllMocks()
  m.lire.mockResolvedValue([{ id: 7, nom: 'Hoplite', image: null }, { id: 9, nom: 'Kelpie', image: null }])
})

function monter() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <AssocierFragment compte="u1" fragments={fragments} />
  </QueryClientProvider>)
}

test('le choix n’offre que les Fragments que le compte n’a pas ; Associer appelle la base', async () => {
  m.associer.mockResolvedValue(undefined)
  monter()
  const choix = await screen.findByRole('combobox', { name: 'Fragment à associer' })
  expect(await screen.findByRole('option', { name: 'Kelpie' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Hoplite' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Associer' })).toBeDisabled()
  await userEvent.selectOptions(choix, 'Kelpie')
  await userEvent.click(screen.getByRole('button', { name: 'Associer' }))
  expect(m.associer).toHaveBeenCalledWith('u1', 9)
})

test('Retirer demande « Retirer Hoplite ? » ; seul Confirmer écrit', async () => {
  m.retirer.mockResolvedValue(undefined)
  monter()
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  expect(screen.getByText('Retirer Hoplite ?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(m.retirer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(m.retirer).toHaveBeenCalledWith('u1', 7)
})

test('l’erreur de la base s’affiche', async () => {
  m.associer.mockRejectedValue(new Error('Compte introuvable'))
  monter()
  await screen.findByRole('option', { name: 'Kelpie' })
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fragment à associer' }), 'Kelpie')
  await userEvent.click(screen.getByRole('button', { name: 'Associer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Compte introuvable')
})
