import { expect, test } from 'vitest'
import { encoreModifiable } from './retouche'

const ECRIT = '2026-10-11T18:00:00Z'

test('un message se modifie pendant quinze minutes, pas une de plus', () => {
  expect(encoreModifiable(ECRIT, Date.parse('2026-10-11T18:14:30Z'))).toBe(true)
  expect(encoreModifiable(ECRIT, Date.parse('2026-10-11T18:15:00Z'))).toBe(false)
})
