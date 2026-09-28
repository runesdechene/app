import { expect, test } from 'vitest'
import { enLettres, majuscule } from './enLettres'

test('jusqu’à dix en lettres, au-delà en chiffres', () => {
  expect(enLettres(2)).toBe('deux')
  expect(enLettres(10)).toBe('dix')
  expect(enLettres(11)).toBe('11')
})

test('une majuscule en tête de phrase', () => {
  expect(majuscule('deux')).toBe('Deux')
})
