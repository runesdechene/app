import { expect, test } from 'vitest'
import { etatVisite } from './etatVisite'

const lieu = { lat: 45, lng: 6 }
const pres = { lat: 45.0009, lng: 6 } // ~100 m
const loin = { lat: 47.465, lng: 6 } // ~274 km

test('sans position, on propose de se localiser ; refusée, on le dit', () => {
  expect(etatVisite('inconnue', lieu, null)).toEqual({ kind: 'localiser' })
  expect(etatVisite('refusee', lieu, '2026-08-03T10:00:00Z')).toEqual({ kind: 'refusee' })
})

test('jamais visité : à portée on visite, loin le bouton dit la distance', () => {
  expect(etatVisite(pres, lieu, null)).toEqual({ kind: 'visiter' })
  expect(etatVisite(loin, lieu, null)).toEqual({ kind: 'tropLoin', distance: '274 km' })
})

test('déjà visité : de retour on revendique, loin on rappelle la visite', () => {
  expect(etatVisite(pres, lieu, '2026-08-03T10:00:00Z')).toEqual({ kind: 'revendiquer' })
  expect(etatVisite(loin, lieu, '2026-08-03T10:00:00Z')).toEqual({
    kind: 'visite',
    le: '3 août',
    distance: '274 km',
  })
})
