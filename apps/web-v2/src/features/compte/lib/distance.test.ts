/**
 * QUOI     — la distance à vol d'oiseau entre l'Explorateur qui regarde et un lieu.
 */
import { distanceKm, formatDistance } from './distance'

test('Nice → Marseille ≈ 159 km à vol d’oiseau', () => {
  const km = distanceKm(
    { latitude: 43.7102, longitude: 7.262 },
    { latitude: 43.2965, longitude: 5.3698 },
  )
  expect(Math.round(km)).toBe(159)
})

test('la distance s’écrit en kilomètres entiers, ou « moins d’1 km »', () => {
  expect(formatDistance(170.4)).toBe('170 km')
  expect(formatDistance(0.3)).toBe('moins d’1 km')
})
