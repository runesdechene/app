import { expect, test } from 'vitest'
import { autreJour, jourDe } from './jour'

const MAINTENANT = new Date(2026, 8, 28, 21, 0) // lundi 28 septembre

test('le jour d’un message : aujourd’hui, hier, puis la date', () => {
  expect(jourDe(new Date(2026, 8, 28, 8, 0).toISOString(), MAINTENANT)).toBe('Aujourd’hui')
  expect(jourDe(new Date(2026, 8, 27, 23, 0).toISOString(), MAINTENANT)).toBe('Hier')
  expect(jourDe(new Date(2026, 8, 26, 13, 34).toISOString(), MAINTENANT)).toBe(
    'Samedi 26 septembre',
  )
})

test('un séparateur avant le premier message, et à chaque changement de jour', () => {
  const lundi = new Date(2026, 8, 28, 9, 0).toISOString()
  expect(autreJour(undefined, lundi)).toBe(true)
  expect(autreJour(new Date(2026, 8, 28, 0, 5).toISOString(), lundi)).toBe(false)
  expect(autreJour(new Date(2026, 8, 27, 23, 55).toISOString(), lundi)).toBe(true)
})
