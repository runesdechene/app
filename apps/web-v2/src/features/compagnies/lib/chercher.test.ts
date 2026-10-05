/**
 * QUOI     — chercher une Compagnie par son nom, sa devise ou sa mission, sans accents ni majuscules.
 */
import { expect, test } from 'vitest'
import { correspond } from './chercher'

const lys = { nom: 'Le Lys de Fer', devise: 'Les forteresses de l’Est' }

test('le nom ou la devise, sans accents ni majuscules', () => {
  expect(correspond(lys, 'lys')).toBe(true)
  expect(correspond(lys, 'FORTERESSE')).toBe(true)
  expect(correspond({ nom: 'Verte Guilde', devise: 'Les cascades' }, 'cascade')).toBe(true)
  expect(correspond({ nom: 'Helvétia', devise: null }, 'helvetia')).toBe(true)
  expect(correspond(lys, 'cascade')).toBe(false)
})

test('une recherche vide garde tout', () => {
  expect(correspond(lys, '  ')).toBe(true)
})
