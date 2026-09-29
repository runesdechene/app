/**
 * QUOI     — l'étape « Où » : la carte part de la position de la photo ; l'endroit se dit en
 *            mots ; un lieu voisin se signale ; chercher un village y emmène ; « C'est ici » garde
 *            le point et avance — seulement sur place (200 m au plus de moi).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { EtapeLieu } from './EtapeLieu'

const api = vi.hoisted(() => ({ fetchVoisins: vi.fn() }))
vi.mock('../api/ajout', () => api)
const geocodeur = vi.hoisted(() => ({ endroitDe: vi.fn(), chercherEndroits: vi.fn() }))
vi.mock('../lib/adresse', () => geocodeur)
const position = vi.hoisted(() => ({ positionSiAutorisee: vi.fn() }))
vi.mock('@/shared/lib/position', () => position)

const brouillon: Brouillon = {
  ...BROUILLON_VIDE,
  etape: 'lieu',
  photos: [{ id: 'p1', grande: new Blob(), vignette: new Blob() }],
  positionPhoto: { latitude: 43.76, longitude: 7.22 },
}
const changer = vi.fn()
const suivant = vi.fn()

beforeEach(() => {
  changer.mockReset()
  suivant.mockReset()
  api.fetchVoisins.mockResolvedValue([])
  position.positionSiAutorisee.mockResolvedValue(null)
  geocodeur.endroitDe.mockResolvedValue({
    titre: 'Près de Colomars',
    detail: 'Alpes-Maritimes',
    adresse: 'Colomars',
  })
  geocodeur.chercherEndroits.mockResolvedValue([
    { nom: 'Gattières', contexte: 'Alpes-Maritimes', point: { latitude: 43.76, longitude: 7.17 } },
  ])
})

function monter(b: Brouillon = brouillon) {
  const router = createMemoryRouter(
    [{ path: '*', element: <EtapeLieu brouillon={b} changer={changer} onSuivant={suivant} /> }],
    { initialEntries: ['/carte/ajouter/lieu/lieu'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('la carte part de la position de la photo, et le dit', async () => {
  monter()
  expect(await screen.findByText('Placé d’après ta photo')).toBeInTheDocument()
  expect(await screen.findByText('Près de Colomars')).toBeInTheDocument()
  expect(geocodeur.endroitDe).toHaveBeenCalledWith(
    { latitude: 43.76, longitude: 7.22 },
    expect.anything(),
  )
})

test('un lieu voisin se signale, avec sa distance', async () => {
  api.fetchVoisins.mockResolvedValue([
    { id: 'l9', nom: 'Chapelle Saint-Roch', metres: 40, type: null },
  ])
  monter()
  expect(await screen.findByText('Chapelle Saint-Roch est à 40 m')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /C’est le même lieu/ })).toBeInTheDocument()
})

test('chercher un village y emmène la carte', async () => {
  monter()
  await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher un endroit' }), 'Gattières')
  await userEvent.click(await screen.findByRole('button', { name: /Gattières/ }))
  expect(FausseCarte.derniere?.flyTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: [7.17, 43.76] }),
  )
})

test('loin du point, « C’est ici » attend : on ajoute sur place', async () => {
  position.positionSiAutorisee.mockResolvedValue({ latitude: 48.85, longitude: 2.35 })
  monter()
  await screen.findByText('Près de Colomars')
  expect(await screen.findByText(/rapproche le point de toi/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'C’est ici' })).toBeDisabled()
})

test('« C’est ici » garde le point où la carte s’est posée, et son adresse', async () => {
  // Je suis là où la carte se pose (la fausse carte rend toujours le centre de la France).
  position.positionSiAutorisee.mockResolvedValue({ latitude: 46.6, longitude: 2.4 })
  monter()
  await screen.findByText('Près de Colomars')
  // La carte glisse puis se pose.
  act(() => {
    FausseCarte.derniere?.emettre('moveend', { originalEvent: {} })
  })
  await waitFor(() => {
    expect(geocodeur.endroitDe).toHaveBeenLastCalledWith(
      { latitude: 46.6, longitude: 2.4 },
      expect.anything(),
    )
  })
  await screen.findByText('Tu es sur place : ta visite comptera aussi.')
  await userEvent.click(screen.getByRole('button', { name: 'C’est ici' }))
  expect(changer).toHaveBeenCalledWith(
    expect.objectContaining({ point: { latitude: 46.6, longitude: 2.4 } }),
  )
  expect(suivant).toHaveBeenCalled()
})
