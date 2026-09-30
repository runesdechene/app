/**
 * QUOI     — l'aperçu : la fiche telle qu'elle paraîtra ; toucher une partie ramène à son étape ;
 *            « Poser le lieu » envoie les photos puis crée le lieu ; un refus se dit clairement.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { EtapeApercu } from './EtapeApercu'

const api = vi.hoisted(() => ({
  fetchNatures: vi.fn(),
  fetchEpoques: vi.fn(),
  envoyerPhotos: vi.fn(),
  ajouterLieu: vi.fn(),
}))
vi.mock('../api/ajout', () => api)
vi.mock('@/shared/supabase/photos', () => ({ envoyerPhotos: api.envoyerPhotos }))
const stockage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }))
vi.mock('idb-keyval', () => stockage)
vi.mock('@/shared/lib/position', () => ({ positionSiAutorisee: () => Promise.resolve(null) }))

const brouillon: Brouillon = {
  ...BROUILLON_VIDE,
  etape: 'apercu',
  photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
  point: { latitude: 43.76, longitude: 7.22 },
  endroit: { titre: 'Près de Colomars', detail: 'Alpes-Maritimes', adresse: 'Colomars' },
  nom: 'Château de Colomars',
  natures: ['chateau', 'ruines'],
  epoque: 'late-middle-ages',
  recit: 'Une tour carrée du XIIᵉ siècle.',
}
const aller = vi.fn()
const pose = vi.fn()

beforeEach(() => {
  aller.mockReset()
  pose.mockReset()
  stockage.del.mockReset()
  api.fetchNatures.mockResolvedValue([
    { id: 'chateau', nom: 'Châteaux & fortins', icone: null, couleur: '#a9260f' },
    { id: 'ruines', nom: 'Ruines et vestiges', icone: null, couleur: '#745744' },
  ])
  api.fetchEpoques.mockResolvedValue([{ id: 'late-middle-ages', nom: 'Bas Moyen Âge' }])
  api.envoyerPhotos.mockResolvedValue([{ id: 'p1', url: 'u', thumb: 't' }])
  api.ajouterLieu.mockResolvedValue({
    id: 'l1',
    rang: 17,
    surPlace: false,
    gain: 8,
    niveau: 12,
    avant: 0.6,
    apres: 0.7,
  })
})

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EtapeApercu brouillon={brouillon} onAller={aller} onPose={pose} />
    </QueryClientProvider>,
  )
}

test('la fiche telle qu’elle paraîtra : nom, nature, époque, endroit, récit', async () => {
  monter()
  expect(screen.getByRole('heading', { name: 'Château de Colomars' })).toBeInTheDocument()
  expect(await screen.findByText('Châteaux & fortins')).toBeInTheDocument()
  expect(await screen.findByText('Bas Moyen Âge · Ruines et vestiges')).toBeInTheDocument()
  expect(screen.getByText('Près de Colomars, Alpes-Maritimes')).toBeInTheDocument()
  expect(screen.getByText('Une tour carrée du XIIᵉ siècle.')).toBeInTheDocument()
})

test('toucher une partie ramène à son étape', async () => {
  monter()
  await userEvent.click(screen.getByRole('button', { name: /Retoucher le récit/ }))
  expect(aller).toHaveBeenCalledWith('recit')
  await userEvent.click(screen.getByRole('button', { name: /Retoucher le nom/ }))
  expect(aller).toHaveBeenCalledWith('nom')
})

test('« Poser le lieu » envoie les photos, puis crée le lieu', async () => {
  monter()
  await userEvent.click(screen.getByRole('button', { name: 'Poser le lieu sur la carte' }))
  await vi.waitFor(() => {
    expect(pose).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', rang: 17 }))
  })
  expect(api.envoyerPhotos).toHaveBeenCalledWith(brouillon.photos)
  expect(stockage.del).toHaveBeenCalled() // le brouillon est jeté : le lieu est posé
})

test('trois découvertes manquent : on le dit, sans jargon', async () => {
  api.ajouterLieu.mockRejectedValue({ message: 'Trois découvertes d’abord', hint: 'decouvertes' })
  monter()
  await userEvent.click(screen.getByRole('button', { name: 'Poser le lieu sur la carte' }))
  expect(await screen.findByText(/Découvre d’abord trois lieux sur la carte/)).toBeInTheDocument()
  expect(pose).not.toHaveBeenCalled()
})

test('plafond du jour ou fiche refusée : chacun sa phrase', async () => {
  api.ajouterLieu.mockRejectedValueOnce({ message: 'Vingt lieux', hint: 'limite' })
  monter()
  const poser = screen.getByRole('button', { name: 'Poser le lieu sur la carte' })
  await userEvent.click(poser)
  expect(await screen.findByText(/Vingt lieux posés aujourd’hui/)).toBeInTheDocument()

  api.ajouterLieu.mockRejectedValueOnce({ message: 'Un nom', code: '22023' })
  await userEvent.click(poser)
  expect(await screen.findByText(/Un détail de la fiche ne passe pas/)).toBeInTheDocument()

  expect(stockage.del).not.toHaveBeenCalled()
})
