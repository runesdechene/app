import { expect, test } from 'vitest'
import { reliefVoulu } from './relief'

test('la 3D ne s’allume qu’inclinée et d’assez près', () => {
  expect(reliefVoulu(0, 12)).toBe(false)
  expect(reliefVoulu(40, 7)).toBe(false)
  expect(reliefVoulu(40, 10)).toBe(true)
  expect(reliefVoulu(15, 10)).toBe(false)
})
