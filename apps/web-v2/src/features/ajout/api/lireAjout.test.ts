import { expect, test } from 'vitest'
import { lireAjout, lireEpoques, lireNatures, lireVoisins } from './lireAjout'

test('les natures se lisent ; une couleur qui n’est pas un hex tombe ; « sans époque » se lit', () => {
  expect(
    lireNatures([
      {
        id: 't1',
        nom: 'Châteaux & fortins',
        icone: 'c.svg',
        couleur: '#a9260f',
        horsEpoque: false,
      },
      { id: 't2', nom: 'Naturel', icone: null, couleur: 'rouge', horsEpoque: true },
    ]),
  ).toEqual([
    { id: 't1', nom: 'Châteaux & fortins', icone: 'c.svg', couleur: '#a9260f', horsEpoque: false },
    { id: 't2', nom: 'Naturel', icone: null, couleur: null, horsEpoque: true },
  ])
})

test('les époques se lisent', () => {
  expect(lireEpoques([{ id: 'renaissance', nom: 'Renaissance' }])).toEqual([
    { id: 'renaissance', nom: 'Renaissance' },
  ])
})

test('un voisin se lit, avec son type s’il en a un', () => {
  expect(
    lireVoisins([
      { id: 'l1', nom: 'Chapelle', metres: 40, type: { icone: 'i.svg', couleur: '#6556ae' } },
      { id: 'l2', nom: 'Moulin', metres: 12, type: null },
    ]),
  ).toEqual([
    { id: 'l1', nom: 'Chapelle', metres: 40, type: { icone: 'i.svg', couleur: '#6556ae' } },
    { id: 'l2', nom: 'Moulin', metres: 12, type: null },
  ])
})

test('la réponse de l’ajout : le lieu, le rang, la visite, l’expérience', () => {
  expect(
    lireAjout({ id: 'l9', rang: 17, surPlace: true, gain: 11, niveau: 12, avant: 0.7, apres: 0.8 }),
  ).toEqual({ id: 'l9', rang: 17, surPlace: true, gain: 11, niveau: 12, avant: 0.7, apres: 0.8 })
})
