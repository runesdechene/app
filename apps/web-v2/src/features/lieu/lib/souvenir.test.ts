import { expect, test } from 'vitest'
import { anneesPossibles, jySuisAlle, moisDuSouvenir, moisPasse } from './souvenir'

const octobre2026 = new Date(2026, 9, 19)

test('le geste s’accorde au genre choisi', () => {
  expect(jySuisAlle('m')).toBe('J’y suis allé')
  expect(jySuisAlle('f')).toBe('J’y suis allée')
})

test('le mois d’un souvenir, sans fuseau horaire', () => {
  expect(moisDuSouvenir('2019-08-01')).toBe('août 2019')
  expect(moisDuSouvenir('2024-01-01')).toBe('janvier 2024')
})

test('les années vont de l’année en cours à 1900', () => {
  const annees = anneesPossibles(octobre2026)
  expect(annees[0]).toBe(2026)
  expect(annees.at(-1)).toBe(1900)
})

test('un mois à venir ne se déclare pas', () => {
  expect(moisPasse(2026, 10, octobre2026)).toBe(true)
  expect(moisPasse(2026, 11, octobre2026)).toBe(false)
  expect(moisPasse(2019, 12, octobre2026)).toBe(true)
})
