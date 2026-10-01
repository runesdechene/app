import { expect, test } from 'vitest'
import { attente } from './attente'

test('les minutes, puis les heures', () => {
  expect(attente(30)).toBe('1 min')
  expect(attente(23 * 60)).toBe('23 min')
  expect(attente(60 * 60)).toBe('1 h')
  expect(attente(83 * 60 + 20)).toBe('1 h 24')
  expect(attente(2 * 3600 + 5 * 60)).toBe('2 h 05')
})
