import { expect, test } from 'vitest'
import { lireEndroit, lireResultats } from './adresse'

test('l’endroit se dit en mots : le village le plus proche, puis le département', () => {
  expect(
    lireEndroit({
      display_name: 'Chemin du Château, Colomars, Nice, Alpes-Maritimes, France',
      address: {
        road: 'Chemin du Château',
        village: 'Colomars',
        county: 'Alpes-Maritimes',
        country: 'France',
      },
    }),
  ).toEqual({
    titre: 'Près de Colomars',
    detail: 'Alpes-Maritimes',
    adresse: 'Chemin du Château, Colomars',
  })
})

test('en ville, sans village : la ville ; loin de tout : le département seul', () => {
  expect(lireEndroit({ address: { city: 'Lyon', state: 'Auvergne-Rhône-Alpes' } })).toMatchObject({
    titre: 'Près de Lyon',
    detail: 'Auvergne-Rhône-Alpes',
  })
  expect(lireEndroit({ address: { county: 'Lozère' } })).toMatchObject({
    titre: 'Lozère',
    detail: '',
  })
})

test('rien de lisible : un endroit sans nom', () => {
  expect(lireEndroit({})).toEqual({ titre: 'Un endroit sans nom', detail: '', adresse: '' })
})

test('les résultats d’une recherche : un nom court, une ligne de contexte, la position', () => {
  expect(
    lireResultats([
      {
        display_name: 'Colomars, Nice, Alpes-Maritimes, France',
        lat: '43.76',
        lon: '7.22',
        name: 'Colomars',
      },
    ]),
  ).toEqual([
    {
      nom: 'Colomars',
      contexte: 'Nice, Alpes-Maritimes',
      point: { latitude: 43.76, longitude: 7.22 },
    },
  ])
})
