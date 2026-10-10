/**
 * QUOI     — le chemin du Récit : dans l'appli pour un membre, sur le scan pour un visiteur.
 */
import { expect, test } from 'vitest'
import { cheminDuRecit } from './chemin'

test('le chemin du Récit : dans l’appli pour un membre, sur le scan pour un visiteur', () => {
  expect(cheminDuRecit(11, true)).toBe('/accueil/fragment/11')
  expect(cheminDuRecit(11, false)).toBe('/scan/fragment/11')
})
