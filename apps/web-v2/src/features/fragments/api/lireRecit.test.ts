import { expect, test } from 'vitest'
import { lireRecit } from './lireRecit'

test('le récit d’un Fragment ; un Fragment absent ou masqué donne null', () => {
  expect(
    lireRecit({
      id: 11,
      nom: 'Hoplite',
      heritage: "D'ombre et d'airain",
      illustration: null,
      resume: null,
      histoire: null,
      audio: 'https://cdn.shopify.com/h.mp3',
      narrateur: null,
      origine: 'Sparte',
      boutique: 'https://runesdechene.com/collections/hoplite',
    }),
  ).toMatchObject({
    id: 11,
    nom: 'Hoplite',
    audio: 'https://cdn.shopify.com/h.mp3',
    origine: 'Sparte',
  })
  expect(lireRecit(null)).toBeNull()
})

test('l’artiste, sa photo, son mot et l’édition (migration 577)', () => {
  expect(
    lireRecit({
      id: 11,
      nom: 'Hoplite',
      heritage: null,
      illustration: null,
      resume: 'En bref',
      histoire: null,
      audio: null,
      narrateur: null,
      origine: null,
      boutique: null,
      artiste: 'Uriel',
      artistePhoto: 'https://x/u.jpg',
      motArtiste: 'Deux soirées pour le bouclier.',
      edition: 'limitee',
      editionPrecision: null,
    }),
  ).toMatchObject({
    artiste: 'Uriel',
    artistePhoto: 'https://x/u.jpg',
    motArtiste: 'Deux soirées pour le bouclier.',
    edition: 'limitee',
    editionPrecision: null,
  })
})
