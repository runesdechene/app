/**
 * QUOI     — mes pins en GeoJSON : un point par pin passé (l'app n'envoie que les pins envoyés),
 *            avec ses jours.
 */
import { expect, test } from 'vitest'
import { enGeoJSONPins } from './mesPins'

test('un point par pin, en [lng, lat], avec ses jours', () => {
  const g = enGeoJSONPins([{ id: 'a', point: { latitude: 43.7, longitude: 7.2 }, jours: 12 }])
  expect(g.features).toHaveLength(1)
  expect(g.features[0]).toMatchObject({
    geometry: { coordinates: [7.2, 43.7] },
    properties: { id: 'a', jours: '12 j' },
  })
})

test('des jours négatifs s’affichent à 0 j', () => {
  const g = enGeoJSONPins([{ id: 'a', point: { latitude: 1, longitude: 2 }, jours: -3 }])
  expect(g.features[0]?.properties.jours).toBe('0 j')
})
