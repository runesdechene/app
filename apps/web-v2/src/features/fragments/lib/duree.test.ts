import { expect, test } from 'vitest'
import { duree } from './duree'

test('minutes et secondes sur deux chiffres ; une durée inconnue vaut 0:00', () => {
  expect(duree(51)).toBe('0:51')
  expect(duree(222.7)).toBe('3:42')
  expect(duree(Number.NaN)).toBe('0:00')
})
