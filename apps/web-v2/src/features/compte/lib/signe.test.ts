/**
 * QUOI     — « sous le signe de … » accorde l'article au nom du Fragment.
 */
import { sousLeSigne } from './signe'

test('les articles du nom se contractent', () => {
  expect(sousLeSigne('Le Varègue')).toBe('sous le signe du Varègue')
  expect(sousLeSigne('La Morrigan')).toBe('sous le signe de la Morrigan')
  expect(sousLeSigne('Les Druides')).toBe('sous le signe des Druides')
  expect(sousLeSigne('L’esprit du Hibou')).toBe('sous le signe de l’esprit du Hibou')
})

test('un nom qui commence par une voyelle ou un h prend l’élision', () => {
  expect(sousLeSigne('Hoplite')).toBe('sous le signe de l’Hoplite')
  expect(sousLeSigne('Avalon')).toBe('sous le signe de l’Avalon')
})

test('sinon, « de »', () => {
  expect(sousLeSigne('Morrigan')).toBe('sous le signe de Morrigan')
})
