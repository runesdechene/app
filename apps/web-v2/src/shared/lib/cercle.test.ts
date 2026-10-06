import { expect, test } from 'vitest'
import { cercle } from './cercle'

test('un cercle fermé, au bon rayon', () => {
  const points = cercle(45, 1, 50)
  expect(points[0]).toEqual(points.at(-1))
  const [lng, lat] = points[0] ?? [0, 0]
  const km = Math.hypot((lat - 45) * 111, (lng - 1) * 111 * Math.cos((45 * Math.PI) / 180))
  expect(Math.round(km)).toBe(50)
})
