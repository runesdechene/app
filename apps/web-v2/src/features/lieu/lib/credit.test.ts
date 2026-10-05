/**
 * QUOI     — la phrase de crédit du récit.
 */
import { expect, test } from 'vitest'
import { phraseDuRecit } from './credit'

test('un auteur, deux, trois ; personne', () => {
  expect(phraseDuRecit(['Luna'])).toBe('Récit de Luna')
  expect(phraseDuRecit(['Luna', 'Mathéo'])).toBe('Récit partagé de Luna et Mathéo')
  expect(phraseDuRecit(['Luna', 'Mathéo', 'Aelis'])).toBe('Récit partagé de Luna, Mathéo et Aelis')
  expect(phraseDuRecit([])).toBeNull()
})
