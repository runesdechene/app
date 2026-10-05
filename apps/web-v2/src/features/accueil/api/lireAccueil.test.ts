import { expect, test } from 'vitest'
import {
  lireAjoutes,
  lireBanniere,
  lireChemins,
  lireGrandsExplorateurs,
  lirePresDeMoi,
  lireSalut,
} from './lireAccueil'

const CHEMIN = {
  id: 'visite:l1:u1',
  type: 'visite',
  quand: '2026-09-28T13:41:27Z',
  qui: { id: 'u1', nom: 'Luna', avatar: null },
  lieu: { id: 'l1', nom: 'Pointe du Becquet', region: 'Manche' },
  moi: false,
  saluts: 2,
  salue: false,
}

test('un lieu ajouté prend la forme d’une carte de lieu', () => {
  const [lieu] = lireAjoutes([
    {
      id: 'l1',
      nom: 'Pointe du Becquet',
      imageUrl: null,
      latitude: 49.6,
      longitude: -1.5,
      categorie: { icone: 'i.svg' },
      auteur: { nom: 'Luna', avatarUrl: null },
    },
  ])
  expect(lieu).toMatchObject({ nom: 'Pointe du Becquet', categorie: { icone: 'i.svg' } })
})

test('une ligne du fil se lit', () => {
  const [visite] = lireChemins([CHEMIN])
  expect(visite?.lieu?.region).toBe('Manche')
})

test('les revendications et récits enrichis se lisent (migration 406)', () => {
  const lignes = lireChemins([
    { ...CHEMIN, id: 'revendication:l1:u1:1', type: 'revendication' },
    { ...CHEMIN, id: 'enrichi:l1:u1:1', type: 'enrichi' },
  ])
  expect(lignes.map((l) => l.type)).toEqual(['revendication', 'enrichi'])
})

test('une modification est une ligne des chemins (migration 415)', () => {
  const lignes = lireChemins([{ ...CHEMIN, id: 'modifie:l1:u1:1', type: 'modifie' }])
  expect(lignes.map((l) => l.type)).toEqual(['modifie'])
})

test('les arrivées reviennent (migration 411) ; les connexions, non', () => {
  const [arrivee] = lireChemins([{ ...CHEMIN, id: 'arrivee:u1', type: 'arrivee', lieu: null }])
  expect(arrivee?.type).toBe('arrivee')
  expect(() => lireChemins([{ ...CHEMIN, id: 'connexion:u1:1', type: 'connexion' }])).toThrow()
})

test('un type de ligne inconnu est refusé, pas deviné', () => {
  expect(() => lireChemins([{ ...CHEMIN, type: 'couronne' }])).toThrow()
})

test('un salut rend le nombre et si je salue', () => {
  expect(lireSalut({ saluts: 3, salue: true })).toEqual({ saluts: 3, salue: true })
})

test('une bannière de la boutique se lit ; une couleur qui n’est pas un hex retombe par défaut', () => {
  const banniere = lireBanniere({
    id: 3,
    imageUrl: 'b.jpg',
    title: 'Les Mystères Celtes',
    subtitle: null,
    linkUrl: 'https://runesdechene.com/celtes',
    overlayColor: '#e3d5b1',
    overlayOpacity: 0.85,
    tagColor: 'red; background: url(x)',
    titleColor: '#5b4949',
    subtitleColor: '#69604f',
    shadowColor: '#000000',
    shadowStrength: 0,
  })
  expect(banniere).toMatchObject({
    titre: 'Les Mystères Celtes',
    sousTitre: null,
    lien: 'https://runesdechene.com/celtes',
  })
  expect(banniere?.couleurs.tag).toBe('#ffffff')
  expect(banniere?.couleurs.titre).toBe('#5b4949')
  expect(lireBanniere(null)).toBeNull()
})

test('une bannière dont le lien n’est pas http(s) ne s’affiche pas', () => {
  const piege = { imageUrl: 'b.jpg', title: 'Piège', linkUrl: 'javascript:alert(1)' }
  expect(lireBanniere(piege)).toBeNull()
})

test('le lieu d’une ligne porte son type (icône, couleur) ; sans type, rien', () => {
  const [avecType, sansType] = lireChemins([
    { ...CHEMIN, lieu: { ...CHEMIN.lieu, type: { icone: 't.svg', couleur: '#80974e' } } },
    { ...CHEMIN, id: 'visite:l2:u1', lieu: { ...CHEMIN.lieu, type: null } },
  ])
  expect(avecType?.lieu?.type).toEqual({ icone: 't.svg', couleur: '#80974e' })
  expect(sansType?.lieu?.type).toBeNull()
})

test('un lieu proche se lit : photo, type, distance en mètres ; sans type, rien', () => {
  const [avecType, sansType] = lirePresDeMoi([
    {
      id: 'l1',
      nom: 'Dolmen de la Roche-aux-Fées',
      imageUrl: 'd.jpg',
      type: { nom: 'Mégalithe', icone: 'm.svg', couleur: '#80974e' },
      metres: 4200,
    },
    { id: 'l2', nom: 'Chapelle', imageUrl: null, type: null, metres: 17000 },
  ])
  expect(avecType).toEqual({
    id: 'l1',
    nom: 'Dolmen de la Roche-aux-Fées',
    imageUrl: 'd.jpg',
    type: { nom: 'Mégalithe', icone: 'm.svg', couleur: '#80974e' },
    metres: 4200,
  })
  expect(sansType?.type).toBeNull()
})

test('les Grands Explorateurs se lisent : la tête, ma place, le dixième', () => {
  expect(
    lireGrandsExplorateurs({
      tete: [
        {
          rang: 1,
          id: 'u1',
          nom: 'Gautier',
          avatar: null,
          niveau: 14,
          titre: 'Chevalier errant',
          lieux: 17,
        },
        { rang: 2, id: 'u2', nom: 'Luna', avatar: 'l.jpg', niveau: 11, titre: null, lieux: 12 },
      ],
      moi: { rang: 14, id: 'me', nom: 'Uriel', avatar: null, niveau: 12, titre: null, lieux: 3 },
      dixieme: 4,
    }),
  ).toEqual({
    tete: [
      {
        rang: 1,
        id: 'u1',
        nom: 'Gautier',
        avatar: null,
        niveau: 14,
        titre: 'Chevalier errant',
        lieux: 17,
      },
      { rang: 2, id: 'u2', nom: 'Luna', avatar: 'l.jpg', niveau: 11, titre: null, lieux: 12 },
    ],
    moi: { rang: 14, id: 'me', nom: 'Uriel', avatar: null, niveau: 12, titre: null, lieux: 3 },
    dixieme: 4,
  })
  const pasClasse = {
    rang: null,
    id: 'me',
    nom: 'Uriel',
    avatar: null,
    niveau: 12,
    titre: null,
    lieux: 0,
  }
  expect(lireGrandsExplorateurs({ tete: [], moi: pasClasse, dixieme: null })).toEqual({
    tete: [],
    moi: pasClasse,
    dixieme: null,
  })
})
