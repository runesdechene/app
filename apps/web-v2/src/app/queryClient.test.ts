/**
 * QUOI     — ce que l'appareil garde entre deux ouvertures : les lieux de la carte, l'accès accordé, et rien d'autre.
 */
import { expect, test, vi } from 'vitest'
import { aGarderSurLAppareil, auPlusTard } from './queryClient'

test('les lieux de la carte, chargés, se gardent sur l’appareil', () => {
  expect(aGarderSurLAppareil(['carte', 'lieux'], 'success', undefined)).toBe(true)
})

test('ni des lieux pas encore arrivés, ni le reste de l’app', () => {
  expect(aGarderSurLAppareil(['carte', 'lieux'], 'pending', undefined)).toBe(false)
  expect(aGarderSurLAppareil(['carte', 'lieux'], 'error', undefined)).toBe(false)
  expect(aGarderSurLAppareil(['carte', 'filtres'], 'success', undefined)).toBe(false)
  expect(aGarderSurLAppareil(['registre'], 'success', undefined)).toBe(false)
})

test('l’accès accordé se garde ; un refus ou une erreur jamais', () => {
  const accorde = { hasSession: true, hasAccess: true }
  expect(aGarderSurLAppareil(['v2-access'], 'success', accorde)).toBe(true)
  expect(
    aGarderSurLAppareil(['v2-access'], 'success', { hasSession: true, hasAccess: false }),
  ).toBe(false)
  expect(aGarderSurLAppareil(['v2-access'], 'error', undefined)).toBe(false)
  expect(aGarderSurLAppareil(['accueil'], 'success', {})).toBe(false)
})

test('une relecture qui traîne n’arrête pas l’app : passé le délai, on repart sans la copie', async () => {
  vi.useFakeTimers()
  const jamais = new Promise<string>(() => undefined)
  const lecture = auPlusTard(jamais, 1500)
  await vi.advanceTimersByTimeAsync(1500)
  await expect(lecture).resolves.toBeUndefined()
  vi.useRealTimers()
})

test('une relecture rapide rend la copie', async () => {
  await expect(auPlusTard(Promise.resolve('copie'), 1500)).resolves.toBe('copie')
})
