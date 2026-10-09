import { expect, test } from 'vitest'
import { disposition } from './disposition'

test('sur la Carte, rien n’est ouvert par-dessus : le tiroir est fermé', () => {
  expect(disposition('/carte')).toEqual({
    actif: 'carte',
    detail: false,
    feuille: false,
    tiroir: false,
  })
  expect(disposition('/carte/')).toMatchObject({ tiroir: false })
})

test('Accueil, Messages et Compte s’ouvrent dans le tiroir', () => {
  expect(disposition('/accueil')).toMatchObject({ actif: 'accueil', tiroir: true, detail: false })
  expect(disposition('/messages')).toMatchObject({ tiroir: true })
  expect(disposition('/compte')).toMatchObject({ tiroir: true })
})

test('une fiche s’ouvre dans le tiroir, même depuis la Carte', () => {
  expect(disposition('/carte/lieu/x')).toMatchObject({ actif: 'carte', detail: true, tiroir: true })
  expect(disposition('/compte/preferences')).toMatchObject({ detail: true, tiroir: true })
})

test('une feuille (« Ajouter ») ne touche pas au tiroir', () => {
  expect(disposition('/carte/ajouter')).toMatchObject({
    feuille: true,
    detail: false,
    tiroir: false,
  })
  expect(disposition('/accueil/ajouter')).toMatchObject({ feuille: true, tiroir: true })
})
