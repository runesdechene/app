import { expect, test } from 'vitest'
import { ilYA } from './ilYA'

const MAINTENANT = new Date('2026-09-28T18:00:00Z').getTime()
const avant = (ms: number) => new Date(MAINTENANT - ms).toISOString()
// Le navigateur pose des espaces insécables (la typographie française) : on les lit en espaces.
const lu = (ms: number) => ilYA(avant(ms), MAINTENANT).replace(/\s/g, ' ')

test('à l’instant, puis en minutes, en heures, en jours', () => {
  expect(lu(20 * 1000)).toBe('à l’instant')
  expect(lu(10 * 60 * 1000)).toBe('il y a 10 min')
  expect(lu(3 * 3600 * 1000)).toBe('il y a 3 h')
  expect(lu(24 * 3600 * 1000)).toBe('hier')
  expect(lu(4 * 24 * 3600 * 1000)).toBe('il y a 4 j')
})
