/**
 * QUOI     — combien de jours il reste à un pin, et comment le dire.
 */
import { expect, test } from 'vitest'
import { dureeRestante, joursRestants } from './validite'

const JOUR = 24 * 60 * 60 * 1000
const pose = new Date('2026-10-01T14:32:00Z')

test('le jour de la pose : quinze jours ; le lendemain : quatorze', () => {
  expect(joursRestants(pose, pose)).toBe(15)
  expect(joursRestants(pose, new Date(pose.getTime() + JOUR))).toBe(14)
})

test('une heure avant la fin : il reste un jour ; après : zéro, et moins', () => {
  expect(joursRestants(pose, new Date(pose.getTime() + 15 * JOUR - 3600_000))).toBe(1)
  expect(joursRestants(pose, new Date(pose.getTime() + 15 * JOUR))).toBe(0)
  expect(joursRestants(pose, new Date(pose.getTime() + 20 * JOUR))).toBe(-5)
})

test('les mots', () => {
  expect(dureeRestante(12)).toBe('encore 12 jours')
  expect(dureeRestante(1)).toBe('encore 1 jour')
  expect(dureeRestante(0)).toBe('sera ajouté à distance')
})
