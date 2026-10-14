import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Signalements } from './Signalements'

const sig = vi.hoisted(() => ({ lireSignalements: vi.fn(), traiterSignalement: vi.fn() }))
const lieux = vi.hoisted(() => ({ lireLieu: vi.fn(), masquerLieu: vi.fn() }))
vi.mock('../api/signalements', () => sig)
vi.mock('../api/lieux', async (orig) => ({ ...(await orig<typeof import('../api/lieux')>()), ...lieux }))

const s1 = { id: 41, raison: 'prive_ou_dangereux', precision: 'Propriété privée, chien.', quand: '2026-10-14T09:40:00Z', lieu: { id: 'p9', nom: 'Source de la Fée', masque: false }, qui: { id: 'u5', nom: 'Brune' } }
const s2 = { ...s1, id: 42, raison: 'doublon', precision: null, lieu: { id: 'p3', nom: 'Dolmen', masque: true } }

function monter(adresse = '/communaute/signalements') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/communaute/signalements', Component: Signalements }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return client
}

test('la file, le premier choisi, sa raison lisible', async () => {
  sig.lireSignalements.mockResolvedValue([s1])
  lieux.lireLieu.mockResolvedValue({ id: 'p9', title: 'Source de la Fée', images: [], masked: false })
  monter()
  expect(await screen.findAllByText('Source de la Fée')).not.toHaveLength(0)
  expect(screen.getAllByText('Lieu privé ou dangereux')).not.toHaveLength(0)
  expect(screen.getByText('« Propriété privée, chien. »')).toBeInTheDocument()
})

test('« Traité » retire le signalement et fait baisser la pastille', async () => {
  sig.lireSignalements.mockResolvedValue([s1])
  sig.traiterSignalement.mockResolvedValue(undefined)
  lieux.lireLieu.mockResolvedValue({ id: 'p9', title: 'Source de la Fée', images: [], masked: false })
  const client = monter()
  const invalider = vi.spyOn(client, 'invalidateQueries')
  await userEvent.click(await screen.findByRole('button', { name: 'Traité' }))
  expect(sig.traiterSignalement).toHaveBeenCalledWith(41)
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-signalements'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
})

test('file vide : on le dit', async () => {
  sig.lireSignalements.mockResolvedValue([])
  monter()
  expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
})

test('la sélection est dans l’adresse ; masquer est absent si le lieu l’est déjà', async () => {
  sig.lireSignalements.mockResolvedValue([s1, s2])
  lieux.lireLieu.mockResolvedValue({ id: 'p3', title: 'Dolmen', images: [], masked: true })
  monter('/communaute/signalements?s=42')
  expect(await screen.findByRole('button', { name: 'Traité' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Masquer le lieu' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Source de la Fée/ }))
  expect(await screen.findByRole('button', { name: 'Masquer le lieu' })).toBeInTheDocument()
})

test('« Masquer le lieu » masque le lieu du signalement', async () => {
  sig.lireSignalements.mockResolvedValue([s1])
  lieux.masquerLieu.mockResolvedValue(undefined)
  lieux.lireLieu.mockResolvedValue({ id: 'p9', title: 'Source de la Fée', images: [], masked: false })
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Masquer le lieu' }))
  expect(lieux.masquerLieu).toHaveBeenCalledWith('p9', true)
})

test('lecture en échec : le vrai message', async () => {
  sig.lireSignalements.mockRejectedValue(new Error('Réservé à l’équipe'))
  monter()
  expect(await screen.findByText('Réservé à l’équipe')).toBeInTheDocument()
})
