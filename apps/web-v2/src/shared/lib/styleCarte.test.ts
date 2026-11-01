import type { StyleSpecification } from 'maplibre-gl'
import { expect, test, vi } from 'vitest'
import type { CouleursCarte } from './couleursCarte'
import { ajouterOmbrage, styleParchemin } from './styleCarte'

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

const base = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'x' } },
  layers: [
    { id: 'background', type: 'background', paint: {} },
    { id: 'road_minor', type: 'line', source: 'openmaptiles', paint: {} },
    { id: 'landcover_wood', type: 'fill', source: 'openmaptiles', paint: {} },
  ],
} as StyleSpecification

test('les petites routes disparaissent, les forêts prennent l’olive pâle', () => {
  const s = styleParchemin(base, couleurs)
  expect(s.layers.map((l) => l.id)).not.toContain('road_minor')
  expect(s.layers.find((l) => l.id === 'landcover_wood')?.paint).toMatchObject({
    'fill-color': couleurs.foret,
  })
  expect(s.terrain).toBeUndefined()
})

test('l’ombrage n’est pas dans le style : ses tuiles ne passent qu’après les lieux', () => {
  const s = styleParchemin(base, couleurs)
  expect(s.layers.some((l) => l.type === 'hillshade')).toBe(false)
  expect(s.sources).toHaveProperty('relief')
})

test('l’ombrage se pose une fois, sous la première route', () => {
  const addLayer = vi.fn()
  const calques = [{ id: 'background' }, { id: 'road_major' }, { id: 'label_city' }]
  const carte = {
    getSource: () => ({}),
    getLayer: (id: string) => (addLayer.mock.calls.length > 0 && id === 'ombrage' ? {} : undefined),
    getStyle: () => ({ layers: calques }),
    addLayer,
  }
  ajouterOmbrage(carte, couleurs)
  ajouterOmbrage(carte, couleurs)
  expect(addLayer).toHaveBeenCalledTimes(1)
  expect(addLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'ombrage', type: 'hillshade', source: 'relief' }),
    'road_major',
  )
})

test('sans source « relief » (vue satellite), l’ombrage ne se pose pas', () => {
  const addLayer = vi.fn()
  const carte = {
    getSource: () => undefined,
    getLayer: () => undefined,
    getStyle: () => ({ layers: [{ id: 'satellite' }] }),
    addLayer,
  }
  ajouterOmbrage(carte, couleurs)
  expect(addLayer).not.toHaveBeenCalled()
})

test('le style reçu n’est jamais modifié', () => {
  styleParchemin(base, couleurs)
  expect(base.layers).toHaveLength(3)
  expect(base.layers[0]?.paint).toEqual({})
})
