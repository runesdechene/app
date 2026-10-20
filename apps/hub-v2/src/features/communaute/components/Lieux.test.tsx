import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Lieux } from './Lieux'
import { TiroirLieu } from './TiroirLieu'

const api = vi.hoisted(() => ({
  lireLieux: vi.fn(), lireLieu: vi.fn(), lireNatures: vi.fn(), modifierLieu: vi.fn(),
  changerNatures: vi.fn(), verifierLieu: vi.fn(), masquerLieu: vi.fn(), retirerPhoto: vi.fn(),
}))
vi.mock('../api/lieux', () => api)

const ligne = { id: 'p1', title: 'Dolmen de la Pierre Levée', address: 'Aude', masked: false, sensible: false, created_at: '2026-10-14T09:02:00Z',
  verified_at: null, author_name: 'Luna', verified_by_name: null, photo_count: 3, thumb_url: null, visit_count: 0,
  tags: [{ id: 'dolmens', title: 'Dolmens et mégalithes', color: '#fff', background: '#a94842', is_primary: true }] }

function monter(adresse: string) {
  const client = new QueryClient()
  const router = createMemoryRouter(
    [{ path: '/communaute/lieux', Component: Lieux, children: [{ path: ':id', Component: TiroirLieu }] }],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return Object.assign(client, { router })
}

test('par défaut : à modérer', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  monter('/communaute/lieux')
  expect(await screen.findByRole('link', { name: /Dolmen de la Pierre Levée/ })).toHaveAttribute('href', '/communaute/lieux/p1')
  expect(api.lireLieux).toHaveBeenCalledWith(expect.objectContaining({ filtre: 'a_moderer' }))
})

test('masquer un lieu rafraîchit la liste et la pastille', async () => {
  api.lireLieux.mockResolvedValueOnce({ total: 1, rows: [ligne] }).mockResolvedValue({ total: 0, rows: [] })
  api.lireNatures.mockResolvedValue([{ id: 'dolmens', title: 'Dolmens et mégalithes', color: '#fff', background: '#a94842' }])
  api.lireLieu.mockResolvedValue({ ...ligne, text: 'Un dolmen.', photos: [], visit_count: 0, discovered_count: 2, author_places_count: 31 })
  api.masquerLieu.mockResolvedValue(undefined)
  const client = monter('/communaute/lieux/p1')
  const invalider = vi.spyOn(client, 'invalidateQueries')
  await userEvent.click(await screen.findByRole('button', { name: 'Masquer le lieu' }))
  expect(api.masquerLieu).toHaveBeenCalledWith('p1', true)
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-lieux'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-lieu', 'p1'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-signalements'] })
  expect(await screen.findByText('Aucun lieu ne correspond.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Dolmen de la Pierre Levée/ })).not.toBeInTheDocument()
})

test('« Retirer » une photo demande confirmation, seul « Confirmer » la retire', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  api.lireNatures.mockResolvedValue([])
  api.lireLieu.mockResolvedValue({ ...ligne, text: 'Un dolmen.', discovered_count: 2, author_places_count: 31,
    photos: [{ url: 'https://x/1.webp', vignette: 'https://x/1.webp' }, { url: 'https://x/2.webp', vignette: 'https://x/2.webp' }] })
  api.retirerPhoto.mockResolvedValue(undefined)
  monter('/communaute/lieux/p1')
  const retirer = await screen.findAllByRole('button', { name: 'Retirer la photo' })
  await userEvent.click(retirer[1] as HTMLElement)
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(api.retirerPhoto).not.toHaveBeenCalled()
  await userEvent.click((await screen.findAllByRole('button', { name: 'Retirer la photo' }))[1] as HTMLElement)
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(api.retirerPhoto).toHaveBeenCalledWith('p1', 'https://x/2.webp')
})

test('un nom vide : pas d’enregistrement', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  api.lireNatures.mockResolvedValue([])
  api.lireLieu.mockResolvedValue({ ...ligne, text: 'Un dolmen.', photos: [], discovered_count: 2, author_places_count: 31 })
  monter('/communaute/lieux/p1')
  await userEvent.clear(await screen.findByRole('textbox', { name: 'Nom' }))
  expect(screen.getByText('Le nom ne peut pas être vide.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enregistrer le texte' })).toBeDisabled()
})

test('un lieu inconnu : le tiroir le dit', async () => {
  api.lireLieux.mockResolvedValue({ total: 0, rows: [] })
  api.lireNatures.mockResolvedValue([])
  api.lireLieu.mockResolvedValue(null)
  monter('/communaute/lieux/zzz')
  expect(await screen.findByText('Lieu introuvable.')).toBeInTheDocument()
})

test('une erreur de la base s’affiche sous son bloc', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  api.lireNatures.mockResolvedValue([])
  api.lireLieu.mockResolvedValue({ ...ligne, text: 'Un dolmen.', photos: [], discovered_count: 2, author_places_count: 31 })
  api.verifierLieu.mockRejectedValue(new Error('Réservé à l’équipe'))
  monter('/communaute/lieux/p1')
  await userEvent.click(await screen.findByRole('button', { name: 'Vérifier le lieu' }))
  expect(await screen.findByText('Réservé à l’équipe')).toBeInTheDocument()
})

test('ouvrir une fiche garde le filtre et la page, la fermer y ramène', async () => {
  api.lireLieux.mockResolvedValue({ total: 500, rows: [ligne] })
  api.lireNatures.mockResolvedValue([])
  api.lireLieu.mockResolvedValue(null)
  const { router } = monter('/communaute/lieux?filtre=verifies&page=3')
  await userEvent.click(await screen.findByRole('link', { name: /Dolmen de la Pierre Levée/ }))
  expect(router.state.location.pathname).toBe('/communaute/lieux/p1')
  expect(router.state.location.search).toBe('?filtre=verifies&page=3')
  await userEvent.click(await screen.findByRole('link', { name: '✕ Fermer' }))
  expect(router.state.location.pathname).toBe('/communaute/lieux')
  expect(router.state.location.search).toBe('?filtre=verifies&page=3')
})
