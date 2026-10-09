/**
 * QUOI     — lire les réponses de mes_pins et lieux_pres_du_pin.
 */
import { expect, test } from 'vitest'
import { lireLieuxProches, lireMesPins } from './lirePins'

test('mes pins : position, lieu-dit, date', () => {
  const lu = lireMesPins({
    validiteJours: 15,
    pins: [{ id: 'p1', latitude: 43.7, longitude: 7.2, lieuDit: 'Près de Colomars', poseLe: '2026-10-03T12:32:00+00:00' }],
  })
  expect(lu.validiteJours).toBe(15)
  expect(lu.pins[0]).toEqual({
    id: 'p1',
    point: { latitude: 43.7, longitude: 7.2 },
    lieuDit: 'Près de Colomars',
    poseLe: new Date('2026-10-03T12:32:00Z'),
  })
})

test('un pin sans lieu-dit (posé hors ligne, géocodeur muet) se lit quand même', () => {
  const lu = lireMesPins({ validiteJours: 15, pins: [{ id: 'p1', latitude: 1, longitude: 2, lieuDit: null, poseLe: '2026-10-03T12:32:00Z' }] })
  expect(lu.pins[0]?.lieuDit).toBeNull()
})

test('les lieux proches : la carte du lieu et sa distance', () => {
  expect(
    lireLieuxProches([{ lieu: { id: 'l1', nom: 'Chapelle Saint-Roch', imageUrl: null }, metres: 40 }]),
  ).toEqual([{ id: 'l1', nom: 'Chapelle Saint-Roch', imageUrl: null, metres: 40 }])
})
