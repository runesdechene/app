/**
 * QUOI     — l'invite du champ pour écrire dans une Compagnie.
 */
import { expect, test } from 'vitest'
import { aideDuChamp } from './aide'

test('l’article se contracte comme on le dit', () => {
  expect(aideDuChamp('Le Lys de Fer')).toBe('Écrire au Lys de Fer')
  expect(aideDuChamp('Les Cavaliers Australs')).toBe('Écrire aux Cavaliers Australs')
  expect(aideDuChamp('Verte Guilde')).toBe('Écrire à Verte Guilde')
  expect(aideDuChamp('L’ordre des Deux Mondes')).toBe('Écrire à L’ordre des Deux Mondes')
})
