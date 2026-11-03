/**
 * QUOI     — le son du bip : rien tant qu'on n'a pas touché l'écran (règle de Safari).
 */
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('sans toucher, le son n’est pas débloqué et biper ne fait rien', async () => {
  const { biper, sonDebloque } = await import('./son')
  expect(sonDebloque()).toBe(false)
  expect(() => {
    biper()
  }).not.toThrow()
})

test('débloquer crée le contexte audio et le relance', async () => {
  const resume = vi.fn(() => Promise.resolve())
  vi.stubGlobal(
    'AudioContext',
    // un constructeur : `new AudioContext()`
    vi.fn(function () {
      return { state: 'running', resume }
    }),
  )
  const { debloquerSon, sonDebloque } = await import('./son')
  debloquerSon()
  expect(resume).toHaveBeenCalled()
  expect(sonDebloque()).toBe(true)
})
