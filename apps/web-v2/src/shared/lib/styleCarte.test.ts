import type { StyleSpecification } from 'maplibre-gl'
import { expect, test } from 'vitest'
import type { CouleursCarte } from './couleursCarte'
import { styleParchemin } from './styleCarte'

const couleurs: CouleursCarte = {
  fond: '#ecdcbb',
  eau: '#bfc3ad',
  route: '#9c7c55',
  encre: '#3f3024',
  halo: '#f4e9d1',
  foret: '#b9b58a',
  ombre: '#5a442c8c',
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

test('les petites routes disparaissent, les forêts prennent l’olive pâle, l’ombrage est ajouté', () => {
  const s = styleParchemin(base, couleurs)
  expect(s.layers.map((l) => l.id)).not.toContain('road_minor')
  expect(s.layers.find((l) => l.id === 'landcover_wood')?.paint).toMatchObject({
    'fill-color': couleurs.foret,
  })
  expect(s.layers.some((l) => l.type === 'hillshade')).toBe(true)
  expect(s.terrain).toBeUndefined()
})

test('le style reçu n’est jamais modifié', () => {
  styleParchemin(base, couleurs)
  expect(base.layers).toHaveLength(3)
  expect(base.layers[0]?.paint).toEqual({})
})
