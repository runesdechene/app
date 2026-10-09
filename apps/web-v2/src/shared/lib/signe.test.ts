/**
 * QUOI     — « sous le signe de … » accorde l'article au nom du Fragment.
 */
import { sousLeSigne } from './signe'

const phrase = (nom: string) => {
  const { avant, nom: reste } = sousLeSigne(nom)
  return avant + reste
}

test('le nom se détache de la phrase, pour être mis en gras', () => {
  expect(sousLeSigne('Le Varègue')).toEqual({ avant: 'sous le signe du ', nom: 'Varègue' })
})

test('les articles du nom se contractent', () => {
  expect(phrase('Le Varègue')).toBe('sous le signe du Varègue')
  expect(phrase('La Morrigan')).toBe('sous le signe de la Morrigan')
  expect(phrase('Les Druides')).toBe('sous le signe des Druides')
  expect(phrase('L’esprit du Hibou')).toBe('sous le signe de l’esprit du Hibou')
})

test('un nom qui commence par une voyelle ou un h prend l’élision', () => {
  expect(phrase('Hoplite')).toBe('sous le signe de l’Hoplite')
  expect(phrase('Avalon')).toBe('sous le signe de l’Avalon')
})

test('sinon, « de »', () => {
  expect(phrase('Morrigan')).toBe('sous le signe de Morrigan')
})
