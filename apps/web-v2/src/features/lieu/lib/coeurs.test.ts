/**
 * QUOI     — les phrases des cœurs : qui a envoyé combien, et qui féliciter.
 */
import { expect, test } from 'vitest'
import { libelleFeliciter, phraseDesCoeurs } from './coeurs'

const p = (nom: string) => ({ id: nom, nom, avatar: null, nombre: 1 })

test('qui a envoyé des cœurs, en une phrase', () => {
  expect(phraseDesCoeurs([p('Kelpie')], 1)).toBe('Kelpie a envoyé 1 cœur')
  expect(phraseDesCoeurs([p('Kelpie')], 3)).toBe('Kelpie a envoyé 3 cœurs')
  expect(phraseDesCoeurs([p('Kelpie'), p('Luna')], 12)).toBe('Kelpie et Luna ont envoyé 12 cœurs')
  expect(phraseDesCoeurs([p('Kelpie'), p('Luna'), p('Aelis')], 13)).toBe(
    'Kelpie, Luna et 1 autre ont envoyé 13 cœurs',
  )
  expect(phraseDesCoeurs(['Kelpie', 'Luna', 'A', 'B', 'C', 'D'].map(p), 42)).toBe(
    'Kelpie, Luna et 4 autres ont envoyé 42 cœurs',
  )
})

test('féliciter ceux qui ont fait le lieu', () => {
  expect(libelleFeliciter(['Luna', 'Mathéo'])).toBe('Féliciter Luna et Mathéo')
  expect(libelleFeliciter(['Luna', 'Luna'])).toBe('Féliciter Luna')
  expect(libelleFeliciter([])).toBe('Aimer ce lieu')
})
