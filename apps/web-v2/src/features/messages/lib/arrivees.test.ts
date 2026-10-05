import { expect, test } from 'vitest'
import { phraseDesArrivees } from './arrivees'

test('une, deux, trois arrivées : tous les noms, le verbe au bon nombre', () => {
  expect(phraseDesArrivees(['Kelpie'])).toEqual({ qui: 'Kelpie', verbe: 'a rejoint EXPLORE !' })
  expect(phraseDesArrivees(['Kelpie', 'Ash']).qui).toBe('Kelpie et Ash')
  expect(phraseDesArrivees(['Kelpie', 'Ash']).verbe).toBe('ont rejoint EXPLORE !')
  expect(phraseDesArrivees(['Kelpie', 'Ash', 'Luna']).qui).toBe('Kelpie, Ash et Luna')
})

test('au-delà, deux noms et les autres', () => {
  expect(phraseDesArrivees(['Kelpie', 'Ash', 'Luna', 'Tugdual', 'Sulame']).qui).toBe(
    'Kelpie, Ash et 3 autres',
  )
})
