import { expect, test } from 'vitest'
import { phraseDesConnexions } from './connexions'

test('une, deux, trois connexions : tous les noms', () => {
  expect(phraseDesConnexions(['Kelpie'])).toBe('Kelpie vient de se connecter')
  expect(phraseDesConnexions(['Kelpie', 'Ash'])).toBe('Kelpie et Ash se sont connectés')
  expect(phraseDesConnexions(['Kelpie', 'Ash', 'Luna'])).toBe(
    'Kelpie, Ash et Luna se sont connectés',
  )
})

test('au-delà, deux noms et les autres', () => {
  expect(phraseDesConnexions(['Kelpie', 'Ash', 'Luna', 'Tugdual', 'Sulame'])).toBe(
    'Kelpie, Ash et 3 autres se sont connectés',
  )
})
