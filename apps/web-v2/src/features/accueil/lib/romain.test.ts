import { expect, test } from 'vitest'
import { romain } from './romain'

test('un rang s’écrit en chiffres romains', () => {
  expect([1, 2, 3, 4, 9, 14, 40, 90, 400, 1999].map(romain)).toEqual([
    'I',
    'II',
    'III',
    'IV',
    'IX',
    'XIV',
    'XL',
    'XC',
    'CD',
    'MCMXCIX',
  ])
})
