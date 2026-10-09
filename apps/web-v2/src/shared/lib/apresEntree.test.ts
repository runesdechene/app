/**
 * QUOI     — le lieu retenu avant l'inscription se reprend une fois, puis s'oublie.
 */
import { expect, test } from 'vitest'
import { reprendreLieu, retenirLieu } from './apresEntree'

test('un lieu retenu se reprend une seule fois', () => {
  expect(reprendreLieu()).toBeNull()
  retenirLieu('d1')
  expect(reprendreLieu()).toBe('d1')
  expect(reprendreLieu()).toBeNull()
})
