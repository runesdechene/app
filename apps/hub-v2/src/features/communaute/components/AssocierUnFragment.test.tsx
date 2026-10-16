import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { AssocierUnFragment } from './AssocierUnFragment'

const m = vi.hoisted(() => ({ comptes: vi.fn(), compte: vi.fn() }))
vi.mock('../api/comptes', () => ({ lireComptes: m.comptes, lireCompte: m.compte }))
vi.mock('../api/fragmentsDuCompte', () => ({
  lireFragmentsAssociables: () => Promise.resolve([]), associerFragment: vi.fn(), retirerFragment: vi.fn(),
}))

const kelpie = { id: 'u1', nom: 'Kelpie', email: 'k@exemple.fr', avatar: null, fragments: 2 }

function monter(adresse: string) {
  const router = createMemoryRouter([{ path: '/boutique/associer', Component: AssocierUnFragment }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
}

test('sans recherche, aucune liste ; une recherche montre les Explorateurs trouvés', async () => {
  m.comptes.mockResolvedValue({ lignes: [kelpie] })
  monter('/boutique/associer')
  expect(m.comptes).not.toHaveBeenCalled()
  await userEvent.type(await screen.findByRole('searchbox'), 'kel')
  expect(await screen.findByRole('link', { name: /Kelpie/ })).toHaveTextContent('2 Fragments')
  expect(m.comptes).toHaveBeenCalledWith(expect.objectContaining({ recherche: 'kel', limite: 8 }))
})

test('un Explorateur choisi montre ses Fragments et le choix d’en associer un', async () => {
  m.compte.mockResolvedValue({ ...kelpie, fragments: [{ id: 7, nom: 'Hoplite', image: null, source: 'manual', quand: null }] })
  monter('/boutique/associer?q=kel&compte=u1')
  expect(await screen.findByText('Hoplite')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Fragment à associer' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Choisir un autre Explorateur' })).toHaveAttribute('href', '/boutique/associer?q=kel')
})
