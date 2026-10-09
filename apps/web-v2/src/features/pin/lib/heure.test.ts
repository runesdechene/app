/**
 * QUOI     — l'heure d'un pin se dit « 14 h 32 ».
 */
import { expect, test } from 'vitest'
import { heure } from './heure'

test('les heures et les minutes, séparées par « h »', () => {
  expect(heure(new Date(2026, 9, 6, 14, 32))).toBe('14 h 32')
  expect(heure(new Date(2026, 9, 6, 9, 5))).toBe('9 h 05')
})
