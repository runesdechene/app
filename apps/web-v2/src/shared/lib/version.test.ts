import { expect, test } from 'vitest'
import { estPlusRecente, VERSION } from './version'

test('la version : son nom, puis son numéro', () => {
  expect(VERSION).toMatch(/^Pythéas \d+\.\d+\.\d+$/)
})

test('une version annoncée plus récente que celle qui tourne', () => {
  expect(estPlusRecente('1.8.0', '1.7.0')).toBe(true)
  expect(estPlusRecente('1.7.1', '1.7.0')).toBe(true)
  expect(estPlusRecente('2.0.0', '1.9.9')).toBe(true)
  expect(estPlusRecente('1.10.0', '1.9.0')).toBe(true)
  expect(estPlusRecente('1.7.0', '1.7.0')).toBe(false)
  expect(estPlusRecente('1.6.9', '1.7.0')).toBe(false)
  // Une valeur illisible n'oblige jamais à rien.
  expect(estPlusRecente('', '1.7.0')).toBe(false)
  expect(estPlusRecente('n/a', '1.7.0')).toBe(false)
})
