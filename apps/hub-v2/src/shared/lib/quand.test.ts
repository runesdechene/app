import { depuis, heureDuFil } from './quand'

const maintenant = new Date('2026-10-14T12:00:00Z')

test('moins d’une heure', () => {
  expect(depuis('2026-10-14T11:48:00Z', maintenant)).toBe('il y a 12 min')
})
test('quelques heures', () => {
  expect(depuis('2026-10-14T09:00:00Z', maintenant)).toBe('il y a 3 h')
})
test('quelques jours', () => {
  expect(depuis('2026-10-11T09:00:00Z', maintenant)).toBe('il y a 3 jours')
})
test('un jour', () => {
  expect(depuis('2026-10-13T09:00:00Z', maintenant)).toBe('hier')
})

describe('heureDuFil', () => {
  const ce_jour = new Date(2026, 9, 14, 16, 0)
  test('aujourd’hui : l’heure seule', () => {
    expect(heureDuFil(new Date(2026, 9, 14, 14, 32).toISOString(), ce_jour)).toBe('14:32')
  })
  test('hier : « hier » et l’heure', () => {
    expect(heureDuFil(new Date(2026, 9, 13, 23, 5).toISOString(), ce_jour)).toBe('hier 23:05')
  })
  test('plus ancien : le jour, le mois abrégé et l’heure', () => {
    expect(heureDuFil(new Date(2026, 9, 12, 14, 32).toISOString(), ce_jour)).toBe('12 oct. 14:32')
  })
})
