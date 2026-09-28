import { expect, test } from 'vitest'
import { dimensions } from './photo'

test('une photo tient dans son cadre sans se déformer', () => {
  expect(dimensions(4000, 3000, 1920)).toEqual({ largeur: 1920, hauteur: 1440 })
  expect(dimensions(3000, 4000, 1920)).toEqual({ largeur: 1440, hauteur: 1920 })
})

test('une petite photo n’est jamais agrandie', () => {
  expect(dimensions(800, 600, 1920)).toEqual({ largeur: 800, hauteur: 600 })
})
