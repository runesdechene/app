/**
 * QUOI     — `?centre=lat,lng[,zoom]` : la carte vole sur un lieu (zoom 14) ou sur la zone d'une culture.
 */
import { expect, test } from 'vitest'
import { lireCentre } from './centre'

test('un lieu : le zoom d’un lieu par défaut', () => {
  expect(lireCentre('43.7,7.2')).toEqual({ lat: 43.7, lng: 7.2, zoom: 14 })
})

test('la zone d’une culture : son zoom', () => {
  expect(lireCentre('41,28.9,6.5')).toEqual({ lat: 41, lng: 28.9, zoom: 6.5 })
})

test('mal écrit ou absent : nulle part', () => {
  expect(lireCentre(null)).toBeNull()
  expect(lireCentre('abc')).toBeNull()
  expect(lireCentre('41')).toBeNull()
  expect(lireCentre('95,10')).toBeNull()
  expect(lireCentre('41,28.9,zoom')).toBeNull()
})
