import { expect, test } from 'vitest'
import { lireEntree } from './lireEntree'

test('mon entrée se lit ; un compte sans nom se lit « null »', () => {
  expect(
    lireEntree({ nom: null, numero: 4979, fragments: 2, charteSignee: false, avatar: null }),
  ).toEqual({
    nom: null,
    numero: 4979,
    fragments: 2,
    charteSignee: false,
    avatar: null,
  })
})
