/**
 * QUOI     — les pins posés et pas encore envoyés, gardés dans IndexedDB.
 */
import { beforeEach, expect, test, vi } from 'vitest'

const memoire = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: (cle: string) => Promise.resolve(memoire.get(cle)),
  set: (cle: string, v: unknown) => {
    memoire.set(cle, v)
    return Promise.resolve()
  },
  update: (cle: string, fn: (v: unknown) => unknown) => {
    memoire.set(cle, fn(memoire.get(cle)))
    return Promise.resolve()
  },
}))

import { garderPinEnAttente, lirePinsEnAttente, marquerRefuse, retirerPinEnAttente } from './pinsEnAttente'

const PIN = { id: 'p1', latitude: 43.7, longitude: 7.2, precision: 8, poseLe: '2026-10-06T12:32:00.000Z' }

beforeEach(() => {
  memoire.clear()
})

test('vide au départ ; garder puis lire ; retirer', async () => {
  expect(await lirePinsEnAttente()).toEqual([])
  await garderPinEnAttente(PIN)
  expect(await lirePinsEnAttente()).toEqual([PIN])
  await retirerPinEnAttente('p1')
  expect(await lirePinsEnAttente()).toEqual([])
})

test('retirer dit si le pin était encore là', async () => {
  await garderPinEnAttente(PIN)
  expect(await retirerPinEnAttente('p1')).toBe(true)
  expect(await retirerPinEnAttente('p1')).toBe(false)
})

test('marquer refusé un pin supprimé entre-temps ne le fait pas revenir', async () => {
  await garderPinEnAttente(PIN)
  expect(await marquerRefuse('p1')).toBe(true)
  expect(await lirePinsEnAttente()).toEqual([{ ...PIN, refuse: true }])
  await retirerPinEnAttente('p1')
  expect(await marquerRefuse('p1')).toBe(false)
  expect(await lirePinsEnAttente()).toEqual([])
})

test('garder deux fois le même pin ne le double pas', async () => {
  await garderPinEnAttente(PIN)
  await garderPinEnAttente(PIN)
  expect(await lirePinsEnAttente()).toHaveLength(1)
})
