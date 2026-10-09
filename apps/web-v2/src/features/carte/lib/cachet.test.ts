/**
 * QUOI     — le bord irrégulier d'un cachet de cire : un chemin SVG fermé, le même à chaque dessin.
 */
import { expect, test } from 'vitest'
import { BORD_DE_CIRE } from './cachet'

test('le bord de cire est un chemin fermé, stable d’un rendu à l’autre', () => {
  expect(BORD_DE_CIRE.startsWith('M')).toBe(true)
  expect(BORD_DE_CIRE.endsWith('Z')).toBe(true)
  expect(BORD_DE_CIRE.match(/Q/g)).toHaveLength(16)
})
