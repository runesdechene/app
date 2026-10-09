import { expect, test } from 'vitest'
import { distanceM, libelleDistance } from './distance'

test('0,0018° de latitude font à peu près 200 m', () => {
  expect(Math.round(distanceM({ lat: 45, lng: 6 }, { lat: 45.0018, lng: 6 }))).toBeGreaterThan(195)
  expect(Math.round(distanceM({ lat: 45, lng: 6 }, { lat: 45.0018, lng: 6 }))).toBeLessThan(205)
})

test('la distance se dit en mètres sous 1 km, en kilomètres au-delà', () => {
  expect(libelleDistance(349.6)).toBe('350 m')
  expect(libelleDistance(2440)).toBe('2,4 km')
  expect(libelleDistance(274_300)).toBe('274 km')
})
