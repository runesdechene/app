import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirTitre } from './TiroirTitre'

const mockFrom = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { from: mockFrom } }))

const chemin = { id: 1, name: 'Compagnon', name_f: null, description: 'Niveau 5.', icon: '⚜️', type: 'general', condition: { stat: 'level', min: 5 }, order: 4 }
const connaissance = { id: 2, name: 'Sage nordique', name_f: 'Sage nordique', description: null, icon: null, type: 'general', condition: { stat: 'connaissance', theme: 'nordique', palier: 3 }, order: 9 }

function monter(adresse: string) {
  const lecture = { order: () => lecture, then: (ok: (v: unknown) => void) => { ok({ data: [chemin, connaissance], error: null }) } }
  mockFrom.mockReturnValue({
    select: () => lecture,
    insert: mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 3 }, error: null }) }) }),
    update: mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
    delete: mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
  })
  const router = createMemoryRouter([
    { path: '/jeu/titres', children: [{ path: 'nouveau', Component: TiroirTitre }, { path: ':id', Component: TiroirTitre }] },
  ], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => { vi.clearAllMocks() })

test('une connaissance : ni chemin ni seuil, la condition en lecture, et rien de tel n’est envoyé', async () => {
  monter('/jeu/titres/2')
  expect(await screen.findByText('Connaissance nordique, palier 3')).toBeInTheDocument()
  expect(screen.queryByLabelText('Chemin')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Seuil')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Description'), 'Un sage.')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Sage nordique', name_f: 'Sage nordique', description: 'Un sage.', icon: null })
})

test('un titre de chemin enregistre { stat, min }', async () => {
  monter('/jeu/titres/1')
  await userEvent.selectOptions(await screen.findByLabelText('Chemin'), 'places_added')
  const seuil = screen.getByLabelText('Seuil')
  await userEvent.clear(seuil)
  await userEvent.type(seuil, '12')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(mockUpdate).toHaveBeenCalledWith({
    name: 'Compagnon', name_f: null, description: 'Niveau 5.', icon: '⚜️', condition: { stat: 'places_added', min: 12 },
  })
})

test('un seuil négatif est refusé avant l’envoi', async () => {
  monter('/jeu/titres/1')
  const seuil = await screen.findByLabelText('Seuil')
  await userEvent.clear(seuil)
  await userEvent.type(seuil, '-2')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Le seuil est un nombre entier, zéro ou plus.')
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('création : un titre de chemin, ordre = maximum + 1', async () => {
  const router = monter('/jeu/titres/nouveau')
  await userEvent.type(await screen.findByLabelText('Nom'), 'Marcheur')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(mockInsert).toHaveBeenCalledWith({
    name: 'Marcheur', name_f: null, description: null, icon: null, condition: { stat: 'level', min: 0 }, type: 'general', order: 10,
  })
  await vi.waitFor(() => { expect(router.state.location.pathname).toBe('/jeu/titres/3') })
})

test('la suppression demande confirmation ; annuler n’efface rien', async () => {
  const router = monter('/jeu/titres/1')
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  expect(screen.getByText('Supprimer ce titre ?')).toBeInTheDocument()
  expect(mockDelete).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(screen.queryByText('Supprimer ce titre ?')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(mockDelete).toHaveBeenCalled()
  await vi.waitFor(() => { expect(router.state.location.pathname).toBe('/jeu/titres') })
})

test('l’erreur de la base à la suppression s’affiche', async () => {
  monter('/jeu/titres/1')
  await screen.findByLabelText('Nom')
  mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: { message: 'violates foreign key' } }) })
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('violates foreign key')
})

test('un numéro invalide ou inconnu : introuvable', async () => {
  monter('/jeu/titres/abc')
  expect(await screen.findByText('Titre introuvable.')).toBeInTheDocument()
})
