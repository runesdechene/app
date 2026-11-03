/**
 * QUOI     — l'arrivée d'un scan se lit dans l'état de navigation ; le reste ne tire rien.
 */
import { expect, test } from 'vitest'
import { lireArrivee } from './arrivee'

test('un scan, avec ou sans le choix de creuser', () => {
  expect(lireArrivee({ scan: 1000 })).toEqual({ scan: 1000, creuser: false })
  expect(lireArrivee({ scan: 1000, creuser: true })).toEqual({ scan: 1000, creuser: true })
})

test('rien de reconnaissable : pas d’arrivée', () => {
  expect(lireArrivee(null)).toBeNull()
  expect(lireArrivee({ scan: '1000' })).toBeNull()
  expect(lireArrivee({ creuser: true })).toBeNull()
})
