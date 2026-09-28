import { expect, test } from 'vitest'
import { lireLieux, lireTerritoire } from './lireCarte'

test('un lieu complet se lit', () => {
  expect(
    lireLieux([
      { id: 'a', nom: 'Trophée', lat: 43.7, lng: 7.4, nature: 'lieu', icone: 'x.svg', couleur: '#708d44',
        etat: 'visite', revendication: { nom: 'Rémy', moi: false } },
    ])[0],
  ).toMatchObject({ etat: 'visite', revendication: { nom: 'Rémy' } })
})

test('un lieu sans icône ni revendication reste lisible', () => {
  const l = lireLieux([
    { id: 'b', nom: 'Borne', lat: 44, lng: 7, nature: 'curiosite', icone: null, couleur: null, etat: 'inconnu', revendication: null },
  ])[0]
  expect(l?.icone).toBeNull()
  expect(l?.revendication).toBeNull()
})

test('un état inconnu de la base est lu comme « inconnu », jamais une erreur', () => {
  expect(
    lireLieux([{ id: 'c', nom: 'X', lat: 1, lng: 1, nature: 'lieu', icone: null, couleur: null, etat: 'bizarre', revendication: null }])[0]?.etat,
  ).toBe('inconnu')
})

test('au-dessus de la mer, pas de territoire', () => {
  expect(lireTerritoire({ territoire: null, pays: null })).toEqual({ territoire: null, pays: null })
})
