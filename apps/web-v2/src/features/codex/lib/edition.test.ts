/**
 * QUOI     — le libellé d'une marque d'édition, écrit par l'appli (la base rend la donnée).
 */
import { libelleEdition } from './edition'

test('les trois marques', () => {
  expect(libelleEdition('limitee', null)).toBe('Édition limitée')
  expect(libelleEdition('retire', null)).toBe('Retiré')
  expect(libelleEdition('exclusif', null)).toBe('Exclusif')
})

test('la précision suit la marque', () => {
  expect(libelleEdition('exclusif', 'Yggdrasil')).toBe('Exclusif Yggdrasil')
})

test('sans marque, rien', () => {
  expect(libelleEdition(null, 'Yggdrasil')).toBeNull()
})
