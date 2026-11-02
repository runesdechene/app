/**
 * QUOI     — le rang d'un numéro de Porteur : rare, peu commune, commune.
 * POURQUOI — seuils fixes de la spec du Codex (02/11) : un numéro ne change jamais de rang.
 */
import { rangDuNumero } from './rang'

test('les dix premiers Porteurs sont rares', () => {
  expect(rangDuNumero(1)).toBe('rare')
  expect(rangDuNumero(10)).toBe('rare')
})

test('du 11e au 50e, peu commune', () => {
  expect(rangDuNumero(11)).toBe('peu_commune')
  expect(rangDuNumero(50)).toBe('peu_commune')
})

test('à partir du 51e, commune', () => {
  expect(rangDuNumero(51)).toBe('commune')
  expect(rangDuNumero(1000)).toBe('commune')
})
