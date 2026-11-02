/**
 * QUOI     — la lecture de `mon_fragment` (migration 578) : l'état d'un Fragment pour moi.
 */
import { lireMonFragment } from './lireMonFragment'

test('un Fragment porté', () => {
  expect(
    lireMonFragment({ etat: 'porte', scans: 2, numero: 37, porteurs: 112, signe: true }),
  ).toEqual({
    etat: 'porte',
    scans: 2,
    numero: 37,
    porteurs: 112,
    signe: true,
  })
})

test('un Fragment masqué donne null', () => {
  expect(lireMonFragment(null)).toBeNull()
})

test('un état inconnu lève', () => {
  expect(() =>
    lireMonFragment({ etat: 'x', scans: 0, numero: null, porteurs: 0, signe: false }),
  ).toThrow()
})
