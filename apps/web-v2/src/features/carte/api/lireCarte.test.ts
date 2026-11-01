import { expect, test } from 'vitest'
import { lireFiltres, lireLieux, lireTerritoire, lireTerritoiresRevendiques } from './lireCarte'

test('un lieu complet se lit', () => {
  expect(
    lireLieux([
      {
        id: 'a',
        nom: 'Trophée',
        lat: 43.7,
        lng: 7.4,
        nature: 'lieu',
        icone: 'x.svg',
        couleur: '#708d44',
        etat: 'visite',
        revendication: { nom: 'Rémy', moi: false },
      },
    ])[0],
  ).toMatchObject({ etat: 'visite', revendication: { nom: 'Rémy' } })
})

test('un lieu sans icône ni revendication reste lisible', () => {
  const l = lireLieux([
    {
      id: 'b',
      nom: 'Borne',
      lat: 44,
      lng: 7,
      nature: 'curiosite',
      icone: null,
      couleur: null,
      etat: 'inconnu',
      revendication: null,
    },
  ])[0]
  expect(l?.icone).toBeNull()
  expect(l?.revendication).toBeNull()
})

test('un état inconnu de la base est lu comme « inconnu », jamais une erreur', () => {
  expect(
    lireLieux([
      {
        id: 'c',
        nom: 'X',
        lat: 1,
        lng: 1,
        nature: 'lieu',
        icone: null,
        couleur: null,
        etat: 'bizarre',
        revendication: null,
      },
    ])[0]?.etat,
  ).toBe('inconnu')
})

test('au-dessus de la mer, pas de territoire', () => {
  expect(lireTerritoire({ territoire: null, pays: null })).toEqual({ territoire: null, pays: null })
})

test('les filtres lisent les natures, l’époque et « ajouté par moi » ; la carte des visiteurs n’en rend pas', () => {
  const base = {
    id: 'a',
    nom: 'A',
    lat: 1,
    lng: 2,
    nature: 'lieu',
    icone: null,
    couleur: null,
    etat: 'visite',
    revendication: null,
  }
  const [avec] = lireLieux([
    { ...base, natures: ['t1', 't2'], epoque: 'renaissance', ajoute: true },
  ])
  expect(avec).toMatchObject({ natures: ['t1', 't2'], epoque: 'renaissance', ajoute: true })
  const [sans] = lireLieux([base])
  expect(sans).toMatchObject({ natures: [], epoque: null, ajoute: false })
})

test('les listes des filtres se lisent', () => {
  expect(
    lireFiltres({
      natures: [{ id: 't1', nom: 'Châteaux', icone: null, couleur: '#a9260f' }],
      epoques: [
        { id: 'early-middle-ages', nom: 'Haut Moyen Âge', debut: 476, fin: 1000 },
        { id: 'not-applicable', nom: 'Non concerné', debut: null },
      ],
    }),
  ).toEqual({
    natures: [{ id: 't1', nom: 'Châteaux', icone: null, couleur: '#a9260f' }],
    epoques: [
      { id: 'early-middle-ages', nom: 'Haut Moyen Âge', debut: 476, fin: 1000 },
      { id: 'not-applicable', nom: 'Non concerné', debut: null, fin: null },
    ],
  })
})

test('un lieu nouveau pour moi le dit ; sans la clé (ancienne réponse), il ne l’est pas', () => {
  const [neuf, ancien] = lireLieux([
    {
      id: 'n',
      nom: 'Neuf',
      lat: 45,
      lng: 5,
      nature: 'lieu',
      icone: null,
      couleur: '#a9260f',
      etat: 'inconnu',
      revendication: null,
      nouveau: true,
    },
    {
      id: 'a',
      nom: 'Ancien',
      lat: 45,
      lng: 5,
      nature: 'lieu',
      icone: null,
      couleur: null,
      etat: 'inconnu',
      revendication: null,
    },
  ])
  expect(neuf?.nouveau).toBe(true)
  expect(ancien?.nouveau).toBe(false)
})

test('un territoire revendiqué se lit, en un morceau ou en plusieurs', () => {
  const anneau = [
    [1, 43],
    [2, 43],
    [2, 44],
    [1, 43],
  ]
  const territoire = { id: 'lieu-1', nom: 'Tugdual', moi: false, lieux: 2, etiquette: [1.5, 43] }
  const [un, deux] = lireTerritoiresRevendiques([
    { ...territoire, forme: { type: 'Polygon', coordinates: [anneau] } },
    { ...territoire, forme: { type: 'MultiPolygon', coordinates: [[anneau], [anneau]] } },
  ])
  expect(un).toEqual({ ...territoire, morceaux: [[anneau]] })
  expect(deux?.morceaux).toEqual([[anneau], [anneau]])
})
