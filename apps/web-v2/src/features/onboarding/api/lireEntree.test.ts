import { expect, test } from 'vitest'
import { lireChiffres, lireEntree } from './lireEntree'

test('les deux chiffres de l’accueil se lisent', () => {
  expect(lireChiffres([{ total_places: 3478, total_users: 4978 }])).toEqual({
    lieux: 3478,
    explorateurs: 4978,
  })
})

test('sans ligne, les chiffres manquent : c’est une erreur, pas un zéro', () => {
  expect(() => lireChiffres([])).toThrow()
})

test('mon entrée se lit ; un compte sans nom se lit « null »', () => {
  expect(lireEntree({ nom: null, numero: 4979, fragments: 2, charteSignee: false })).toEqual({
    nom: null,
    numero: 4979,
    fragments: 2,
    charteSignee: false,
  })
})
