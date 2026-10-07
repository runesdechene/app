/**
 * QUOI     — la lecture de mes_enigmes et mes_enigmes_culture (migration 447).
 */
import { expect, test } from 'vitest'
import { lireMaCulture, lireMesEnigmes } from './lireMesEnigmes'

test('mes énigmes : le compte et une ligne par culture', () => {
  const m = lireMesEnigmes({
    resolues: 14,
    total: 72,
    cultures: [{ id: 'byzantine', nom: 'Byzance', icone: null, couleur: '#a93d76', resolues: 14, total: 72 }],
  })
  expect(m).toEqual({
    resolues: 14,
    total: 72,
    cultures: [{ id: 'byzantine', nom: 'Byzance', icone: null, couleur: '#a93d76', resolues: 14, total: 72 }],
  })
})

test('un compte sans énigme résolue se lit à zéro', () => {
  expect(lireMesEnigmes({ resolues: 0, total: 0, cultures: [] })).toEqual({ resolues: 0, total: 0, cultures: [] })
})

test('une culture : sa zone, son centre, ce qu’on a appris', () => {
  const c = lireMaCulture({
    culture: { id: 'byzantine', nom: 'Byzance', icone: null, couleur: null, zone: 'entre la Thrace et l’Asie Mineure' },
    resolues: 1,
    total: 72,
    centre: { lat: 41, lng: 28.9 },
    enigmes: [{ numero: 242, reponse: 'Sainte-Sophie', question: 'Quel monument ?', explication: 'La coupole…', le: '2026-10-07T09:00:00Z' }],
  })
  expect(c.culture.zone).toBe('entre la Thrace et l’Asie Mineure')
  expect(c.centre).toEqual({ lat: 41, lng: 28.9 })
  expect(c.enigmes[0]?.reponse).toBe('Sainte-Sophie')
  expect(c.enigmes[0]?.numero).toBe(242)
})

test('une culture sans zone ni cercle : zone et centre absents', () => {
  const c = lireMaCulture({
    culture: { id: 'r', nom: 'Rome', icone: null, couleur: null, zone: null },
    resolues: 0,
    total: 75,
    centre: null,
    enigmes: [],
  })
  expect(c.culture.zone).toBeNull()
  expect(c.centre).toBeNull()
})
