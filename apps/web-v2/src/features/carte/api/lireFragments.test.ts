import { expect, test } from 'vitest'
import { lireFragments } from './lireFragments'

test('un Fragment de la carte : son nom, son icône, son origine', () => {
  expect(
    lireFragments([
      { id: 11, nom: 'Hoplite', illustration: 'https://cdn.shopify.com/h.webp', heritage: "D'ombre et d'airain", origine: 'Sparte', couleur: '#1d4e89', lat: 37.08, lng: 22.43 },
      { id: 5, nom: 'Avalon', illustration: null, heritage: null, origine: null, couleur: null, lat: 49.6, lng: -3.1 },
    ]),
  ).toEqual([
    { id: 11, nom: 'Hoplite', illustration: 'https://cdn.shopify.com/h.webp', heritage: "D'ombre et d'airain", origine: 'Sparte', couleur: '#1d4e89', lat: 37.08, lng: 22.43 },
    { id: 5, nom: 'Avalon', illustration: null, heritage: null, origine: null, couleur: null, lat: 49.6, lng: -3.1 },
  ])
})

test('une réponse mal formée lève, plutôt que de poser un Fragment n’importe où', () => {
  expect(() => lireFragments([{ id: 1, nom: 'Sans point' }])).toThrow()
})
