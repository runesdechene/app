/**
 * QUOI     — les dates du passeport : au jour pour soi, au mois pour les autres.
 */
import { expect, test } from 'vitest'
import { dateCourte, depuis, moisLong } from './dates'

test('date courte', () => {
  expect(dateCourte('2026-10-06', true)).toBe('6 oct.')
  expect(dateCourte('2026-10-01', false)).toBe('oct. 2026')
})

test('mois long', () => {
  expect(moisLong('2026-09')).toBe('septembre 2026')
})

test('depuis', () => {
  expect(depuis('2025-06-12', true)).toBe('depuis le 12 juin 2025')
  expect(depuis('2025-06-01', false)).toBe('depuis juin 2025')
})
