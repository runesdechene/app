/**
 * QUOI     — la règle du bip : ressemblance, classement par Fragment, seuil, avance, images d'affilée,
 *            silence.
 */
import { expect, test } from 'vitest'
import {
  AVANCE,
  DEPART,
  SEUIL,
  SEUIL_SEUL,
  SILENCE_MS,
  SUITE,
  arrondir,
  avancer,
  classer,
  ressemblance,
} from './regleDuBip'

test('la ressemblance est le cosinus : 1 pour deux vecteurs pareils, 0 pour deux orthogonaux', () => {
  expect(ressemblance([1, 0], [2, 0])).toBeCloseTo(1)
  expect(ressemblance([1, 0], [0, 3])).toBeCloseTo(0)
  expect(ressemblance([0, 0], [1, 0])).toBe(0) // un vecteur nul ne ressemble à rien
})

test('classer garde, par Fragment, sa meilleure empreinte, du plus ressemblant au moins', () => {
  const refs = [
    { fragment: 1, vecteur: [1, 0] },
    { fragment: 1, vecteur: [0.6, 0.8] },
    { fragment: 2, vecteur: [0, 1] },
  ]
  expect(classer([0.6, 0.8], refs)).toEqual([
    { fragment: 1, ressemblance: expect.closeTo(1) as number },
    { fragment: 2, ressemblance: expect.closeTo(0.8) as number },
  ])
})

test('sans aucune référence, rien n’est classé et rien ne bipe', () => {
  expect(classer([1, 0], [])).toEqual([])
  expect(avancer(DEPART, [], 0)).toEqual({ etat: DEPART, bip: null })
})

const net = (fragment: number) => [
  { fragment, ressemblance: SEUIL + 0.2 },
  { fragment: fragment + 1, ressemblance: SEUIL },
]

test(`bip au bout de ${String(SUITE)} images d’affilée sur le même Fragment, pas avant`, () => {
  let etat = DEPART
  for (let i = 1; i < SUITE; i++) {
    const r = avancer(etat, net(7), i * 100)
    expect(r.bip).toBeNull()
    etat = r.etat
  }
  expect(avancer(etat, net(7), SUITE * 100).bip).toBe(7)
})

test('sous le seuil, ou sans avance sur le deuxième, la suite repart de zéro', () => {
  const bas = [{ fragment: 7, ressemblance: SEUIL - 0.01 }]
  const serre = [
    { fragment: 7, ressemblance: SEUIL + 0.2 },
    { fragment: 8, ressemblance: SEUIL + 0.2 - AVANCE / 2 },
  ]
  expect(avancer({ fragment: 7, suite: SUITE - 1, silenceJusqua: 0 }, bas, 0).etat.suite).toBe(0)
  expect(avancer({ fragment: 7, suite: SUITE - 1, silenceJusqua: 0 }, serre, 0).etat.suite).toBe(0)
})

test('un autre Fragment en tête recommence la suite', () => {
  expect(avancer({ fragment: 7, suite: SUITE - 1, silenceJusqua: 0 }, net(9), 0)).toEqual({
    etat: { fragment: 9, suite: 1, silenceJusqua: 0 },
    bip: null,
  })
})

test(`après un bip, ${String(SILENCE_MS)} ms de silence`, () => {
  const apres = avancer({ fragment: 7, suite: SUITE - 1, silenceJusqua: 0 }, net(7), 1000)
  expect(apres.bip).toBe(7)
  const pendant = avancer(
    { ...apres.etat, fragment: 7, suite: SUITE - 1 },
    net(7),
    1000 + SILENCE_MS - 1,
  )
  expect(pendant.bip).toBeNull()
  const ensuite = avancer(
    { ...apres.etat, fragment: 7, suite: SUITE - 1 },
    net(7),
    1000 + SILENCE_MS,
  )
  expect(ensuite.bip).toBe(7)
})

test('arrondir garde 4 décimales (le poids des empreintes en base)', () => {
  expect(arrondir([0.123456, -0.98766])).toEqual([0.1235, -0.9877])
})

test('un seul Fragment en lice : sans deuxième pour l’avance, il faut le seuil du Fragment seul', () => {
  const suite = (classement: { fragment: number; ressemblance: number }[]) => {
    let r = avancer(DEPART, classement, 0)
    for (let i = 1; i < SUITE; i++) r = avancer(r.etat, classement, i * 100)
    return r.bip
  }
  expect(SEUIL_SEUL).toBeGreaterThan(SEUIL)
  expect(suite([{ fragment: 7, ressemblance: SEUIL_SEUL - 0.01 }])).toBeNull()
  expect(suite([{ fragment: 7, ressemblance: SEUIL_SEUL }])).toBe(7)
})
