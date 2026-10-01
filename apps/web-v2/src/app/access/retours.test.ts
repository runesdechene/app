import { afterEach, expect, test, vi } from 'vitest'
import { compterLesRetours } from './retours'

const MINUTE = 60 * 1000
let maintenant = 0
let arreter: () => void = () => undefined

function devenir(etat: 'hidden' | 'visible', a: number) {
  maintenant = a
  Object.defineProperty(document, 'visibilityState', { value: etat, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  arreter()
})

test('revenir après dix minutes ou plus compte comme ouvrir l’app', () => {
  const noter = vi.fn()
  arreter = compterLesRetours(noter, () => maintenant)
  devenir('hidden', 0)
  devenir('visible', 10 * MINUTE)
  expect(noter).toHaveBeenCalledTimes(1)
})

test('un aller-retour de moins de dix minutes ne compte pas', () => {
  const noter = vi.fn()
  arreter = compterLesRetours(noter, () => maintenant)
  devenir('hidden', 0)
  devenir('visible', 9 * MINUTE)
  expect(noter).not.toHaveBeenCalled()
})

test('une fois arrêté, plus rien ne compte', () => {
  const noter = vi.fn()
  compterLesRetours(noter, () => maintenant)()
  devenir('hidden', 0)
  devenir('visible', 60 * MINUTE)
  expect(noter).not.toHaveBeenCalled()
})
