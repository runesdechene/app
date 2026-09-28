import { expect, test } from 'vitest'
import { apresUnSilence, moment } from './moment'

const MAINTENANT = new Date(2026, 8, 28, 21, 0) // lundi 28 septembre, 21 h

test('le moment se dit doucement', () => {
  expect(moment(new Date(2026, 8, 28, 9, 12).toISOString(), MAINTENANT)).toBe('ce matin')
  expect(moment(new Date(2026, 8, 28, 15, 0).toISOString(), MAINTENANT)).toBe('cet après-midi')
  expect(moment(new Date(2026, 8, 28, 19, 30).toISOString(), MAINTENANT)).toBe('ce soir')
  expect(moment(new Date(2026, 8, 27, 20, 0).toISOString(), MAINTENANT)).toBe('hier soir')
  expect(moment(new Date(2026, 8, 24, 10, 0).toISOString(), MAINTENANT)).toBe('jeudi')
  expect(moment(new Date(2026, 8, 12, 10, 0).toISOString(), MAINTENANT)).toBe('le 12 septembre')
})

test('le moment se pose au début, puis après une heure de silence', () => {
  const a = new Date(2026, 8, 28, 9, 0).toISOString()
  expect(apresUnSilence(undefined, a)).toBe(true)
  expect(apresUnSilence(a, new Date(2026, 8, 28, 9, 40).toISOString())).toBe(false)
  expect(apresUnSilence(a, new Date(2026, 8, 28, 10, 5).toISOString())).toBe(true)
})
