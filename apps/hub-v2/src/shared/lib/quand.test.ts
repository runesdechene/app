import { depuis } from './quand'

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
