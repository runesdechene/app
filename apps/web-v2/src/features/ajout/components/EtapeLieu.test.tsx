/**
 * QUOI     — l'étape « Où » : la carte part de la position de la photo ; l'endroit se dit en
 *            mots ; un lieu voisin se signale ; chercher un village y emmène ; « C'est ici » garde
 *            le point et avance — sur place ou à distance, et la feuille dit lequel.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { EtapeLieu } from './EtapeLieu'

const api = vi.hoisted(() => ({ fetchVoisins: vi.fn() }))
vi.mock('../api/ajout', () => api)
const geocodeur = vi.hoisted(() => ({ endroitDe: vi.fn(), chercherEndroits: vi.fn() }))
vi.mock('@/shared/lib/adresse', () => geocodeur)
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

function monter(b: Brouillon = brouillon, strict = false) {
  const router = createMemoryRouter(
    [{ path: '*', element: <EtapeLieu brouillon={b} changer={changer} onSuivant={suivant} /> }],
    { initialEntries: ['/carte/ajouter/lieu/lieu'] },
  )
  const arbre = (
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  render(strict ? <StrictMode>{arbre}</StrictMode> : arbre)
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

test('loin du point, le lieu s’ajoute à distance, et la feuille le dit', async () => {
  position.positionSiAutorisee.mockResolvedValue({ latitude: 48.85, longitude: 2.35 })
  monter()
  await screen.findByText('Près de Colomars')
  expect(await screen.findByText(/marqué « ajouté à distance »/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'C’est ici' })).toBeEnabled()
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
  await screen.findByText('Tu es sur place : ta visite comptera, et le lieu sera à ton nom.')
  await userEvent.click(screen.getByRole('button', { name: 'C’est ici' }))
  expect(changer).toHaveBeenCalledWith(
    expect.objectContaining({ point: { latitude: 46.6, longitude: 2.4 } }),
  )
  expect(suivant).toHaveBeenCalled()
})

test('le pin prime sur la photo : la carte part du pin, et le cercle juge', async () => {
  monter({
    ...brouillon,
    positionPhoto: { latitude: 45, longitude: 5 },
    pin: { id: 'p1', point: { latitude: 43.7, longitude: 7.2 }, poseLe: new Date().toISOString() },
  })
  expect(FausseCarte.derniere?.options).toEqual(expect.objectContaining({ center: [7.2, 43.7] }))
  expect(await screen.findByText(/Placé d’après ton pin/)).toBeInTheDocument()
  expect(screen.getByText(/Dans le cercle de ton pin/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mon pin/ })).toBeInTheDocument()
})

test('un pin de plus de 15 jours : le lieu sera ajouté à distance', async () => {
  monter({
    ...brouillon,
    pin: { id: 'p1', point: { latitude: 43.7, longitude: 7.2 }, poseLe: '2026-01-01T12:00:00Z' },
  })
  expect(await screen.findByText(/Ton pin a plus de 15 jours/)).toBeInTheDocument()
})

const AVEC_PIN: Brouillon = {
  ...brouillon,
  pin: { id: 'p1', point: { latitude: 43.7, longitude: 7.2 }, poseLe: new Date().toISOString() },
}

function calquesPoses(carte: FausseCarte): unknown[] {
  return carte.addLayer.mock.calls.map(([c]) => c.id)
}

// Un style neuf (plan ↔ satellite) repart sans aucun calque : la fausse carte les oublie.
function nouveauStyle(carte: FausseCarte, satellite: boolean) {
  carte.calquesPoses.clear()
  if (satellite) carte.calquesPoses.add('satellite')
  carte.addLayer.mockClear()
}

test('le cercle du pin se pose sur le plan, et revient sur le satellite, bordé pour s’y lire', async () => {
  monter(AVEC_PIN)
  await screen.findByText(/Placé d’après ton pin/)
  const carte = FausseCarte.derniere
  if (!carte) throw new Error('pas de carte')
  act(() => {
    carte.emettre('style.load')
  })
  expect(calquesPoses(carte)).toEqual(expect.arrayContaining(['cercle-du-pin-voile', 'cercle-du-pin-contour']))
  nouveauStyle(carte, true)
  act(() => {
    carte.emettre('style.load')
  })
  expect(calquesPoses(carte)).toEqual(
    expect.arrayContaining(['cercle-du-pin-voile', 'cercle-du-pin-lisere', 'cercle-du-pin-contour']),
  )
})

test('un style chargé sans le cercle le retrouve au premier « styledata »', async () => {
  monter(AVEC_PIN)
  await screen.findByText(/Placé d’après ton pin/)
  const carte = FausseCarte.derniere
  if (!carte) throw new Error('pas de carte')
  nouveauStyle(carte, true)
  act(() => {
    carte.emettre('styledata')
  })
  expect(calquesPoses(carte)).toContain('cercle-du-pin-contour')
})

test('en mode strict, la carte naît en plan sans recharger son style', async () => {
  monter(AVEC_PIN, true)
  await screen.findByText(/Placé d’après ton pin/)
  // Le mode strict monte deux cartes ; celle qui reste n'a chargé son style qu'une fois.
  expect(FausseCarte.derniere?.setStyle).toHaveBeenCalledOnce()
})

test('l’attribution des tuiles se voit : dépliée, en haut à droite, hors de la feuille', async () => {
  monter(AVEC_PIN)
  await screen.findByText(/Placé d’après ton pin/)
  const carte = FausseCarte.derniere
  expect(carte?.options).toEqual(expect.objectContaining({ attributionControl: false }))
  expect(carte?.addControl).toHaveBeenCalledWith(
    expect.objectContaining({ options: { compact: false } }),
    'top-right',
  )
})
