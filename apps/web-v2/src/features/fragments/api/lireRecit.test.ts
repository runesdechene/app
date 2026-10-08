import { expect, test } from 'vitest'
import { lireRecit } from './lireRecit'

test('le récit d’un Fragment ; un Fragment absent ou masqué donne null', () => {
  expect(
    lireRecit({ id: 11, nom: 'Hoplite', heritage: "D'ombre et d'airain", illustration: null, resume: null, histoire: null, audio: 'https://cdn.shopify.com/h.mp3', narrateur: null, origine: 'Sparte', boutique: 'https://runesdechene.com/collections/hoplite' }),
  ).toMatchObject({ id: 11, nom: 'Hoplite', audio: 'https://cdn.shopify.com/h.mp3', origine: 'Sparte' })
  expect(lireRecit(null)).toBeNull()
})
