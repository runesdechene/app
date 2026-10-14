import { dateCourte, moisAnnee } from './dates'

test('une date courte, à l’heure de Paris', () => {
  expect(dateCourte('2026-10-13T23:30:00Z')).toBe('14/10/2026')
})
test('pas de date : jamais', () => {
  expect(dateCourte(null)).toBe('jamais')
})
test('mois et année', () => {
  expect(moisAnnee('2025-03-02T10:00:00Z')).toBe('03/2025')
  expect(moisAnnee(null)).toBe('—')
})
