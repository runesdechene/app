import { expect, test } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { enGeoJSON } from './calques'

const lieu: LieuCarte = {
  id: 'a', nom: 'Trophée', lat: 43.7, lng: 7.4, nature: 'lieu', icone: 'x.svg',
  couleur: '#708d44', etat: 'visite', revendication: { nom: 'Rémy', moi: true },
}

test('un lieu devient un point avec sa marque et sa pilule', () => {
  const [point] = enGeoJSON([lieu], false).features
  expect(point?.geometry).toEqual({ type: 'Point', coordinates: [7.4, 43.7] })
  expect(point?.properties).toEqual({
    id: 'a', etat: 'visite', nature: 'lieu', image: 'visite-x.svg', pilule: 'Rémy', moi: true,
  })
})

test('sans revendication, pas de pilule', () => {
  const [point] = enGeoJSON([{ ...lieu, revendication: null }], false).features
  expect(point?.properties).not.toHaveProperty('pilule')
})
