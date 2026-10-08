import type { AddLayerObject, SourceSpecification } from 'maplibre-gl'
import { expect, test, vi } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { ajouterCalques, echelleAuZoom, echelleEcran, enGeoJSON, taille } from './calques'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

const couleurs: CouleursCarte = {
  fond: '#ecdcbb',
  eau: '#bfc3ad',
  route: '#9c7c55',
  encre: '#3f3024',
  halo: '#f4e9d1',
  foret: '#b9b58a',
  ombre: '#5a442c8c',
  cire: '#a94842',
}

const lieu: LieuCarte = {
  id: 'a',
  nom: 'Trophée',
  lat: 43.7,
  lng: 7.4,
  nature: 'lieu',
  icone: 'x.svg',
  couleur: '#708d44',
  etat: 'visite',
  revendication: { nom: 'Rémy', moi: true },
  natures: [],
  epoque: null,
  ajoute: false,
}

test('un lieu devient un point avec sa marque et sa pilule', () => {
  const [point] = enGeoJSON([lieu], false).features
  expect(point?.geometry).toEqual({ type: 'Point', coordinates: [7.4, 43.7] })
  expect(point?.properties).toEqual({
    id: 'a',
    etat: 'visite',
    nature: 'lieu',
    image: 'visite-x.svg',
    pilule: 'Rémy',
    moi: true,
  })
})

test('sans revendication, pas de pilule', () => {
  const [point] = enGeoJSON([{ ...lieu, revendication: null }], false).features
  expect(point?.properties).not.toHaveProperty('pilule')
})

test('aucun lieu n’est regroupé, même dézoomé ; les marques grandissent avec le zoom', () => {
  const map = {
    addSource: vi.fn<(id: string, source: SourceSpecification) => void>(),
    addLayer: vi.fn<(calque: AddLayerObject) => void>(),
  }
  ajouterCalques(map, couleurs)
  expect(map.addSource.mock.calls[0]?.[1]).not.toHaveProperty('cluster')
  const calques = map.addLayer.mock.calls.map(([calque]) => calque)
  expect(calques.map((c) => c.id)).toEqual(['billes', 'sceaux', 'curiosites', 'survol', 'pilules'])
  for (const calque of calques.slice(0, 2)) {
    expect(calque).toHaveProperty(['layout', 'icon-size', 0], 'interpolate')
  }
})

test('une taille agrandie reste une courbe de zoom au premier niveau (MapLibre l’exige)', () => {
  expect(taille(2)).toEqual(['interpolate', ['linear'], ['zoom'], 4, 1, 8, 1.6, 12, 2.3])
})

test('les marques grandissent avec l’écran : 1 jusqu’au 1080p, 1,4 en 2K, 1,8 en 4K', () => {
  expect(echelleEcran(390, 844)).toBe(1) // téléphone
  expect(echelleEcran(1440, 900)).toBe(1) // portable
  expect(echelleEcran(1920, 1080)).toBe(1) // écran 1080p
  expect(echelleEcran(2560, 1440)).toBe(1.4) // écran 2K
  expect(echelleEcran(3440, 1800)).toBe(1.6) // entre les deux : on glisse
  expect(echelleEcran(3840, 2160)).toBe(1.8) // écran 4K
  expect(echelleEcran(5120, 2880)).toBe(1.8) // au-delà : plafonné
})

test('le facteur d’écran multiplie chaque palier de toutes les marques', () => {
  const map = {
    addSource: vi.fn<(id: string, source: SourceSpecification) => void>(),
    addLayer: vi.fn<(calque: AddLayerObject) => void>(),
  }
  ajouterCalques(map, couleurs, 2)
  const billes = map.addLayer.mock.calls[0]?.[0]
  expect(billes).toHaveProperty(['layout', 'icon-size'], taille(2))
})

test('l’échelle d’une marque HTML suit la courbe des lieux : un point de loin, entière de près', () => {
  expect(echelleAuZoom(2)).toBe(0.5)
  expect(echelleAuZoom(6)).toBeCloseTo(0.65)
  expect(echelleAuZoom(12)).toBe(1.15)
  expect(echelleAuZoom(16)).toBe(1.15)
})
