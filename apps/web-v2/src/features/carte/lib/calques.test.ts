import type { AddLayerObject, SourceSpecification } from 'maplibre-gl'
import { expect, test, vi } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { ajouterCalques, enGeoJSON, taille } from './calques'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

const couleurs: CouleursCarte = {
  fond: '#ecdcbb',
  eau: '#bfc3ad',
  route: '#9c7c55',
  encre: '#3f3024',
  halo: '#f4e9d1',
  foret: '#b9b58a',
  ombre: '#5a442c8c',
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
