import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirCompte } from './TiroirCompte'

const mockUseCompte = vi.hoisted(() => vi.fn())
const mockChanger = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useCompte', async (orig) => ({ ...(await orig<typeof import('../hooks/useCompte')>()), useCompte: mockUseCompte }))
vi.mock('../api/comptes', async (orig) => ({ ...(await orig<typeof import('../api/comptes')>()), changerRole: mockChanger }))

const fiche = {
  id: 'u1', nom: 'Kelpie', email: 'k@x.fr', avatar: null, role: 'user', provenance: 'flyer', inscrit: '2026-10-14T09:00:00Z',
  derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:00:00Z', client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2,
  compteurs: { decouverts: 12, visites: 4, ajoutes: 0, enigmes: 3 },
}

function monter() {
  const router = createMemoryRouter(
    [{ path: '/communaute/comptes', element: <p>La liste</p> }, { path: '/communaute/comptes/:id', Component: TiroirCompte }],
    { initialEntries: ['/communaute/comptes/u1'] },
  )
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
}

test('la fiche : identité, balises, parcours, compteurs', () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [{ id: 7, nom: 'Hoplite', image: null, source: 'shopify', quand: '2026-10-14T10:00:00Z' }], achats: [], traces: [] }, isPending: false })
  monter()
  expect(screen.getByRole('dialog', { name: 'Kelpie' })).toBeInTheDocument()
  expect(screen.getByText('Porteur')).toBeInTheDocument()
  expect(screen.getByText('Seine-et-Marne (77)')).toBeInTheDocument()
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
})

test('un compte inconnu : « Compte introuvable » et un lien vers la liste', () => {
  mockUseCompte.mockReturnValue({ data: null, isPending: false })
  monter()
  expect(screen.getByText('Compte introuvable.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la liste' })).toHaveAttribute('href', '/communaute/comptes')
})

test('choisir un rôle au clavier n’écrit rien : seul « Changer » appelle changer_role', async () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [], achats: [], traces: [] }, isPending: false })
  mockChanger.mockResolvedValue(undefined)
  monter()
  expect(screen.getByRole('button', { name: 'Changer' })).toBeDisabled()
  const choix = screen.getByRole('combobox', { name: 'Rôle' })
  choix.focus()
  await userEvent.keyboard('{ArrowDown}')
  await userEvent.selectOptions(choix, 'ambassador')
  await userEvent.selectOptions(choix, 'moderator')
  expect(mockChanger).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Changer' }))
  expect(mockChanger).toHaveBeenCalledWith('u1', 'moderator')
})

test('faire un admin demande une confirmation, et Annuler n’écrit rien', async () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [], achats: [], traces: [] }, isPending: false })
  mockChanger.mockResolvedValue(undefined)
  monter()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rôle' }), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Changer' }))
  expect(screen.getByText('Faire de Kelpie un admin ?')).toBeInTheDocument()
  expect(mockChanger).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(screen.queryByText('Faire de Kelpie un admin ?')).not.toBeInTheDocument()
  expect(mockChanger).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Changer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(mockChanger).toHaveBeenCalledWith('u1', 'admin')
})

test('une lecture en échec : message, Réessayer, retour — pas « introuvable »', async () => {
  const refetch = vi.fn()
  mockUseCompte.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch })
  monter()
  expect(screen.getByText('La fiche n’a pas pu être lue.')).toBeInTheDocument()
  expect(screen.queryByText('Compte introuvable.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la liste' })).toHaveAttribute('href', '/communaute/comptes')
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(refetch).toHaveBeenCalled()
})

test('un changement de rôle refusé : le message de la base s’affiche', async () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [], achats: [], traces: [] }, isPending: false })
  mockChanger.mockRejectedValue(new Error('Tu ne peux pas changer ton propre rôle'))
  monter()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rôle' }), 'moderator')
  await userEvent.click(screen.getByRole('button', { name: 'Changer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Tu ne peux pas changer ton propre rôle')
})

test('une trace d’énigme se lit « a percé l’énigme n° 295 »', () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [], achats: [], traces: [{ type: 'enigme', quand: '2026-10-14T10:00:00Z', texte: 'Énigme n° 295' }] }, isPending: false })
  monter()
  expect(screen.getByText(/a percé l’énigme n° 295/)).toBeInTheDocument()
})
